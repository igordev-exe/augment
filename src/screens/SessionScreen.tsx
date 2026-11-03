import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import { ExerciseBlock } from "../components/ExerciseBlock";
import { Icon } from "../components/Icon";
import { Choice } from "../components/SetRow";
import { DAY_BY_ID, EXERCISE_BY_ID, shortName } from "../data/program";
import type { CardioEntry, Checkin, Session, SessionExercise } from "../data/types";
import { daysBetween, formatDuration, longDate, todayISO } from "../lib/dates";
import { db, exportBackup } from "../lib/db";
import { shareOrDownload } from "../lib/files";
import { useSession, useSessions, useSettings, useToast, useWakeLock } from "../lib/hooks";
import { checkinAdvice, defaultRest, isLowDay, setsFor, weekFor, WEEK_RULES } from "../lib/mesocycle";
import { backoffWeight, formatWeight, historyOf, increaseStep, mainLoad, prsInSession, suggest, type PR } from "../lib/progression";
import { buildSession, effectiveEndAt, sessionStats } from "../lib/sessions";
import { useTimer } from "../lib/timer";

export { checkinAdvice };

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export function SessionScreen() {
  const { id } = useParams();
  const session = useSession(id);
  const sessions = useSessions();
  const navigate = useNavigate();

  if (session === undefined || !sessions) return null;
  if (session === null) {
    return (
      <div className="empty">
        <p>Esse treino não existe mais.</p>
        <Link to="/" data-augmented-ui="tl-clip br-clip border" className="btn">
          Voltar ao início
        </Link>
      </div>
    );
  }
  return <SessionView key={session.id} session={session} sessions={sessions} onGone={() => navigate("/")} />;
}

