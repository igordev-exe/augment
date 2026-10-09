import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import { Icon } from "../components/Icon";
import { LIB_BY_ID } from "../data/library";
import { DAY_BY_ID, EXERCISE_BY_ID } from "../data/program";
import type { ProgramExercise, Session, SessionExercise, SetEntry, Unit } from "../data/types";
import { formatDuration, longDate, shortDate, todayISO } from "../lib/dates";
import { db } from "../lib/db";
import { useSession, useSessions, useSettings, useToast, useWakeLock } from "../lib/hooks";
import { defaultRest, setsFor, stopFor, weekFor, WEEK_RULES } from "../lib/mesocycle";
import {
  backoffWeight,
  formatWeight,
  historyOf,
  increaseStep,
  mainLoad,
  prsInSession,
  revertBackoff,
  suggest,
  summarizeSets,
  type PR,
} from "../lib/progression";
import { buildSession, newSet, sessionStats } from "../lib/sessions";
import { useTimer } from "../lib/timer";

function parseNum(s: string): number | null {
  const t = s.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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
  const [, tick] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [isActive]);

  async function save(next: Session) {
    await db.sessions.put(next);
  }

  /** Lê o treino fresco do banco, aplica a mudança e salva (evita perder digitação rápida). */
  async function mutateEntry(index: number, fn: (e: SessionExercise) => void): Promise<SessionExercise | undefined> {
    let out: SessionExercise | undefined;
    await db.transaction("rw", db.sessions, async () => {
      const cur = await db.sessions.get(session.id);
      if (!cur) return;
      fn(cur.exercises[index]);
      out = cur.exercises[index];
      await db.sessions.put(cur);
    });
    return out;
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
        const w = backoffWeight(load, step);
        fresh =
          (await mutateEntry(index, (e) => {
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
      toast("Superset: vá direto para A2, a rosca.");
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
    next.exercises = next.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }));
    next.status = "done";
    next.finishedAt = Date.now();
    await save(next);
    timer.stop();
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

  const stats = sessionStats(session);
  const prs = summary ?? (isActive ? [] : prsInSession(session, [...before, session]));

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
          <div className="row">
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={repeat}>
              <Icon name="repeat" size={18} /> Repetir este treino
            </button>
            {summary && (
              <Link to="/" data-augmented-ui="tl-clip br-clip border" className="btn btn-dark">
                Início
              </Link>
            )}
          </div>
        </section>
      )}

      {isActive && (
        <div data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 6 }}>
          <div className="small">
            <strong>{rule.label}:</strong> compostos {rule.compounds.toLowerCase()}; isolados {rule.isolations.toLowerCase()}.
          </div>
          <div className="small muted">
            Intensificadores hoje: {rule.intensifierLabel.toLowerCase()}, só na última série de máquina ou cabo.
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
          const hist = historyOf(before, ex.id);
          return (
            <ExerciseBlock
              key={entry.exId}
              index={i}
              ex={ex}
              entry={entry}
              week={week}
              active={isActive}
              open={open === i}
              last={hist[hist.length - 1]}
              step={increaseStep(ex, entry.unit, settings.increments[ex.id])}
              onToggle={() => setOpen(open === i ? -1 : i)}
              mutate={(fn) => mutateEntry(i, fn)}
              onSetDone={(e, setId) => onSetDone(i, e, setId)}
              onUnit={(u) => {
                mutateEntry(i, (e) => {
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

      <section className="stack">
        <label className="label" htmlFor="session-notes">
          Anotações do treino
        </label>
        <textarea
          id="session-notes"
          className="note"
          placeholder="Como você estava? Sono, energia, dor, máquina ocupada…"
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

export function shortName(ex: ProgramExercise | undefined): string {
  if (!ex) return "";
  return ex.name
    .replace(/^A[12] · /, "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/ · .*/, "")
    .trim();
}

// ---------- Exercício ----------

function ExerciseBlock({
  index,
  ex,
  entry,
  week,
  active,
  open,
  last,
  step,
  onToggle,
  mutate,
  onSetDone,
  onUnit,
}: {
  index: number;
  ex: ProgramExercise;
  entry: SessionExercise;
  week: number;
  active: boolean;
  open: boolean;
  last?: { session: Session; entry: SessionExercise };
  step: number;
  onToggle: () => void;
  mutate: (fn: (e: SessionExercise) => void) => Promise<SessionExercise | undefined>;
  onSetDone: (e: SessionExercise, setId: string) => void;
  onUnit: (u: Unit) => void;
}) {
  const lib = LIB_BY_ID[ex.lib];
  const planned = setsFor(ex, week);
  const workAll = entry.sets.filter((s) => s.kind !== "warmup");
  const workDone = workAll.filter((s) => s.done).length;
  const complete = workAll.length > 0 && workDone >= workAll.length;
  const sug = suggest(ex, last?.entry, planned, week, step);
  const stop = stopFor(ex.stop, week);
  const showInt = !!ex.intensifier && WEEK_RULES[week].intensifiers > 0;
  const [showNote, setShowNote] = useState(!!entry.notes);

  let workCounter = 0;

  function setSet(setId: string, patch: Partial<SetEntry>) {
    mutate((e) => {
      const s = e.sets.find((x) => x.id === setId);
      if (!s) return;
      Object.assign(s, patch);
      if ("reps" in patch && s.done) revertBackoff(e, ex.reps[0]);
    });
  }

  async function toggleDone(setId: string, wVal: number | null, rVal: number | null, weightPh: number | null, repsPh: number | null) {
    let becameDone = false;
    const fresh = await mutate((e) => {
      const s = e.sets.find((x) => x.id === setId);
      if (!s) return;
      if (!s.done) {
        s.weight = wVal ?? s.weight ?? weightPh;
        s.reps = rVal ?? s.reps ?? repsPh;
        if (s.reps == null) return;
        s.done = true;
        s.doneAt = Date.now();
        becameDone = true;
      } else {
        s.done = false;
        s.doneAt = undefined;
        revertBackoff(e, ex.reps[0]);
      }
    });
    if (fresh && becameDone) onSetDone(fresh, setId);
  }

  function addSet(kind: SetEntry["kind"]) {
    mutate((e) => {
      const lastW = [...e.sets].reverse().find((s) => s.kind !== "warmup")?.weight ?? sug.weight;
      const set = newSet(kind, kind === "warmup" ? null : lastW);
      if (kind === "warmup") {
        const firstWork = e.sets.findIndex((s) => s.kind !== "warmup");
        e.sets.splice(firstWork < 0 ? e.sets.length : firstWork, 0, set);
      } else e.sets.push(set);
    });
  }

  function removeSet(setId: string) {
    mutate((e) => {
      e.sets = e.sets.filter((x) => x.id !== setId);
    });
  }

  return (
    <article data-augmented-ui="tl-clip br-clip border" className={`ex${complete ? " complete" : ""}${open ? " open" : ""}`}>
      <button type="button" className="ex-head" onClick={onToggle} aria-expanded={open}>
        <span className="ex-num">{ex.superset ? (ex.superset.order === 1 ? "A1" : "A2") : String(index + 1).padStart(2, "0")}</span>
        <span className="grow">
          <span className="ex-name">
            {ex.name.replace(/^A[12] · /, "")}
            {ex.up && week >= 4 && week <= 6 && <span className="plus">▲ +1 série</span>}
          </span>
          <span className="ex-sub" style={{ display: "block" }}>
            {ex.muscleLabel}. {planned}×{ex.reps[0]}–{ex.reps[1]}
            {ex.perSide ? " por lado" : ""}, {stop.label.toLowerCase()}
          </span>
        </span>
        <span className="ex-count">{complete ? <Icon name="check" size={20} /> : `${workDone}/${workAll.length}`}</span>
      </button>

      {open && (
        <div className="ex-body">
          <div data-augmented-ui="br-clip border" className={`stats`}>
            <div className="stat">
              <span className="label">Séries × reps</span>
              <span className="v">
                {planned} × {ex.reps[0]}–{ex.reps[1]}
              </span>
            </div>
            <div className="stat">
              <span className="label">Descanso</span>
              <span className="v" style={{ fontSize: ex.rest[0] === 0 ? 15 : undefined }}>
                {ex.restLabel}
              </span>
            </div>
            <div className={`stat toned tone-${stop.tone}`}>
              <span className="label">Até onde</span>
              <span className="v">{stop.label}</span>
            </div>
          </div>

          <div className="row-wrap">
            <span data-augmented-ui="br-clip border" className="chip">
              Desce 2–3 s, sobe rápido
            </span>
            {ex.tempo && (
              <span data-augmented-ui="br-clip border" className="chip">
                {ex.tempo}
              </span>
            )}
            {showInt && (
              <span data-augmented-ui="br-clip border" className="chip int">
                {ex.intensifier}
              </span>
            )}
            {ex.superset && (
              <span data-augmented-ui="br-clip border" className="chip">
                Superset {ex.superset.order === 1 ? "com A2" : "com A1"}
              </span>
            )}
            {ex.changed && (
              <span data-augmented-ui="br-clip border" className="chip changed">
                Mudou na v2: {ex.changed}
              </span>
            )}
          </div>

          {active && (
            <div data-augmented-ui="tl-clip border" className={`suggest ${sug.kind === "up" ? "up" : sug.kind === "down" ? "down" : ""}`}>
              <strong>{sug.title}</strong>
              <span className="small muted">{sug.detail}</span>
              {last && (
                <span className="small faint">
                  Última vez ({shortDate(last.session.date)}): {summarizeSets(last.entry)} {last.entry.unit}
                </span>
              )}
            </div>
          )}

          <div className="sets">
            <div className="spread">
              <span className="label">Peso em</span>
              <span className="unit-toggle" role="group" aria-label="Unidade de peso">
                {(["kg", "lb"] as Unit[]).map((u) => (
                  <button key={u} type="button" aria-pressed={entry.unit === u} onClick={() => onUnit(u)}>
                    {u}
                  </button>
                ))}
              </span>
            </div>
            <div className="sets-head">
              <span>Série</span>
              <span className="center">Peso</span>
              <span className="center">Reps</span>
              <span className="center">Feita</span>
            </div>
            {entry.sets.map((s) => {
              const isWork = s.kind !== "warmup";
              const n = isWork ? ++workCounter : 0;
              const repsPh = isWork ? (sug.targets[n - 1] ?? sug.targets[sug.targets.length - 1] ?? ex.reps[0]) : 8;
              const weightPh = isWork ? sug.weight : null;
              return (
                <SetRow
                  key={s.id}
                  set={s}
                  label={s.kind === "warmup" ? "Aquec." : s.kind === "drop" ? "−15%" : String(n)}
                  unit={entry.unit}
                  weightPh={weightPh}
                  repsPh={repsPh}
                  canRemove={!s.done}
                  onWeight={(w) => setSet(s.id, { weight: w })}
                  onReps={(r) => setSet(s.id, { reps: r })}
                  onToggle={(wv, rv) => toggleDone(s.id, wv, rv, weightPh, repsPh)}
                  onRemove={() => removeSet(s.id)}
                />
              );
            })}
            <div className="row" style={{ marginTop: 2 }}>
              <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm" onClick={() => addSet("work")}>
                <Icon name="plus" size={16} /> Série
              </button>
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm btn-ghost"
                onClick={() => addSet("warmup")}
              >
                <Icon name="plus" size={16} /> Aquecimento
              </button>
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowNote((v) => !v)}
              >
                Anotar
              </button>
            </div>
          </div>

          {showNote && (
            <textarea
              className="note"
              placeholder="Ajuste do banco, pegada, dor, máquina usada…"
              defaultValue={entry.notes ?? ""}
              onBlur={(ev) => {
                const v = ev.target.value;
                mutate((e) => {
                  e.notes = v;
                });
              }}
            />
          )}

          <details className="how">
            <summary>Como fazer</summary>
            <div className="prose">
              <p>
                <strong>Da ficha:</strong>
              </p>
              <ul>
                {ex.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {lib && (
                <>
                  <p style={{ marginTop: 10 }}>
                    <strong>Execução:</strong>
                  </p>
                  <ol>
                    {lib.execution.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ol>
                  <p style={{ marginTop: 10 }}>
                    <strong>Evite:</strong> {lib.errors.join(" ")}
                  </p>
                  <p style={{ marginTop: 10 }}>
                    <Link to={`/exercicios/${lib.id}`}>Vídeo, progresso e recordes deste exercício</Link>
                  </p>
                </>
              )}
            </div>
          </details>
        </div>
      )}
    </article>
  );
}

function SetRow({
  set,
  label,
  unit,
  weightPh,
  repsPh,
  canRemove,
  onWeight,
  onReps,
  onToggle,
  onRemove,
}: {
  set: SetEntry;
  label: string;
  unit: Unit;
  weightPh: number | null;
  repsPh: number | null;
  canRemove: boolean;
  onWeight: (w: number | null) => void;
  onReps: (r: number | null) => void;
  onToggle: (w: number | null, r: number | null) => void;
  onRemove: () => void;
}) {
  const [w, setW] = useState(set.weight == null ? "" : formatWeight(set.weight));
  const [r, setR] = useState(set.reps == null ? "" : String(set.reps));

  // Sincroniza quando o valor muda por fora (ex.: −15% automático, marcar como feito).
  useEffect(() => {
    const parsed = parseNum(w);
    if (parsed !== set.weight) setW(set.weight == null ? "" : formatWeight(set.weight));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.weight]);
  useEffect(() => {
    const parsed = parseNum(r);
    if (parsed !== set.reps) setR(set.reps == null ? "" : String(set.reps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.reps]);

  const kindCls = set.kind === "warmup" ? "warmup" : set.kind === "drop" ? "drop" : "";
  return (
    <div className={`set ${set.kind}${set.done ? " done" : ""}`}>
      <div className={`set-kind ${kindCls}`}>
        {label}
        {canRemove && (
          <button type="button" className="x" aria-label="Remover série" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
      <div className="field">
        <input
          inputMode="decimal"
          enterKeyHint="next"
          aria-label={`Peso da série ${label}`}
          placeholder={weightPh != null ? formatWeight(weightPh) : "–"}
          value={w}
          onChange={(e) => {
            setW(e.target.value);
            const n = parseNum(e.target.value);
            if (n !== null || e.target.value.trim() === "") onWeight(n);
          }}
        />
        <span className="suffix">{unit}</span>
      </div>
      <div className="field">
        <input
          inputMode="numeric"
          enterKeyHint="done"
          aria-label={`Repetições da série ${label}`}
          placeholder={repsPh != null ? String(repsPh) : "–"}
          value={r}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            setR(v);
            onReps(v === "" ? null : Number(v));
          }}
        />
      </div>
      <button
        type="button"
        data-augmented-ui="tl-clip br-clip border"
        className="check"
        aria-pressed={set.done}
        aria-label={set.done ? "Desmarcar série" : "Marcar série como feita"}
        onClick={() => onToggle(parseNum(w), r === "" ? null : Number(r))}
      >
        <Icon name="check" size={22} />
      </button>
    </div>
  );
}
