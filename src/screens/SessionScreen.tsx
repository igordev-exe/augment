import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import { ExerciseBlock } from "../components/ExerciseBlock";
import { HoldButton } from "../components/HoldButton";
import { RecordList } from "../components/RecordList";
import { SessionHud } from "../components/SessionHud";
import { TerminalLog } from "../components/TerminalLog";
import { Icon } from "../components/Icon";
import { Choice } from "../components/SetRow";
import { ShareWorkoutCard } from "../components/ShareWorkoutCard";
import { SysModule } from "../components/SysModule";
import { exById, shortName, exOf, dayOf } from "../data/program";
import type { CardioEntry, Checkin, ProgramExercise, Session, SessionExercise } from "../data/types";
import { daysBetween, formatDuration, longDate, todayISO } from "../lib/dates";
import { db, exportBackup } from "../lib/db";
import { shareOrDownload } from "../lib/files";
import { useBodyLog, useOperatorState, useSession, useSessions, useSettings, useToast, useWakeLock } from "../lib/hooks";
import { syncNow } from "../lib/online/sync";
import { checkinAdvice, defaultRest, isLowDay, setsFor, weekFor, WEEK_RULES } from "../lib/mesocycle";
import {
  backoffWeight,
  formatWeight,
  historyOf,
  increaseStep,
  mainLoad,
  prsInSession,
  revertBackoff,
  suggest,
  suggestNext,
  type PR,
} from "../lib/progression";
import { intensifierPlan, liveNudges, NUDGE_TONE, type Nudge } from "../lib/engine";
import { finishLogLines } from "../lib/hud";
import { buildSession, effectiveEndAt, newSet, sessionStats, snapOf, unitFor } from "../lib/sessions";
import { useTimer } from "../lib/timer";
import { AddExercise } from "./ProgramEditor";

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
  const bodyLog = useBodyLog();
  const timer = useTimer();
  const toast = useToast();
  const navigate = useNavigate();
  const day = dayOf(session);
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
  const operator = useOperatorState(before, bodyLog, settings, session.date);

  const firstOpen = session.exercises.findIndex((e) => {
    const ex = exOf(e);
    const work = e.sets.filter((s) => s.kind !== "warmup");
    return ex && work.some((s) => !s.done);
  });
  const [open, setOpen] = useState<number>(isActive ? Math.max(0, firstOpen) : -1);
  const [summary, setSummary] = useState<PR[] | null>(null);
  const [backupPromptDismissed, setBackupPromptDismissed] = useState(false);
  const [showShare, setShowShare] = useState(false);
  /** Tocou em Concluir com séries pendentes: mostra a confirmação. */
  const [confirmFinish, setConfirmFinish] = useState(false);
  const pendingSets = session.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done && s.kind !== "warmup").length, 0);
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
  // Exercício extra só neste treino (máquina diferente no dia, por exemplo). Leva o próprio retrato, então
  // histórico, sugestão de carga e volume funcionam sem mexer no programa.
  const [adding, setAdding] = useState(false);
  async function addExtra(make: (taken: Set<string>, dayId: string) => ProgramExercise) {
    const taken = new Set(session.exercises.map((e) => e.exId));
    const ex = make(taken, session.dayId);
    const hist = historyOf(before, ex.id, undefined, ex.lib);
    const last = hist[hist.length - 1]?.entry;
    const unit = unitFor(ex.id, settings, last);
    const planned = Math.max(1, setsFor(ex, week, settings.setAdjust?.[ex.id]));
    const step = increaseStep(ex, unit, settings.increments[ex.id]);
    const s = suggestNext(ex, hist, planned, week, step, settings.machineWeights?.[ex.id]);
    const sets = Array.from({ length: planned }, (_, k) => newSet("work", k > 0 && s.volumeWeight != null ? s.volumeWeight : s.weight));
    let index = -1;
    await db.transaction("rw", db.sessions, async () => {
      const cur = await db.sessions.get(session.id);
      if (!cur) return;
      cur.exercises.push({ exId: ex.id, snap: snapOf(ex), unit, sets, extra: true });
      index = cur.exercises.length - 1;
      await db.sessions.put(cur);
    });
    setAdding(false);
    if (index >= 0) setOpen(index);
    toast(`${ex.name} entrou no treino de hoje. O programa não muda.`, "ok");
  }

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
  const intensifiers = intensifierPlan(day.exercises, week, lowDay);

  /** Recado do motor que vale um aviso na hora para este exercício (`only`: restringe às regras listadas). */
  function liveToast(entry: SessionExercise, only?: string[]): Nudge | null {
    const ex = exOf(entry);
    if (!ex) return null;
    const n = liveNudges({
      ex,
      entry,
      week,
      lowDay,
      history: historyOf(before, ex.id, entry.alt, ex.lib),
      plannedSets: setsFor(ex, week, settings.setAdjust?.[ex.id]),
      step: increaseStep(ex, entry.unit, settings.increments[ex.id]),
      availableWeights: settings.machineWeights?.[ex.id],
      intensifier: intensifiers.has(ex.id),
    }).find((x) => x.toast && (!only || only.includes(x.id)));
    return n ?? null;
  }

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
    const ex = exOf(entry);
    const setIdx = entry.sets.findIndex((x) => x.id === setId);
    const set = entry.sets[setIdx];
    if (!isActive || !set?.done) return;
    let fresh = entry;
    let warned = false;
    const step = increaseStep(ex, entry.unit, settings.increments[ex.id]);
    const avail = settings.machineWeights?.[ex.id];
    // Reps abaixo do piso → a última série pendente vai com −15% sobre a carga da série atual.
    if ((set.kind === "work" || set.kind === "drop") && set.reps != null && set.reps < ex.reps[0]) {
      const pending = entry.sets.filter((s, i) => i > setIdx && !s.done && (s.kind === "work" || s.kind === "drop"));
      const lastPending = pending[pending.length - 1];
      if (lastPending) {
        const fallbackLoad = mainLoad(entry.sets.filter((s) => s.kind === "work" && s.weight != null)) ?? 0;
        const baseLoad = set.weight != null && set.weight > 0 ? set.weight : fallbackLoad;
        const w = backoffWeight(baseLoad, step, avail);
        fresh =
          (await mutateEntry(entry.exId, (e) => {
            const t = e.sets.find((x) => x.id === lastPending.id);
            if (t) {
              t.kind = "drop";
              t.weight = w;
              t.suggested = undefined;
            }
          })) ?? entry;
        toast(`${set.reps} reps, abaixo de ${ex.reps[0]}: a última série vai com −15% (${formatWeight(w)} ${entry.unit}).`, "warn");
        warned = true;
      }
    } else if ((set.kind === "work" || set.kind === "drop") && set.reps != null && set.reps >= ex.reps[0]) {
      fresh =
        (await mutateEntry(entry.exId, (e) => {
          revertBackoff(e, ex.reps[0], step, avail);
        })) ?? entry;
    }
    const next = fresh;
    // Motor de decisões: recorde, descanso curto, intensificador na última série, teto batido.
    // As regras de RIR esperam a marcação de "sobraram" (onRirMarked).
    const live =
      set.kind === "warmup" || warned ? null : liveToast(next, ["recorde-reps", "descanso-curto", "intensificador", "meta-batida"]);
    if (live) toast(live.text, NUDGE_TONE[live.tone], live.id === "recorde-reps" || live.id === "meta-batida" ? "glitch" : undefined);

    // Timer de descanso.
    const remaining = next.sets.filter((s) => s.kind !== "warmup" && !s.done).length;
    if (set.kind === "warmup") {
      timer.start(60, `Aquecimento\n${shortName(ex)}`);
    } else if (ex.superset?.order === 1) {
      const partner = exById(ex.superset.with);
      if (!live && !warned) toast(`Superset: vá direto para A2${partner ? `, ${shortName(partner).toLowerCase()}` : ""}.`);
    } else {
      const rest = ex.superset?.order === 2 ? 60 : defaultRest(ex.rest);
      const workAll = next.sets.filter((s) => s.kind !== "warmup");
      const nextSet = workAll.find((s) => !s.done);
      const nextN = nextSet ? workAll.indexOf(nextSet) + 1 : 0;
      const nextLoad = nextSet?.weight ?? set.weight;
      const nextWhat = nextLoad != null ? ` · ${formatWeight(nextLoad)} ${next.unit}` : "";
      const nextEx = session.exercises.find((e, i) => i > index && e.sets.some((s) => s.kind !== "warmup" && !s.done));
      const nextExDef = nextEx && exOf(nextEx);
      timer.start(
        rest,
        remaining
          ? `Série ${nextN}/${workAll.length}${nextWhat}\n${shortName(ex)}`
          : `Próximo exercício${nextExDef ? `\n${shortName(nextExDef)}` : ""}`,
      );
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

  async function finish(confirmed = false) {
    const next = (await db.sessions.get(session.id)) ?? clone(session);
    const doneSets = next.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done && s.kind !== "warmup").length, 0);
    if (doneSets === 0) {
      toast("Nenhuma série de trabalho marcada. Marque pelo menos uma série ou descarte o treino.", "warn");
      return;
    }
    // Séries de trabalho que ficaram sem marcar somem ao concluir: pergunta antes.
    const pending = next.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done && s.kind !== "warmup").length, 0);
    if (pending > 0 && !confirmed) {
      setConfirmFinish(true);
      return;
    }
    setConfirmFinish(false);
    const snapshot = clone(next);
    const timerBefore = timer.state;
    const { finishedAt, capped } = effectiveEndAt(next);
    next.exercises = next.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }));
    next.status = "done";
    next.finishedAt = finishedAt;
    await save(next);
    timer.stop();
    if (capped) toast("Treino ficou aberto por horas: duração ajustada pelo horário da última série.", "warn");
    else
      toast("Protocolo concluído e salvo.", "ok", undefined, {
        label: "Desfazer",
        run: async () => {
          // Volta o treino como estava (séries pendentes incluídas) e reabre a sessão.
          await save(snapshot);
          if (timerBefore && timerBefore.endAt > Date.now())
            timer.start(Math.round((timerBefore.endAt - Date.now()) / 1000), timerBefore.label);
          setSummary(null);
          setShowShare(false);
          setOpen(Math.max(0, firstOpen));
        },
      });
    setSummary(prsInSession(next, [...before, next]));
    setShowShare(true);
    // Com conta online: recordes, resumo do treino e backup sobem agora (sem internet, ficam para depois).
    void syncNow("treino");
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
      toast("Já existe um treino em andamento. Conclua ou descarte antes.", "warn");
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
    toast(mode === "shared" ? "Backup compartilhado." : "Backup baixado.", "ok");
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

  // Log de fim de treino (terminal): séries, volume, recordes, o que sobe na próxima sessão e o backup.
  const logLines = (() => {
    if (isActive || !summary) return null;
    let planned = 0;
    let done = 0;
    const up: string[] = [];
    let same = 0;
    let down = 0;
    for (const e of session.exercises) {
      const ex = exOf(e);
      if (!ex) continue;
      planned += setsFor(ex, week, settings.setAdjust?.[ex.id]);
      done += e.sets.filter((x) => x.done && x.kind !== "warmup").length;
      if (!e.sets.some((x) => x.done && x.kind !== "warmup")) continue;
      const next = suggest(
        ex,
        e,
        setsFor(ex, week, settings.setAdjust?.[ex.id]),
        week,
        increaseStep(ex, e.unit, settings.increments[ex.id]),
        week,
        settings.machineWeights?.[ex.id],
      );
      if (next.kind === "up") up.push(shortName(ex));
      else if (next.kind === "down") down += 1;
      else same += 1;
    }
    return finishLogLines({
      dayCode: day.code,
      dayName: day.name,
      setsDone: done,
      setsPlanned: planned,
      volumeKg: stats.volumeKg,
      minutes: Math.round(stats.duration / 60000),
      prs: prs.length,
      up,
      same,
      down,
      backupAt: settings.lastBackupAt,
      today,
    });
  })();

  // F8: Debrief automático pós-treino
  const debriefQuery = `Acabei de concluir o treino ${day.name} de ${session.date} (${rule.label}). Faça um debrief direto em 3 pontos: o que evoluiu bem, o que saiu da meta de reps/sobra e o principal ajuste para a próxima sessão.`;

  return (
    <div className="stack-lg">
      {isActive && <SessionHud session={session} code={`${day.code} // ${rule.label.toUpperCase()}`} now={Date.now()} />}
      <PageHead
        back={isActive ? "/" : "/historico"}
        code={isActive ? `MISSÃO ATIVA // PROTOCOLO ${day.code}` : `REGISTRO // PROTOCOLO ${day.code}`}
        title={day.name}
        sub={
          <>
            {longDate(session.date)}. {rule.label}
            {week >= 1 && week < 7 ? " de 6" : ""}.{" "}
            {isActive
              ? `Em andamento há ${formatDuration(Date.now() - session.startedAt)}.`
              : `Concluído em ${formatDuration(stats.duration)}.`}
          </>
        }
      />

      {!isActive && (
        <section className="stack">
          {logLines && (
            <TerminalLog title="Protocolo concluído" command={`augment finalize --protocolo ${day.code.toLowerCase()}`} lines={logLines} />
          )}
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
          {prs.length > 0 && <RecordList items={prs} />}

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
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-primary grow"
              onClick={() => setShowShare((v) => !v)}
            >
              <Icon name="share" size={18} /> {showShare ? "Ocultar card" : "Compartilhar treino"}
            </button>
            <Link
              to={`/treinador?auto=1&q=${encodeURIComponent(debriefQuery)}`}
              data-augmented-ui="tl-clip br-clip border"
              className="btn grow"
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

          {showShare && <ShareWorkoutCard session={session} prs={prs} operator={settings.operator} onClose={() => setShowShare(false)} />}
        </section>
      )}

      {isActive && askCheckin && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
          <div className="spread">
            <h2 className="h-sec">Check-in</h2>
            <span className="row" style={{ gap: 6 }}>
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm quick-ok"
                onClick={() => setCheckin({ sleep: "ok", energy: "ok", pain: "nenhuma" })}
              >
                <Icon name="check" size={14} /> Tudo ok
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCheckin({ skipped: true })}>
                Pular
              </button>
            </span>
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
              : intensifiers.size
                ? `${[...intensifiers].map((id) => shortName(exById(id)).toLowerCase()).join(", ")} (cota da semana: ${rule.intensifierLabel.toLowerCase()}), só na última série`
                : "nenhum nesta semana"}
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
          const ex = exOf(entry);
          if (!ex) return null;
          if (!isActive && !entry.sets.length) return null;
          const hist = historyOf(before, ex.id, entry.alt, ex.lib);
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
              intensifierToday={intensifiers.has(ex.id)}
              setAdjust={settings.setAdjust?.[ex.id] ?? 0}
              operator={operator}
              onRirMarked={(e) => {
                const n = isActive ? liveToast(e, ["falha-composto", "longe-da-falha"]) : null;
                if (n) toast(n.text, NUDGE_TONE[n.tone]);
              }}
              onToggle={() => setOpen(open === i ? -1 : i)}
              mutate={(fn) => mutateEntry(entry.exId, fn)}
              onSetDone={(e, setId) => onSetDone(i, e, setId)}
              onAlt={(alt) => {
                const altHist = historyOf(before, ex.id, alt, ex.lib);
                const altSug = suggestNext(ex, altHist, setsFor(ex, week, settings.setAdjust?.[ex.id]), week, step, available);
                mutateEntry(entry.exId, (e) => {
                  e.alt = alt;
                  for (const s of e.sets) {
                    if (s.kind === "work" && !s.done) {
                      s.weight = altSug.weight;
                      s.suggested = altSug.weight != null || undefined;
                    }
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
        {isActive &&
          (adding ? (
            <AddExercise onClose={() => setAdding(false)} onAdd={(make) => addExtra(make)} />
          ) : (
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Adicionar exercício hoje
            </button>
          ))}
      </div>

      {!isActive && session.exercises.some((e) => !e.sets.length) && (
        <p className="small faint">
          Sem registro neste treino:{" "}
          {session.exercises
            .filter((e) => !e.sets.length)
            .map((e) => shortName(exOf(e)))
            .join(", ")}
          .
        </p>
      )}

      {isActive && (
        <section className="stack">
          {confirmFinish && pendingSets > 0 ? (
            <div
              data-augmented-ui="tl-clip br-clip border"
              className="card stack finish-confirm"
              role="alertdialog"
              aria-label="Concluir com séries pendentes"
            >
              <span className="label" style={{ color: "var(--warn)" }}>
                SYS // {pendingSets} {pendingSets === 1 ? "SÉRIE PENDENTE" : "SÉRIES PENDENTES"}
              </span>
              <p className="small" style={{ margin: 0 }}>
                {pendingSets === 1 ? "Falta 1 série de trabalho." : `Faltam ${pendingSets} séries de trabalho.`} Concluir agora descarta o
                que não foi marcado. Dá para desfazer logo depois.
              </p>
              <div className="row">
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-primary grow"
                  onClick={() => finish(true)}
                >
                  Concluir assim
                </button>
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn grow"
                  onClick={() => setConfirmFinish(false)}
                >
                  Voltar ao treino
                </button>
              </div>
            </div>
          ) : (
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary btn-big" onClick={() => finish()}>
              <Icon name="check" size={20} /> Concluir protocolo
            </button>
          )}
        </section>
      )}

      {/* F10: Cardio, passos e notas: opcionais, recolhidos depois do Concluir. */}
      <SysModule
        id="sessao-extras"
        code="CRD.01"
        title="Cardio e notas"
        hint="Passos e anotações · opcional"
        tone="amber"
        meta={
          [
            session.cardio?.minutes ? `${session.cardio.minutes} min` : null,
            session.cardio?.steps ? `${session.cardio.steps} passos` : null,
            session.notes?.trim() ? "nota" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"
        }
      >
        <div className="stack" style={{ gap: 8 }}>
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
        </div>

        <div className="stack" style={{ marginTop: 12 }}>
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
        </div>
      </SysModule>

      {isActive ? (
        <section className="stack">
          <HoldButton className="btn-danger" label="Descartar treino" onConfirm={remove}>
            Descartar treino
          </HoldButton>
          <span className="tiny faint" style={{ textAlign: "center" }}>
            Segure para descartar: apaga este treino e tudo que foi anotado nele.
          </span>
        </section>
      ) : (
        <section className="stack">
          <HoldButton className="btn-danger" label="Excluir treino" onConfirm={remove}>
            <Icon name="trash" size={18} /> Excluir treino
          </HoldButton>
          <span className="tiny faint" style={{ textAlign: "center" }}>
            Segure para excluir: sai do histórico, dos gráficos e dos recordes.
          </span>
        </section>
      )}
    </div>
  );
}
