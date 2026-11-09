import { useState } from "react";
import { Link } from "react-router-dom";
import { useLibraryEntry } from "../data/library-extended";
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
  suggestNext,
  summarizeSets,
  toKg,
  warmupSpec,
  workSets,
  type ExerciseHistoryItem,
} from "../lib/progression";
import { newSet } from "../lib/sessions";
import { liveNudges } from "../lib/engine";
import { ExerciseDemo } from "./ExerciseDemo";
import { Icon } from "./Icon";
import { PlanCard, type SetPlan } from "./PlanCard";
import { NudgeList } from "./NudgeList";
import { RadialMenu, type RadialAction } from "./RadialMenu";
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
  intensifierToday,
  setAdjust = 0,
  onToggle,
  mutate,
  onSetDone,
  onRirMarked,
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
  /** Intensificador liberado hoje para este exercício (cota da semana, motor de decisões). */
  intensifierToday: boolean;
  /** Séries a mais/menos do ajuste de fim de mesociclo. */
  setAdjust?: number;
  onToggle: () => void;
  mutate: (fn: (e: SessionExercise) => void) => Promise<SessionExercise | undefined>;
  onSetDone: (e: SessionExercise, setId: string) => void;
  /** RIR marcado numa série: o motor pode ter um recado na hora. */
  onRirMarked: (e: SessionExercise) => void;
  onAlt: (alt: string | undefined) => void;
  onClearReminder: () => void;
  onUnit: (u: Unit) => void;
}) {
  const lib = useLibraryEntry(ex.lib);
  const alts = lib?.alternatives ?? [];
  const planned = setsFor(ex, week, setAdjust);
  const workAll = entry.sets.filter((s) => s.kind !== "warmup");
  const workDone = workAll.filter((s) => s.done).length;
  const complete = workAll.length > 0 && workDone >= workAll.length;
  const last = recentHistory[recentHistory.length - 1];
  const sug = suggestNext(ex, recentHistory, planned, week, step, availableWeights);
  const stop = stopFor(ex.stop, week);
  const showInt = !!ex.intensifier && intensifierToday && WEEK_RULES[week].intensifiers > 0;
  const nudges = active
    ? liveNudges({
        ex,
        entry,
        week,
        lowDay,
        history: recentHistory,
        plannedSets: planned,
        step,
        availableWeights,
        intensifier: intensifierToday,
      })
    : [];
  const [showNote, setShowNote] = useState(!!entry.notes);
  const [pickAlt, setPickAlt] = useState(false);
  /** Série com o menu circular aberto (segurar o número da série). */
  const [radial, setRadial] = useState<string | null>(null);
  /** Série com o RIR reaberto para corrigir (pelo menu circular). */
  const [rirEdit, setRirEdit] = useState<string | null>(null);
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

  /** Peso da última série de trabalho feita hoje: vale como sugestão quando o motor ainda não tem uma (1ª vez). */
  const lastDoneWeight = [...entry.sets].reverse().find((s) => s.done && s.kind !== "warmup" && s.weight != null)?.weight ?? null;
  /** Peso e reps sugeridos para a série de trabalho n (1, 2, 3…), como placeholder. */
  function workPlaceholder(n: number): { weightPh: number | null; repsPh: number } {
    const baseTarget = sug.targets[n - 1] ?? sug.targets[sug.targets.length - 1] ?? ex.reps[0];
    return {
      weightPh: (n > 1 && sug.volumeWeight != null ? sug.volumeWeight : sug.weight) ?? lastDoneWeight,
      repsPh: lowDay ? Math.max(ex.reps[0], baseTarget - 1) : baseTarget,
    };
  }
  const workSetsAll = entry.sets.filter((s) => s.kind !== "warmup");
  const plans: SetPlan[] = workSetsAll.map((s, i) => {
    const ph = workPlaceholder(i + 1);
    return {
      id: s.id,
      n: i + 1,
      done: s.done,
      drop: s.kind === "drop",
      weight: s.done ? s.weight : (s.weight ?? ph.weightPh),
      reps: s.done ? s.reps : (s.reps ?? ph.repsPh),
    };
  });
  const nextPlan = plans.find((p) => !p.done);
  const rirLabel = rirTarget[0] === rirTarget[1] ? `${rirTarget[0]}` : `${rirTarget[0]}–${rirTarget[1]}`;
  const nextReason = nextPlan?.drop
    ? "Uma série caiu abaixo do piso: esta vai com −15% para fechar dentro da faixa."
    : lowDay
      ? "Dia de baixa no check-in: pare com +1 rep de sobra."
      : `Até ${stop.label.toLowerCase()}.`;

  let workCounter = 0;
  let warmupCounter = 0;
  const totalWarmups = entry.sets.filter((s) => s.kind === "warmup").length;

  async function setSet(setId: string, patch: Partial<SetEntry>) {
    const fresh = await mutate((e) => {
      const s = e.sets.find((x) => x.id === setId);
      if (!s) return;
      Object.assign(s, patch);
      if (("reps" in patch || "weight" in patch) && s.done) {
        revertBackoff(e, ex.reps[0], step, availableWeights);
      }
    });
    if (fresh && "rir" in patch && patch.rir != null) onRirMarked(fresh);
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
        s.suggested = undefined;
        becameDone = true;
      } else {
        s.done = false;
        s.doneAt = undefined;
        s.rir = undefined;
        revertBackoff(e, ex.reps[0], step, availableWeights);
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

  // Último aquecimento ainda não feito: o botão "− Aquecimento" tira ele (sem precisar descobrir o menu da série).
  const lastPendingWarmup = [...entry.sets].reverse().find((x) => x.kind === "warmup" && !x.done);

  const radialSet = radial ? entry.sets.find((x) => x.id === radial) : undefined;
  const radialN = radialSet && radialSet.kind !== "warmup" ? workSetsAll.indexOf(radialSet) + 1 : 0;
  const radialActions: RadialAction[] = radialSet
    ? [
        { id: "serie", label: "+ Série", tone: "action", onPick: () => addSet("work") },
        { id: "drop", label: "+ −15%", onPick: () => addSet("drop") },
        {
          id: "falhou",
          label: "Falhou aqui",
          tone: "warn",
          disabled: !radialSet.done || radialSet.kind === "warmup",
          onPick: () => setSet(radialSet.id, { failure: true, rir: 0 }),
        },
        ...(ex.intensifier && intensifierToday
          ? [
              {
                id: "int",
                label: "Intensif. feito",
                tone: "ok" as const,
                disabled: !radialSet.done,
                onPick: () =>
                  mutate((e) => {
                    const tag = `[S${radialN}] ${ex.intensifier}`;
                    e.notes = e.notes ? `${e.notes}\n${tag}` : tag;
                  }).then(() => setShowNote(true)),
              },
            ]
          : []),
        {
          id: "rir",
          label: "Mudar sobra",
          disabled: !radialSet.done || radialSet.kind === "warmup",
          onPick: () => setRirEdit(radialSet.id),
        },
        {
          id: "remover",
          label: radialSet.kind === "warmup" ? "Tirar aquecimento" : "Remover série",
          tone: "warn",
          disabled: radialSet.done,
          onPick: () => removeSet(radialSet.id),
        },
        ...(alts.length > 0 ? [{ id: "trocar", label: "Trocar hoje", onPick: () => setPickAlt(true) }] : []),
        { id: "anotar", label: "Anotar", onPick: () => setShowNote(true) },
      ]
    : [];

  return (
    <article data-augmented-ui="tl-clip br-clip border" className={`ex${complete ? " complete" : ""}${open ? " open" : ""}`}>
      <button type="button" className="ex-head" onClick={onToggle} aria-expanded={open}>
        <span className="ex-num">{ex.superset ? (ex.superset.order === 1 ? "A1" : "A2") : String(index + 1).padStart(2, "0")}</span>
        <span className="grow">
          <span className="ex-name">
            {entry.alt ?? ex.name.replace(/^A[12] · /, "")}
            {entry.extra && <span className="plus">extra hoje</span>}
            {ex.up && week >= 4 && week <= 6 && <span className="plus">▲ +1 série</span>}
            {setAdjust !== 0 && week !== 7 && (
              <span className="plus" title="Ajuste do fim do mesociclo">
                {setAdjust > 0 ? `+${setAdjust}` : `−${-setAdjust}`} série (ajuste)
              </span>
            )}
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
              <span className="row" style={{ gap: 6 }}>
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-sm quick-ok"
                  onClick={() => setFeedback({ pump: "bom", volume: "ok", joint: "ok" })}
                >
                  <Icon name="check" size={14} /> Tudo ok
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setFeedback({ skipped: true })}>
                  Pular
                </button>
              </span>
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
                {ex.changed}
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
            <PlanCard
              kind={sug.kind}
              title={sug.title}
              plans={plans}
              unit={entry.unit}
              rir={rirLabel}
              reason={nextReason}
              alerts={sug.notes.length + (lowDay ? 1 : 0)}
            >
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
              {sug.volumeWeight != null && (
                <span className="small sug-note">
                  Séries 2+ (volume): {formatWeight(sug.volumeWeight)} {entry.unit}.
                </span>
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
            </PlanCard>
          )}

          {active && nudges.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="label">Leitura ao vivo</span>
              <NudgeList nudges={nudges} />
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
                    style={{ fontSize: "var(--fs-2)", textTransform: "none" }}
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
            {active && <span className="tiny faint">Toque no número da série para mais ações.</span>}
            <div className="sets-head">
              <span>Série</span>
              <span className="center">Peso · {entry.unit}</span>
              <span className="center">Reps</span>
              <span className="center">Feita</span>
            </div>
            {entry.sets.map((s, i) => {
              const isWork = s.kind !== "warmup";
              // A sugestão aparece só na próxima série a fazer: deixa claro que é um exemplo, não um valor já preenchido.
              const isNext = !s.done && entry.sets.findIndex((x) => !x.done) === i;
              const n = isWork ? ++workCounter : 0;
              const wm = isWork ? null : warmupSpec(sug.weight, warmupCounter++, totalWarmups, step, availableWeights);
              const ph = isWork ? workPlaceholder(n) : null;
              const repsPh = ph ? ph.repsPh : wm!.reps;
              const weightPh = ph ? ph.weightPh : wm!.weight;
              return (
                <SetRow
                  key={s.id}
                  set={s}
                  label={s.kind === "warmup" ? "Aquec." : s.kind === "drop" ? "−15%" : String(n)}
                  unit={entry.unit}
                  active={active}
                  weightPh={weightPh}
                  repsPh={repsPh}
                  hint={isNext}
                  askRir={s.id === askRirId || s.id === rirEdit}
                  rirTarget={rirTarget}
                  onRir={(v) => {
                    setRirEdit(null);
                    setSet(s.id, { rir: v });
                  }}
                  onWeight={(w) => setSet(s.id, { weight: w, suggested: undefined })}
                  onReps={(r) => setSet(s.id, { reps: r })}
                  onToggle={(wv, rv) => toggleDone(s.id, wv, rv, weightPh, repsPh)}
                  onMenu={active ? () => setRadial(s.id) : undefined}
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
                {lastPendingWarmup && (
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    aria-label="Tirar um aquecimento"
                    onClick={() => removeSet(lastPendingWarmup.id)}
                  >
                    − Aquecimento
                  </button>
                )}
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
              /* key: recria o campo quando a anotação muda por fora (ex.: "Intensificador feito" no menu circular). */
              key={entry.notes ?? ""}
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
              <ExerciseDemo libId={ex.lib} />
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
      {radialSet && (
        <RadialMenu
          title={radialSet.kind === "warmup" ? "Aquec." : `S${radialN}`}
          sub={radialSet.done ? `${formatWeight(radialSet.weight)}×${radialSet.reps}` : "pendente"}
          actions={radialActions}
          onClose={() => setRadial(null)}
        />
      )}
    </article>
  );
}
