import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { PageHead } from "../components/bits";
import { HoldButton } from "../components/HoldButton";
import { TEMPLATES } from "../data/templates";
import type { Program } from "../data/types";
import { activateProgram, deleteProgram, saveProgram } from "../lib/db";
import { usePrograms, useProgram, useSessions, useToast } from "../lib/hooks";
import { blankProgram, duplicateProgram, fromTemplate } from "../lib/program-edit";

// Programas salvos: qual está em uso, editar, duplicar, apagar, e criar a partir de um modelo ou do zero.

function summary(p: Program): string {
  const exs = p.days.reduce((n, d) => n + d.exercises.length, 0);
  return `${p.days.length} ${p.days.length === 1 ? "dia" : "dias"} · ${exs} exercícios · ${p.periodization === "fixed" ? "fixo" : "mesociclo 6 + 1"}`;
}

export function Programs() {
  const programs = usePrograms();
  const active = useProgram();
  const sessions = useSessions();
  const toast = useToast();
  const navigate = useNavigate();

  if (!programs) return null;
  const list = [...programs].sort((a, b) => (a.id === active.id ? -1 : b.id === active.id ? 1 : b.updatedAt - a.updatedAt));
  const running = sessions?.some((s) => s.status === "active");

  async function create(p: Program) {
    await saveProgram(p);
    navigate(`/programas/${p.id}`);
  }

  async function use(p: Program) {
    await activateProgram(p.id);
    toast(`${p.name} em uso. O histórico continua, e a agenda segue a ordem dos dias deste programa.`, "ok");
  }

  return (
    <div className="stack-lg">
      <PageHead
        back="/ajustes"
        code="AUG.OS // PROGRAMAS"
        title="Programas"
        sub="O programa em uso define os treinos, a ordem da agenda e a meta de séries de cada músculo."
      />

      {running && (
        <div className="callout warn">Há um treino em andamento. Ele continua como começou; trocar de programa vale para os próximos.</div>
      )}

      <section className="stack">
        {list.map((p) => {
          const isActive = p.id === active.id;
          return (
            <article key={p.id} data-augmented-ui="tl-clip br-clip border" className={`card stack pg-card${isActive ? " on" : ""}`}>
              <div className="spread">
                <div className="stack" style={{ gap: 2 }}>
                  <strong className="pg-name">{p.name}</strong>
                  <span className="tiny faint">{summary(p)}</span>
                </div>
                {isActive && <span className="pg-tag">EM USO</span>}
              </div>
              <div className="pg-days" aria-label="Dias">
                {p.days.map((d) => (
                  <span key={d.id} title={d.name}>
                    {d.code}
                  </span>
                ))}
              </div>
              <div className="row-wrap">
                <Link to={`/programas/${p.id}`} data-augmented-ui="tl-clip br-clip border" className="btn btn-sm grow">
                  Editar <span className="arrow">&gt;</span>
                </Link>
                {!isActive && (
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-primary grow"
                    onClick={() => use(p)}
                  >
                    Usar este
                  </button>
                )}
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-sm btn-ghost"
                  onClick={() => create(duplicateProgram(p))}
                >
                  Duplicar
                </button>
              </div>
              {!isActive && (
                <HoldButton
                  className="btn-danger btn-sm"
                  label={`Apagar ${p.name}`}
                  onConfirm={async () => {
                    await deleteProgram(p.id);
                    toast("Programa apagado. Os treinos feitos com ele continuam no histórico.", "info");
                  }}
                >
                  Apagar programa
                </HoldButton>
              )}
            </article>
          );
        })}
      </section>

      <section className="stack">
        <h2 className="h-sec">Novo programa</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Um modelo vira uma cópia sua: dá para trocar exercícios, séries e dias depois.
        </p>
        {TEMPLATES.map((t) => (
          <article key={t.id} data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 8 }}>
            <div className="spread">
              <strong>{t.name}</strong>
              <span className="tiny faint">
                {t
                  .make(0)
                  .days.map((d) => d.code)
                  .join(" · ")}
              </span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {t.pitch}
            </p>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-sm"
              onClick={() => create(fromTemplate(t.make()))}
            >
              Usar este modelo <span className="arrow">&gt;</span>
            </button>
          </article>
        ))}
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" onClick={() => create(blankProgram())}>
          Começar do zero
        </button>
      </section>
    </div>
  );
}
