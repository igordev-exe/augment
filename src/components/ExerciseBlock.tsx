import { useState } from "react";
import { Link } from "react-router-dom";
import { LIB_BY_ID } from "../data/library";
import { shortName } from "../data/program";
import type { ExerciseFeedback, ProgramExercise, SessionExercise, SetEntry, Unit } from "../data/types";
import { shortDate } from "../lib/dates";
import { rirRange, setsFor, stopFor, WEEK_RULES } from "../lib/mesocycle";
import {
  e1rm,
  formatWeight,
  mainLoad,
  platesForBarbell,
  revertBackoff,
  suggest,
  summarizeSets,
  toKg,
  warmupSpec,
  workSets,
  type ExerciseHistoryItem,
} from "../lib/progression";
import { newSet } from "../lib/sessions";
import { Icon } from "./Icon";
import { Choice, SetRow } from "./SetRow";

export function ExerciseBlock({
  index,
  ex,
  entry,
  week,
  active,
  lowDay,
  reminder,
  open,
  recentHistory,
  step,
  availableWeights,
  onToggle,
  mutate,
  onSetDone,
  onAlt,
  onClearReminder,
  onUnit,
}: {
  index: number;
  ex: ProgramExercise;
  entry: SessionExercise;
  week: number;
  active: boolean;
  lowDay: boolean;
  reminder?: string;
  open: boolean;
  recentHistory: ExerciseHistoryItem[];
  step: number;
  availableWeights?: number[];
  onToggle: () => void;
  mutate: (fn: (e: SessionExercise) => void) => Promise<SessionExercise | undefined>;
  onSetDone: (e: SessionExercise, setId: string) => void;
  onAlt: (alt: string | undefined) => void;
  onClearReminder: () => void;
  onUnit: (u: Unit) => void;
}) {
  const lib = LIB_BY_ID[ex.lib];
  const alts = lib?.alternatives ?? [];
  const planned = setsFor(ex, week);
  const workAll = entry.sets.filter((s) => s.kind !== "warmup");
  const workDone = workAll.filter((s) => s.done).length;
  const complete = workAll.length > 0 && workDone >= workAll.length;
  const last = recentHistory[recentHistory.length - 1];
  const sug = suggest(ex, last?.entry, planned, week, step, last?.session.week, availableWeights);
  const stop = stopFor(ex.stop, week);
  const showInt = !!ex.intensifier && WEEK_RULES[week].intensifiers > 0 && !lowDay;
  const [showNote, setShowNote] = useState(!!entry.notes);
  const [pickAlt, setPickAlt] = useState(false);
  const baseRir = rirRange(ex.stop, week);
  const rirTarget: [number, number] = lowDay ? [Math.min(4, baseRir[0] + 1), Math.min(4, baseRir[1] + 1)] : baseRir;
  // Pergunta o RIR da série feita mais recente que ainda não tem resposta.
  const askRirId = active
    ? entry.sets.filter((s) => s.done && s.kind !== "warmup" && s.rir == null).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))[0]?.id
    : undefined;
  const fb = entry.feedback;
  const askFeedback = active && complete && !fb?.skipped && !(fb?.pump && fb?.volume && fb?.joint);
  // Com o exercício fechado (fecha sozinho na última série), o RIR que falta vai para o cartão de baixo.
  const askRirClosed = active && complete && !open && !!askRirId;
  const RIR_OPTS = ["0", "1", "2", "3", "4+"];

  // F5: Calculadora de anilhas para exercícios com barra olímpica
  const isOlympicBarbell =
    !entry.alt && !!lib?.equipment && /barra/i.test(lib.equipment) && !/barra w|barra fixa|polia|guiada/i.test(lib.equipment);
  const refLoad = sug.weight ?? mainLoad(entry.sets);
  const plateBreakdown = isOlympicBarbell ? platesForBarbell(refLoad, entry.unit) : null;

  // F7: Mini-histórico das últimas 5 sessões
  const miniPoints = recentHistory.slice(-5).map((h) => {
    const ws = workSets(h.entry, false);
    const load = mainLoad(ws) ?? ws[0]?.weight ?? 0;
    const topReps = Math.max(0, ...ws.filter((s) => s.weight === load).map((s) => s.reps ?? 0));
    const est = Math.max(0, ...ws.map((s) => e1rm(toKg(s.weight!, h.entry.unit), s.reps!)));
    return {
      date: shortDate(h.session.date),
      summary: `${formatWeight(load)}×${topReps}`,
      est,
    };
  });
  const maxEst = Math.max(1, ...miniPoints.map((p) => p.est));
  const minEst = Math.min(...miniPoints.map((p) => p.est));

  function setFeedback(patch: ExerciseFeedback) {
    mutate((e) => {
      e.feedback = { ...e.feedback, ...patch };
    });
  }

  let workCounter = 0;
  let warmupCounter = 0;
  const totalWarmups = entry.sets.filter((s) => s.kind === "warmup").length;

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
        s.rir = undefined;
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
            {entry.alt ?? ex.name.replace(/^A[12] · /, "")}
            {ex.up && week >= 4 && week <= 6 && <span className="plus">▲ +1 série</span>}
          </span>
          <span className="ex-sub" style={{ display: "block" }}>
            {entry.alt ? `Alternativa (${shortName(ex)}) · ` : `${ex.muscleLabel}. `}
            {planned}×{ex.reps[0]}–{ex.reps[1]}
            {ex.perSide ? " por lado" : ""}, {stop.label.toLowerCase()}
          </span>
        </span>
        <span className="ex-count">{complete ? <Icon name="check" size={20} /> : `${workDone}/${workAll.length}`}</span>
      </button>

      {(askFeedback || askRirClosed) && (
        <div className="ask stack" style={{ gap: 8 }}>
          <div className="spread">
            <span className="label">Como bateu?</span>
            {askFeedback && (
              <button type="button" className="link-btn" onClick={() => setFeedback({ skipped: true })}>
                Pular
              </button>
            )}
          </div>
          {askRirClosed && (
            <Choice label="Sobraram" options={RIR_OPTS} value={undefined} onPick={(v) => setSet(askRirId!, { rir: RIR_OPTS.indexOf(v) })} />
          )}
          {askFeedback && (
            <>
              <Choice label="Pump" options={["fraco", "bom", "forte"]} value={fb?.pump} onPick={(v) => setFeedback({ pump: v })} />
              <Choice label="Volume" options={["leve", "ok", "pesado"]} value={fb?.volume} onPick={(v) => setFeedback({ volume: v })} />
              <Choice label="Articulação" options={["ok", "incomodou"]} value={fb?.joint} onPick={(v) => setFeedback({ joint: v })} />
            </>
          )}
        </div>
      )}

      {open && (
        <div className="ex-body">
          <div data-augmented-ui="br-clip border" className="stats">
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

          {reminder && (
            <div className="callout" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <span className="small">
                <strong>Lembrete:</strong> {reminder}
              </span>
              {active && (
                <button type="button" className="link-btn" onClick={onClearReminder}>
                  Limpar
                </button>
              )}
            </div>
          )}

          {active && (
            <div
              data-augmented-ui="tl-clip border"
              className={`suggest ${sug.kind === "up" && !lowDay ? "up" : sug.kind === "down" ? "down" : ""}`}
            >
              <strong>{sug.title}</strong>
              <span className="small muted">{sug.detail}</span>
              {plateBreakdown && (
                <span className="tiny" style={{ color: "var(--cyan)" }}>
                  Montagem ({formatWeight(refLoad)} {entry.unit}): {plateBreakdown}
                </span>
              )}
              {availableWeights && availableWeights.length > 0 && (
                <span className="tiny faint">
                  Pinos configurados: {availableWeights.map((w) => formatWeight(w)).join(", ")} {entry.unit}
                </span>
              )}
              {lowDay && (
                <span className="small sug-note">Dia de baixa no check-in: sem intensificador hoje e pare com +1 rep de sobra.</span>
              )}
              {sug.notes.map((n) => (
                <span key={n} className="small sug-note">
                  {n}
                </span>
              ))}
              {last && (
                <span className="small faint">
                  Última vez ({shortDate(last.session.date)}): {summarizeSets(last.entry)} {last.entry.unit}
                </span>
              )}
              {miniPoints.length >= 2 && (
                <div className="row-wrap" style={{ gap: 6, marginTop: 4, alignItems: "flex-end" }} aria-label="Tendência recente">
                  {miniPoints.map((pt, idx) => {
                    const ratio = maxEst === minEst ? 0.7 : 0.35 + ((pt.est - minEst) / (maxEst - minEst)) * 0.65;
                    return (
                      <span
                        key={`${pt.date}-${idx}`}
                        className="tiny faint"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: "rgba(0,240,255,0.06)",
                          padding: "2px 6px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 4,
                            height: Math.round(14 * ratio),
                            background: idx === miniPoints.length - 1 ? "var(--cyan)" : "var(--muted)",
                          }}
                        />
                        {pt.date}: <strong style={{ color: "var(--fg)" }}>{pt.summary}</strong>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {active && alts.length > 0 && (pickAlt || entry.alt) && (
            <div data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 8, padding: 12 }}>
              <div className="spread">
                <span className="label">Alternativa hoje (aparelho ocupado / dor)</span>
                {entry.alt ? (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onAlt(undefined);
                      setPickAlt(false);
                    }}
                  >
                    Voltar ao original
                  </button>
                ) : (
                  <button type="button" className="link-btn" onClick={() => setPickAlt(false)}>
                    Fechar
                  </button>
                )}
              </div>
              <div className="row-wrap">
                {alts.map((a) => (
                  <button
                    key={a}
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="toggle-chip"
                    style={{ fontSize: 12, textTransform: "none" }}
                    aria-pressed={entry.alt === a}
                    onClick={() => {
                      onAlt(entry.alt === a ? undefined : a);
                      setPickAlt(false);
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <span className="tiny faint">
                Conta séries para o músculo na semana sem misturar a carga com o histórico do exercício principal.
              </span>
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
              const wm = isWork ? null : warmupSpec(sug.weight, warmupCounter++, totalWarmups, step, availableWeights);
              const baseTarget = sug.targets[n - 1] ?? sug.targets[sug.targets.length - 1] ?? ex.reps[0];
              const repsPh = isWork ? (lowDay ? Math.max(ex.reps[0], baseTarget - 1) : baseTarget) : wm!.reps;
              const weightPh = isWork ? sug.weight : wm!.weight;
              return (
                <SetRow
                  key={s.id}
                  set={s}
                  label={s.kind === "warmup" ? "Aquec." : s.kind === "drop" ? "−15%" : String(n)}
                  unit={entry.unit}
                  active={active}
                  weightPh={weightPh}
                  repsPh={repsPh}
                  canRemove={!s.done}
                  askRir={s.id === askRirId}
                  rirTarget={rirTarget}
                  onRir={(v) => setSet(s.id, { rir: v })}
                  onWeight={(w) => setSet(s.id, { weight: w })}
                  onReps={(r) => setSet(s.id, { reps: r })}
                  onToggle={(wv, rv) => toggleDone(s.id, wv, rv, weightPh, repsPh)}
                  onRemove={() => removeSet(s.id)}
                />
              );
            })}
            {active && (
              <div className="row-wrap" style={{ marginTop: 2 }}>
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
                {alts.length > 0 && !entry.alt && (
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setPickAlt((v) => !v)}
                  >
                    Trocar hoje
                  </button>
                )}
              </div>
            )}
          </div>

          {showNote && (
            <textarea
              className="note"
              placeholder="Ajuste do banco, pegada, dor, máquina usada…"
              defaultValue={entry.notes ?? ""}
              readOnly={!active}
              onBlur={(ev) => {
                if (!active) return;
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