function SessionView({ session, sessions, onGone }: { session: Session; sessions: Session[]; onGone: () => void }) {
  const [settings, updateSettings] = useSettings();
  const timer = useTimer();
  const toast = useToast();
  const navigate = useNavigate();
  const day = DAY_BY_ID[session.dayId];
  const week = session.week;
  const rule = WEEK_RULES[week];
  const isActive = session.status === "active";
  useWakeLock(isActive);

  const before = useMemo(
    () =>
      sessions.filter(
        (s) =>
          s.id !== session.id &&
          s.status === "done" &&
          (s.date < session.date || (s.date === session.date && s.startedAt < session.startedAt)),
      ),
    [sessions, session.id, session.date, session.startedAt],
  );

  const firstOpen = session.exercises.findIndex((e) => {
    const ex = EXERCISE_BY_ID[e.exId];
    const work = e.sets.filter((s) => s.kind !== "warmup");
    return ex && work.some((s) => !s.done);
  });
  const [open, setOpen] = useState<number>(isActive ? Math.max(0, firstOpen) : -1);
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const [summary, setSummary] = useState<PR[] | null>(null);
  const [backupPromptDismissed, setBackupPromptDismissed] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [isActive]);

  async function save(next: Session) {
    await db.sessions.put(next);
  }

  /** Lê o treino fresco do banco, localiza o exercício pelo `exId`, aplica a mudança e salva. */
  async function mutateEntry(exId: string, fn: (e: SessionExercise) => void): Promise<SessionExercise | undefined> {
    let out: SessionExercise | undefined;
    await db.transaction("rw", db.sessions, async () => {
      const cur = await db.sessions.get(session.id);
      if (!cur) return;
      const target = cur.exercises.find((e) => e.exId === exId);
      if (!target) return;
      fn(target);
      out = target;
      await db.sessions.put(cur);
    });
    return out;
  }

  const checkin = session.checkin;
  const askCheckin = !checkin?.skipped && !(checkin?.sleep && checkin?.energy && checkin?.pain);
  const lowDay = isLowDay(checkin);

  async function setCheckin(patch: Checkin) {
    await db.transaction("rw", db.sessions, async () => {
      const cur = await db.sessions.get(session.id);
      if (!cur) return;
      cur.checkin = { ...cur.checkin, ...patch };
      await db.sessions.put(cur);
    });
  }

  async function setCardio(patch: Partial<CardioEntry>) {
    await db.transaction("rw", db.sessions, async () => {
      const cur = await db.sessions.get(session.id);
      if (!cur) return;
      cur.cardio = { ...cur.cardio, ...patch };
      await db.sessions.put(cur);
    });
  }

  async function onSetDone(index: number, entry: SessionExercise, setId: string) {
    const ex = EXERCISE_BY_ID[entry.exId];
    const setIdx = entry.sets.findIndex((x) => x.id === setId);
    const set = entry.sets[setIdx];
    if (!isActive || !set?.done) return;
    let fresh = entry;
    // Reps abaixo do piso → a última série de trabalho vai com −15%.
    if ((set.kind === "work" || set.kind === "drop") && set.reps != null && set.reps < ex.reps[0]) {
      const pending = entry.sets.filter((s, i) => i > setIdx && !s.done && s.kind === "work");
      const lastPending = pending[pending.length - 1];
      if (lastPending) {
        const load = mainLoad(entry.sets.filter((s) => s.kind === "work" && s.weight != null)) ?? set.weight ?? 0;
        const step = increaseStep(ex, entry.unit, settings.increments[ex.id]);
        const w = backoffWeight(load, step, settings.machineWeights?.[ex.id]);
        fresh =
          (await mutateEntry(entry.exId, (e) => {
            const t = e.sets.find((x) => x.id === lastPending.id);
            if (t) {
              t.kind = "drop";
              t.weight = w;
            }
          })) ?? entry;
        toast(`${set.reps} reps, abaixo de ${ex.reps[0]}: a última série vai com −15% (${formatWeight(w)} ${entry.unit}).`);
      }
    }
    const next = fresh;

    // Timer de descanso.
    const remaining = next.sets.filter((s) => s.kind !== "warmup" && !s.done).length;
    if (set.kind === "warmup") {
      timer.start(60, `${shortName(ex)}: aquecimento`);
    } else if (ex.superset?.order === 1) {
      const partner = EXERCISE_BY_ID[ex.superset.with];
      toast(`Superset: vá direto para A2${partner ? `, ${shortName(partner).toLowerCase()}` : ""}.`);
    } else {
      const rest = ex.superset?.order === 2 ? 60 : defaultRest(ex.rest);
      timer.start(rest, remaining ? `${shortName(ex)}: próxima série` : "Próximo exercício");
    }
    if (ex.superset?.order === 1) {
      // Superset: alterna A1 → A2 a cada série.
      setOpen(index + 1);
      return;
    }
    if (ex.superset?.order === 2) {
      const partner = session.exercises[index - 1];
      if (partner?.sets.some((s) => s.kind !== "warmup" && !s.done)) {
        setOpen(index - 1);
        return;
      }
    }
    if (remaining === 0) {
      const nextIdx = session.exercises.findIndex((e, i) => i > index && e.sets.some((s) => s.kind !== "warmup" && !s.done));
      setOpen(nextIdx);
    }
  }

  async function finish() {
    const next = (await db.sessions.get(session.id)) ?? clone(session);
    const doneSets = next.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done && s.kind !== "warmup").length, 0);
    if (doneSets === 0) {
      toast("Nenhuma série de trabalho marcada. Marque pelo menos uma série ou descarte o treino.");
      return;
    }
    const { finishedAt, capped } = effectiveEndAt(next);
    next.exercises = next.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }));
    next.status = "done";
    next.finishedAt = finishedAt;
    await save(next);
    timer.stop();
    if (capped) toast("Treino ficou aberto por horas: duração ajustada pelo horário da última série.");
    setSummary(prsInSession(next, [...before, next]));
    setOpen(-1);
    window.scrollTo(0, 0);
  }

  async function remove() {
    await db.sessions.delete(session.id);
    timer.stop();
    onGone();
  }

  async function repeat() {
    const active = sessions.find((s) => s.status === "active");
    if (active) {
      toast("Já existe um treino em andamento. Conclua ou descarte antes.");
      navigate(`/treino/${active.id}`);
      return;
    }
    const today = todayISO();
    const s = buildSession(session.dayId, today, weekFor(settings.mesoStart, today), settings, sessions, session);
    await db.sessions.add(s);
    navigate(`/treino/${s.id}`);
  }

  async function quickBackup() {
    const b = await exportBackup();
    const today = todayISO();
    const mode = await shareOrDownload(`augment-backup-${today}.json`, JSON.stringify(b, null, 2), `AUGMENT Backup (${today})`);
    await updateSettings({ lastBackupAt: today });
    setBackupPromptDismissed(true);
    toast(mode === "shared" ? "Backup compartilhado." : "Backup baixado.");
  }

  const stats = sessionStats(session);
  const prs = summary ?? (isActive ? [] : prsInSession(session, [...before, session]));

  // F11: Sugerir backup automático ao concluir treino a cada 5 sessões ou se o último backup tem 7+ dias
  const totalDoneCount = sessions.filter((s) => s.status === "done").length;
  const today = todayISO();
  const backupDueAfterFinish =
    !isActive &&
    summary !== null &&
    !backupPromptDismissed &&
    (!settings.lastBackupAt || daysBetween(settings.lastBackupAt, today) >= 7 || totalDoneCount % 5 === 0);

  // F8: Debrief automático pós-treino
  const debriefQuery = `Acabei de concluir o treino ${day.name} de ${session.date} (${rule.label}). Faça um debrief direto em 3 pontos: o que evoluiu bem, o que saiu da meta de reps/sobra e o principal ajuste para a próxima sessão.`;

  return (
    <div className="stack-lg">
      <PageHead
        back={isActive ? "/" : "/historico"}
        code={isActive ? `MISSÃO ATIVA // PROTOCOLO ${day.code}` : `REGISTRO // PROTOCOLO ${day.code}`}
        title={day.name}
        sub={
          <>
            {longDate(session.date)}. {rule.label}
            {week < 7 ? " de 6" : ""}.{" "}
            {isActive
              ? `Em andamento há ${formatDuration(Date.now() - session.startedAt)}.`
              : `Concluído em ${formatDuration(stats.duration)}.`}
          </>
        }
      />

      {!isActive && (
        <section className="stack">
          {summary && <div className="callout">Protocolo concluído e salvo.{prs.length ? " Recordes batidos:" : ""}</div>}
          <div className="tiles">
            <div data-augmented-ui="tl-clip border" className="tile">
              <span className="label">Séries</span>
              <span className="v">{stats.sets}</span>
            </div>
            <div data-augmented-ui="tl-clip border" className="tile">
              <span className="label">Duração</span>
              <span className="v">
                {Math.round(stats.duration / 60000)}
                <small> min</small>
              </span>
            </div>
            <div data-augmented-ui="tl-clip border" className="tile">
              <span className="label">Volume</span>
              <span className="v">
                {(stats.volumeKg / 1000).toFixed(1).replace(".", ",")}
                <small> t</small>
              </span>
            </div>
          </div>
          {prs.length > 0 && (
            <ul data-augmented-ui="tl-clip br-clip border" className="list">
              {prs.map((p, i) => (
                <li key={i} className="list-item">
                  <span style={{ color: "var(--cyan)" }}>
                    <Icon name="trophy" size={20} />
                  </span>
                  <span className="grow small">
                    <strong>{shortName(EXERCISE_BY_ID[p.exId])}</strong>
                    <br />
                    {p.text}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {backupDueAfterFinish && (
            <div data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
              <span className="label">Backup rápido pós-treino</span>
              <p className="small muted" style={{ margin: 0 }}>
                {!settings.lastBackupAt
                  ? `Você já tem ${totalDoneCount} treino(s) salvo(s) neste aparelho e ainda não exportou uma cópia.`
                  : `Treino #${totalDoneCount} concluído — aproveite para salvar uma cópia atualizada em 1 toque.`}
              </p>
              <div className="row">
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-sm btn-primary grow"
                  onClick={quickBackup}
                >
                  <Icon name="check" size={16} /> Salvar backup agora
                </button>
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setBackupPromptDismissed(true)}
                >
                  Depois
                </button>
              </div>
            </div>
          )}

          <div className="row-wrap">
            <Link
              to={`/treinador?auto=1&q=${encodeURIComponent(debriefQuery)}`}
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-primary grow"
            >
              Debrief do treinador <span className="arrow">&gt;</span>
            </Link>
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={repeat}>
              <Icon name="repeat" size={18} /> Repetir treino
            </button>
            {summary && (
              <Link to="/" data-augmented-ui="tl-clip br-clip border" className="btn btn-dark">
                Início
              </Link>
            )}
          </div>
        </section>
      )}

      {isActive && askCheckin && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <h2 className="h-sec">Check-in</h2>
            <button type="button" className="link-btn" onClick={() => setCheckin({ skipped: true })}>
              Pular
            </button>
          </div>
          <Choice label="Sono" options={["ruim", "ok", "bom"]} value={checkin?.sleep} onPick={(v) => setCheckin({ sleep: v })} />
          <Choice label="Energia" options={["baixa", "ok", "alta"]} value={checkin?.energy} onPick={(v) => setCheckin({ energy: v })} />
          <Choice label="Dor" options={["nenhuma", "leve", "forte"]} value={checkin?.pain} onPick={(v) => setCheckin({ pain: v })} />
        </section>
      )}

      {isActive &&
        checkinAdvice(checkin).map((a) => (
          <div key={a} className="callout warn">
            {a}
          </div>
        ))}

      {isActive && (
        <div data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 6 }}>
          <div className="small">
            <strong>{rule.label}:</strong> compostos {rule.compounds.toLowerCase()}; isolados {rule.isolations.toLowerCase()}.
          </div>
          <div className="small muted">
            Intensificadores hoje:{" "}
            {lowDay
              ? "desativados pelo check-in (dia de baixa)"
              : `${rule.intensifierLabel.toLowerCase()}, só na última série de máquina ou cabo`}
            .
          </div>
          {day.notes.map((n) => (
            <div key={n} className="small muted">
              {n}
            </div>
          ))}
        </div>
      )}

      <div className="stack">
        {session.exercises.map((entry, i) => {
          const ex = EXERCISE_BY_ID[entry.exId];
          if (!ex) return null;
          if (!isActive && !entry.sets.length) return null;
          const hist = historyOf(before, ex.id, entry.alt);
          const step = increaseStep(ex, entry.unit, settings.increments[ex.id]);
          const available = settings.machineWeights?.[ex.id];
          return (
            <ExerciseBlock
              key={entry.exId}
              index={i}
              ex={ex}
              entry={entry}
              week={week}
              active={isActive}
              lowDay={lowDay}
              reminder={settings.exerciseNotes?.[ex.id]}
              open={open === i}
              recentHistory={hist}
              step={step}
              availableWeights={available}
              onToggle={() => setOpen(open === i ? -1 : i)}
              mutate={(fn) => mutateEntry(entry.exId, fn)}
              onSetDone={(e, setId) => onSetDone(i, e, setId)}
              onAlt={(alt) => {
                const altHist = historyOf(before, ex.id, alt);
                const altLast = altHist[altHist.length - 1];
                const altSug = suggest(ex, altLast?.entry, setsFor(ex, week), week, step, altLast?.session.week, available);
                mutateEntry(entry.exId, (e) => {
                  e.alt = alt;
                  for (const s of e.sets) {
                    if (s.kind === "work" && !s.done) s.weight = altSug.weight;
                  }
                });
              }}
              onClearReminder={() => {
                const next = { ...settings.exerciseNotes };
                delete next[ex.id];
                updateSettings({ exerciseNotes: next });
              }}
              onUnit={(u) => {
                mutateEntry(entry.exId, (e) => {
                  e.unit = u;
                });
                updateSettings({ units: { ...settings.units, [ex.id]: u } });
              }}
            />
          );
        })}
      </div>

      {!isActive && session.exercises.some((e) => !e.sets.length) && (
        <p className="small faint">
          Sem registro neste treino:{" "}
          {session.exercises
            .filter((e) => !e.sets.length)
            .map((e) => shortName(EXERCISE_BY_ID[e.exId]))
            .join(", ")}
          .
        </p>
      )}

      {/* F10: Cardio e Passos do dia */}
      <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
        <h2 className="h-sec">Cardio e passos (opcional)</h2>
        <div className="row-wrap">
          <div className="grow">
            <label className="label" htmlFor="cardio-min">
              Cardio (min)
            </label>
            <input
              id="cardio-min"
              className="input"
              inputMode="numeric"
              placeholder="ex.: 25"
              defaultValue={session.cardio?.minutes ?? ""}
              onBlur={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setCardio({ minutes: v ? Number(v) : undefined });
              }}
            />
          </div>
          <div className="grow">
            <label className="label" htmlFor="cardio-kind">
              Modalidade
            </label>
            <input
              id="cardio-kind"
              className="input"
              placeholder="Esteira inclinada, bike…"
              defaultValue={session.cardio?.kind ?? ""}
              onBlur={(e) => setCardio({ kind: e.target.value.trim() || undefined })}
            />
          </div>
          <div className="grow">
            <label className="label" htmlFor="cardio-steps">
              Passos no dia
            </label>
            <input
              id="cardio-steps"
              className="input"
              inputMode="numeric"
              placeholder="ex.: 8500"
              defaultValue={session.cardio?.steps ?? ""}
              onBlur={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setCardio({ steps: v ? Number(v) : undefined });
              }}
            />
          </div>
        </div>
        <Choice
          label="Intensidade"
          options={["leve", "moderada", "alta"]}
          value={session.cardio?.intensity}
          onPick={(v) => setCardio({ intensity: v })}
        />
      </section>

      <section className="stack">
        <label className="label" htmlFor="session-notes">
          Anotações do treino
        </label>
        <textarea
          id="session-notes"
          className="note"
          placeholder="Horário, cardio, máquina ocupada, o que chamou atenção…"
          defaultValue={session.notes ?? ""}
          onBlur={(e) => {
            const v = e.target.value;
            db.sessions.update(session.id, { notes: v });
          }}
        />
      </section>

      {isActive ? (
        <section className="stack">
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary btn-big" onClick={finish}>
            <Icon name="check" size={20} /> Concluir protocolo
          </button>
          {confirm === "discard" ? (
            <div data-augmented-ui="tl-clip br-clip border" className="card flat stack">
              <div className="small">Descartar apaga este treino e tudo que foi anotado nele.</div>
              <div className="row">
                <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-danger grow" onClick={remove}>
                  Descartar treino
                </button>
                <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={() => setConfirm(null)}>
                  Manter
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-ghost"
              onClick={() => setConfirm("discard")}
            >
              Descartar treino
            </button>
          )}
        </section>
      ) : (
        <section className="stack">
          {confirm === "delete" ? (
            <div data-augmented-ui="tl-clip br-clip border" className="card flat stack">
              <div className="small">Excluir remove este treino do histórico, dos gráficos e dos recordes.</div>
              <div className="row">
                <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-danger grow" onClick={remove}>
                  Excluir treino
                </button>
                <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={() => setConfirm(null)}>
                  Manter
                </button>
              </div>
            </div>
          ) : (
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" onClick={() => setConfirm("delete")}>
              <Icon name="trash" size={18} /> Excluir treino
            </button>
          )}
        </section>
      )}
    </div>
  );
}
