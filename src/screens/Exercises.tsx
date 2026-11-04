import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/bits";
import { exerciseImages } from "../components/ExerciseDemo";
import { whyLabel } from "../components/NudgeList";
import { LIB_BY_ID } from "../data/library";
import { PROGRAM } from "../data/program";
import { EXERCISE_EVIDENCE, PRINCIPLES } from "../data/science";
import type { MuscleId, ProgramExercise } from "../data/types";
import { useSessions } from "../lib/hooks";
import { bestE1rm, formatWeight, historyOf, loadRef, workSets } from "../lib/progression";

// Biblioteca no estilo oficina: filtros por músculo e equipamento, grade de cartões com foto,
// números do seu histórico (1RM estimado e última carga) e etiqueta de evidência quando o exercício tem uma.

type Group = "todos" | "peito" | "costas" | "ombros" | "bracos" | "pernas" | "core";
type Equip = "todos" | "cabo" | "maquina" | "halteres" | "livre";

const GROUPS: { id: Group; label: string; muscles: MuscleId[] }[] = [
  { id: "todos", label: "Todos", muscles: [] },
  { id: "peito", label: "Peito", muscles: ["peito"] },
  { id: "costas", label: "Costas", muscles: ["costas", "trapezio"] },
  { id: "ombros", label: "Ombros", muscles: ["deltLateral", "deltAnterior", "deltPosterior"] },
  { id: "bracos", label: "Braços", muscles: ["biceps", "triceps"] },
  { id: "pernas", label: "Pernas", muscles: ["quadriceps", "posterior", "gluteo", "panturrilha"] },
  { id: "core", label: "Core", muscles: ["abdomen"] },
];
const EQUIPS: { id: Equip; label: string }[] = [
  { id: "todos", label: "Tudo" },
  { id: "cabo", label: "Cabo" },
  { id: "maquina", label: "Máquina" },
  { id: "halteres", label: "Halteres" },
  { id: "livre", label: "Livre" },
];

/** Classifica o equipamento pelo texto da biblioteca (o primeiro que bater, na ordem). */
export function equipOf(text: string): Exclude<Equip, "todos"> {
  if (/polia|pulley|crossover/i.test(text)) return "cabo";
  if (/m[aá]quina|hack|leg press|cadeira|peck|smith/i.test(text)) return "maquina";
  if (/halter/i.test(text)) return "halteres";
  return "livre";
}

const LEVEL = Object.fromEntries(PRINCIPLES.map((p) => [p.id, p.nivel]));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Exercises() {
  const sessions = useSessions();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<Group>("todos");
  const [equip, setEquip] = useState<Equip>("todos");
  const query = norm(q.trim());

  // Um cartão por exercício da biblioteca, na ordem da ficha (a flexora sentada aparece em dois dias).
  const items = useMemo(() => {
    const seen = new Map<string, ProgramExercise[]>();
    for (const d of PROGRAM) for (const ex of d.exercises) seen.set(ex.lib, [...(seen.get(ex.lib) ?? []), ex]);
    return [...seen.entries()].map(([lib, exs]) => ({ lib, exs }));
  }, []);

  const done = (sessions ?? []).filter((s) => s.status === "done");
  const shown = items.filter(({ lib, exs }) => {
    const l = LIB_BY_ID[lib];
    if (group !== "todos" && !exs.some((e) => e.muscles.some((m) => GROUPS.find((g) => g.id === group)!.muscles.includes(m)))) return false;
    if (equip !== "todos" && equipOf(l?.equipment ?? "") !== equip) return false;
    if (query && !norm(`${exs[0].name} ${exs[0].muscleLabel} ${l?.primary ?? ""} ${l?.secondary ?? ""}`).includes(query)) return false;
    return true;
  });

  return (
    <div className="stack-lg">
      <PageHead
        code="AUG.OS // OFICINA DE MÓDULOS"
        title="Exercícios"
        sub="Execução, erros comuns, vídeo e progresso de cada exercício da ficha."
      />
      <input
        className="input"
        type="search"
        placeholder="Buscar exercício ou músculo"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar exercício"
      />

      <div className="stack" style={{ gap: 6 }}>
        <div className="ws-filters" role="group" aria-label="Filtrar por músculo">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="ws-filter"
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="ws-filters" role="group" aria-label="Filtrar por equipamento">
          {EQUIPS.map((e) => (
            <button
              key={e.id}
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="ws-filter small"
              aria-pressed={equip === e.id}
              onClick={() => setEquip(e.id)}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="spread">
        <span className="label">{shown.length} módulos</span>
        <span className="tiny faint">1RM est. · última carga</span>
      </div>

      <div className="ws-grid">
        {shown.map(({ lib, exs }) => {
          const l = LIB_BY_ID[lib];
          // Histórico do exercício mais recente entre os dias em que ele aparece.
          const hist =
            exs
              .map((e) => historyOf(done, e.id))
              .sort((a, b) => (b[b.length - 1]?.session.date ?? "").localeCompare(a[a.length - 1]?.session.date ?? ""))[0] ?? [];
          const last = hist[hist.length - 1];
          const best = hist.length ? Math.max(...hist.map((h) => bestE1rm(h.entry))) : 0;
          const lastLoad = last
            ? loadRef(workSets(last.entry, false).length ? workSets(last.entry, false) : workSets(last.entry)).load
            : null;
          const ev = EXERCISE_EVIDENCE[lib];
          const img = exerciseImages(lib)[0];
          return (
            <Link key={lib} to={`/exercicios/${lib}`} data-augmented-ui="tl-clip br-clip border" className="ws-card">
              <span className="ws-photo">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
              {ev && (
                <span className={`ws-tag ${LEVEL[ev.why] === "evidencia" ? "ok" : "warn"}`} title={whyLabel(ev.why) ?? undefined}>
                  {ev.tag}
                </span>
              )}
              <span className="ws-name">{exs[0].name.replace(/^A[12] · /, "")}</span>
              <span className="ws-muscle">
                {exs[0].muscleLabel} · {EQUIPS.find((e) => e.id === equipOf(l?.equipment ?? ""))!.label}
              </span>
              <span className="ws-stats">
                <span>
                  1RM <b>{best ? `${Math.round(best)}` : "—"}</b>
                </span>
                <span>
                  <b>{lastLoad != null ? formatWeight(lastLoad) : "—"}</b> {last?.entry.unit ?? "kg"}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      {shown.length === 0 && <p className="small muted">Nenhum exercício com esses filtros.</p>}
    </div>
  );
}
