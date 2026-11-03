import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { dayCode, dayName, PageHead } from "../components/bits";
import { Icon } from "../components/Icon";
import { EXERCISE_BY_ID, MUSCLE_LABEL, shortName } from "../data/program";
import { addDays, mondayOf, shortDate } from "../lib/dates";
import { useSessions, useSettings, useToday } from "../lib/hooks";
import { WEEK_RULES } from "../lib/mesocycle";
import { weeklyReport } from "../lib/report";

function rirLabel([a, b]: [number, number]): string {
  return a === b ? `${a}` : `${a}–${b}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack">
      <h2 className="h-sec">{title}</h2>
      {children}
    </section>
  );
}

/** Relatório da semana: o que saiu do plano e o foco da próxima. Padrão: a última semana fechada. */
export function Report() {
  const { week: param } = useParams();
  const sessions = useSessions();
  const [settings] = useSettings();
  const today = useToday();
  if (!sessions) return null;

  const current = mondayOf(today);
  const weekStart = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? mondayOf(param) : addDays(current, -7);
  const r = weeklyReport(sessions, weekStart, settings.mesoStart, settings.trainingDays);
  const open = weekStart === current;
  const sets = r.sessions.reduce((n, s) => n + s.exercises.reduce((k, e) => k + e.sets.filter((x) => x.kind !== "warmup").length, 0), 0);
  const under = r.volume.filter((v) => v.done < v.planned * 0.7);
  const nothing =
    r.done > 0 &&
    !r.shortfalls.length &&
    !under.length &&
    !r.rir.harder.length &&
    !r.rir.easier.length &&
    !r.stalls.length &&
    !r.signals.length &&
    !r.joints.length;

  return (
    <div className="stack-lg">
      <PageHead
        back="/"
        code="AUG.OS // RELATÓRIO"
        title="Relatório"
        sub={
          <>
            {shortDate(weekStart)} a {shortDate(addDays(weekStart, 6))}.{" "}
            {r.mesoWeek == null ? "Antes do mesociclo atual." : `${WEEK_RULES[r.mesoWeek].label} do mesociclo.`}
            {open ? " Semana em andamento." : ""}
          </>
        }
      />

      <div className="spread">
        <Link to={`/relatorio/${addDays(weekStart, -7)}`} className="btn btn-sm btn-ghost" data-augmented-ui="tl-clip br-clip border">
          <Icon name="back" size={14} /> Anterior
        </Link>
        {!open && (
          <Link to={`/relatorio/${addDays(weekStart, 7)}`} className="btn btn-sm btn-ghost" data-augmented-ui="tl-clip br-clip border">
            Próxima <Icon name="chev" size={14} />
          </Link>
        )}
      </div>

      <section data-augmented-ui="tl-clip br-clip border" className="card hot stack" style={{ gap: 6 }}>
        <span className="label">{open ? "Foco até agora" : "Foco da próxima semana"}</span>
        <div className="display" style={{ fontSize: 22 }}>
          {r.focus.title}
        </div>
        <p className="small" style={{ margin: 0 }}>
          {r.focus.detail}
        </p>
        <Link
          to={`/treinador?q=${encodeURIComponent(`Analise o relatório da semana de ${shortDate(weekStart)} a ${shortDate(addDays(weekStart, 6))} (${weekStart}).`)}`}
          className="link-btn"
          style={{ alignSelf: "flex-start" }}
        >
          Discutir com o treinador
        </Link>
      </section>

      <div className="tiles">
        <div data-augmented-ui="tl-clip border" className="tile">
          <span className="label">Treinos</span>
          <span className="v">
            {r.done}
            <small>/{r.planned}</small>
          </span>
        </div>
        <div data-augmented-ui="tl-clip border" className="tile">
          <span className="label">Séries</span>
          <span className="v">{sets}</span>
        </div>
        <div data-augmented-ui="tl-clip border" className="tile">
          <span className="label">Sobra na meta</span>
          <span className="v">
            {r.rir.logged ? (
              <>
                {Math.round((r.rir.inTarget / r.rir.logged) * 100)}
                <small>%</small>
              </>
            ) : (
              "–"
            )}
          </span>
        </div>
      </div>

      {nothing && <div className="callout">Nada importante fora do plano nesta semana.</div>}

      <Section title="Frequência">
        <div className="row-wrap">
          {r.sessions.map((s) => (
            <Link key={s.id} to={`/treino/${s.id}`} data-augmented-ui="br-clip border" className="chip go">
              {dayCode(s.dayId)} · {shortDate(s.date)}
            </Link>
          ))}
          {r.missingDays.map((d) => (
            <span key={d} data-augmented-ui="br-clip border" className="chip warn">
              {dayName(d)}: não feito
            </span>
          ))}
          {!r.sessions.length && <span className="small muted">Nenhum treino registrado.</span>}
        </div>
      </Section>

      {r.prs.length > 0 && (
        <Section title="Recordes">
          <ul data-augmented-ui="tl-clip br-clip border" className="list">
            {r.prs.map((p, i) => (
              <li key={i} className="list-item">
                <span style={{ color: "var(--cyan)" }}>
                  <Icon name="trophy" size={20} />
                </span>
                <span className="grow small">
                  <strong>{shortName(EXERCISE_BY_ID[p.exId])}</strong> <span className="faint">{shortDate(p.date)}</span>
                  <br />
                  {p.text}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.shortfalls.length > 0 && (
        <Section title="Séries que faltaram">
          <ul data-augmented-ui="tl-clip br-clip border" className="list">
            {r.shortfalls.map((s) => (
              <li key={s.date + s.exId} className="list-item small">
                <span className="grow">
                  {shortName(EXERCISE_BY_ID[s.exId])} <span className="faint">{shortDate(s.date)}</span>
                </span>
                <span className="num" style={{ color: "var(--amber)" }}>
                  {s.done === 0 ? "pulado" : `${s.done}/${s.planned}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {r.done > 0 && (
        <Section title="Volume da semana">
          <p className="small muted" style={{ margin: 0 }}>
            Séries de trabalho por músculo. O traço marca a meta da ficha{under.length ? `; ${under.length} abaixo de 70%` : ""}.
          </p>
          <div className="stack" style={{ gap: 9 }}>
            {r.volume.map((v) => {
              const scale = Math.max(v.planned, v.done, 1) * 1.1;
              return (
                <div key={v.muscle} className="vol">
                  <span className="small">{MUSCLE_LABEL[v.muscle]}</span>
                  <span className="vol-track" aria-hidden="true">
                    <span className="vol-fill" style={{ width: `${(v.done / scale) * 100}%` }} />
                    <span className="vol-target" style={{ left: `${(v.planned / scale) * 100}%` }} />
                  </span>
                  <span className="small num" style={{ textAlign: "right", color: v.done < v.planned * 0.7 ? "var(--amber)" : undefined }}>
                    {v.done}/{v.planned}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {r.done > 0 && (
        <Section title="Reps que sobraram">
          {r.rir.logged === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Nenhuma série com "sobraram" marcado. Marque depois de cada série para o relatório comparar com a meta da semana.
            </p>
          ) : (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                {r.rir.inTarget} de {r.rir.logged} séries marcadas ficaram na meta.
              </p>
              {(r.rir.harder.length > 0 || r.rir.easier.length > 0) && (
                <ul data-augmented-ui="tl-clip br-clip border" className="list">
                  {r.rir.harder.map((m) => (
                    <li key={"h" + m.date + m.exId} className="list-item small">
                      <span className="grow">
                        {shortName(EXERCISE_BY_ID[m.exId])} <span className="faint">{shortDate(m.date)}</span>
                      </span>
                      <span style={{ color: "var(--red-hi)" }}>
                        {m.rir === 0 ? "falha" : `sobra ${m.rir}`}, meta {rirLabel(m.target)}
                      </span>
                    </li>
                  ))}
                  {r.rir.easier.map((m) => (
                    <li key={"e" + m.date + m.exId} className="list-item small">
                      <span className="grow">
                        {shortName(EXERCISE_BY_ID[m.exId])} <span className="faint">{shortDate(m.date)}</span>
                      </span>
                      <span style={{ color: "var(--amber)" }}>
                        sobra {m.rir >= 4 ? "4+" : m.rir}, meta {rirLabel(m.target)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>
      )}

      {r.stalls.length > 0 && (
        <Section title="Estagnados">
          <ul data-augmented-ui="tl-clip br-clip border" className="list">
            {r.stalls.map((s) => (
              <li key={s.exId} className="list-item small">
                <span className="grow">
                  <strong>{shortName(EXERCISE_BY_ID[s.exId])}</strong>
                  <br />
                  <span className="faint">{s.trail.join(" → ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(r.signals.length > 0 || r.joints.length > 0) && (
        <Section title="Sinais do corpo">
          {r.signals.map((s) => (
            <div key={s} className="callout warn">
              {s}
            </div>
          ))}
          {r.joints.map((j) => (
            <div key={j.exId} className="callout warn">
              {shortName(EXERCISE_BY_ID[j.exId])}: articulação incomodou {j.times === 1 ? "nesta semana" : `${j.times} vezes em 3 semanas`}.
              {j.alternatives.length ? ` Alternativas: ${j.alternatives.join(", ")}.` : ""}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
