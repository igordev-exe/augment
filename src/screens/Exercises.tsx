import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/bits";
import { exerciseImages } from "../components/ExerciseDemo";
import { whyLabel } from "../components/NudgeList";
import { LIBRARY, LIB_BY_ID, LIB_MUSCLES } from "../data/library";
import { EQUIP_LABEL, EXTENDED, EXT_BY_ID } from "../data/library-extended";
import { MUSCLE_LABEL, programDays } from "../data/program";
import { EXERCISE_EVIDENCE, PRINCIPLES } from "../data/science";
import type { MuscleId, ProgramExercise } from "../data/types";
import { useProgram, useSessions } from "../lib/hooks";
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
  { id: "bracos", label: "Braços", muscles: ["biceps", "triceps", "antebraco"] },
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

/** Grupo de equipamento de um exercício da biblioteca ampliada. */
function extEquip(key: string): Exclude<Equip, "todos"> {
  return key === "polia" ? "cabo" : key === "maquina" ? "maquina" : key === "halteres" ? "halteres" : "livre";
}

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
  /** Curada (34, em português, com execução e evidência) ou completa (com a ampliada, em inglês). */
  const [full, setFull] = useState(false);
  const query = norm(q.trim());

  // Um cartão por exercício: primeiro os do programa em uso, na ordem dele (a flexora pode aparecer em dois dias),
  // depois o resto da biblioteca. Exercício personalizado do programa também aparece.
  const program = useProgram();
  const items = useMemo(() => {
    const seen = new Map<string, ProgramExercise[]>();
    for (const d of programDays()) for (const ex of d.exercises) seen.set(ex.lib, [...(seen.get(ex.lib) ?? []), ex]);
    for (const l of LIBRARY) if (!seen.has(l.id)) seen.set(l.id, []);
    if (full) for (const e of EXTENDED) if (!seen.has(e.id)) seen.set(e.id, []);
    return [...seen.entries()].map(([lib, exs]) => ({
      lib,
      exs,
      name: (exs[0]?.name ?? LIB_BY_ID[lib]?.name ?? EXT_BY_ID[lib]?.name ?? lib).replace(/^A[12] · /, ""),
      muscles: exs.length ? [...new Set(exs.flatMap((e) => e.muscles))] : (LIB_MUSCLES[lib] ?? EXT_BY_ID[lib]?.muscles ?? []),
      inProgram: exs.length > 0,
      equipGroup: EXT_BY_ID[lib] ? extEquip(EXT_BY_ID[lib].equip) : equipOf(LIB_BY_ID[lib]?.equipment ?? ""),
      equipLabel: EXT_BY_ID[lib] ? (EQUIP_LABEL[EXT_BY_ID[lib].equip] ?? "Outro") : undefined,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, full]);

  const done = (sessions ?? []).filter((s) => s.status === "done");
  const inGroup = (g: Group, muscles: MuscleId[]) =>
    g === "todos" || muscles.some((m) => GROUPS.find((x) => x.id === g)!.muscles.includes(m));
  const countGroup = (g: Group) => items.filter(({ muscles }) => inGroup(g, muscles)).length;
  const shown = items.filter(({ lib, name, muscles, equipGroup }) => {
    const l = LIB_BY_ID[lib];
    if (!inGroup(group, muscles)) return false;
    if (equip !== "todos" && equipGroup !== equip) return false;
    const label = muscles.map((m) => MUSCLE_LABEL[m]).join(" ");
    if (query && !norm(`${name} ${label} ${l?.primary ?? ""} ${l?.secondary ?? ""}`).includes(query)) return false;
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

      <div className="stack" style={{ gap: 8 }}>
        <div className="ws-switch" role="group" aria-label="Biblioteca">
          <button type="button" aria-pressed={!full} onClick={() => setFull(false)}>
            Curada · {LIBRARY.length}
          </button>
          <button type="button" aria-pressed={full} onClick={() => setFull(true)}>
            Completa · {LIBRARY.length + EXTENDED.length}
          </button>
        </div>
        {full && (
          <p className="tiny faint" style={{ margin: 0 }}>
            A completa inclui ~{Math.round(EXTENDED.length / 10) * 10} exercícios do free-exercise-db, com nome e passo a passo em inglês.
            As fotos baixam na primeira vez.
          </p>
        )}
        <div className="ws-brackets" role="group" aria-label="Filtrar por músculo">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" className="ws-bracket" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label}
              <small>{countGroup(g.id)}</small>
            </button>
          ))}
        </div>
        <div className="ws-switch" role="group" aria-label="Filtrar por equipamento">
          {EQUIPS.map((e) => (
            <button key={e.id} type="button" aria-pressed={equip === e.id} onClick={() => setEquip(e.id)}>
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
        {shown.slice(0, full ? 120 : undefined).map(({ lib, exs, name, muscles, inProgram, equipGroup, equipLabel }) => {
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
            <Link
              key={lib}
              to={`/exercicios/${lib}`}
              data-augmented-ui="tl-clip br-clip border"
              className={`ws-card${inProgram ? "" : " off-program"}`}
            >
              <span className="ws-photo">{img ? <img src={img} alt="" loading="lazy" /> : null}</span>
              {ev && (
                <span className={`ws-tag ${LEVEL[ev.why] === "evidencia" ? "ok" : "warn"}`} title={whyLabel(ev.why) ?? undefined}>
                  {ev.tag}
                </span>
              )}
              <span className="ws-name">{name}</span>
              <span className="ws-muscle">
                {muscles.map((m) => MUSCLE_LABEL[m]).join(" e ") || "—"} · {equipLabel ?? EQUIPS.find((e) => e.id === equipGroup)!.label}
                {!inProgram && " · fora do programa"}
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
      {full && shown.length > 120 && (
        <p className="small muted">Mostrando 120 de {shown.length}. Use a busca ou os filtros para achar o resto.</p>
      )}
    </div>
  );
}
