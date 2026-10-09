import { Link } from "react-router-dom";
import { dayName, PageHead } from "../components/bits";
import { Icon } from "../components/Icon";
import { EXERCISE_BY_ID, MUSCLE_LABEL, MUSCLE_ORDER, PROGRAM } from "../data/program";
import { addDays, mondayOf, shortDate } from "../lib/dates";
import { useSessions, useSettings, useToday } from "../lib/hooks";
import { weekFor } from "../lib/mesocycle";
import { formatWeight, historyOf, mainLoad, prsInSession, workSets } from "../lib/progression";
import { plannedVolume, weeklyVolume } from "../lib/sessions";
import { shortName } from "./SessionScreen";

export function Progress() {
  const sessions = useSessions();
  const [settings] = useSettings();
  const today = useToday();
  if (!sessions) return null;

  const week = weekFor(settings.mesoStart, today);
  const done = sessions.filter((s) => s.status === "done");
  const vol = weeklyVolume(done, today);
  const plan = plannedVolume(week);

  // Treinos por semana (últimas 8)
  const monday = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i)));
  const perWeek = weeks.map((w) => ({
    w,
    n: done.filter((s) => s.date >= w && s.date < addDays(w, 7)).length,
  }));
  const maxN = Math.max(5, ...perWeek.map((p) => p.n));

  // Recordes recentes
  const sorted = [...done].sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1));
  const recent = sorted
    .slice(0, 20)
    .flatMap((s) => prsInSession(s, done).map((p) => ({ ...p, date: s.date })))
    .slice(0, 12);

  return (
    <div className="stack-lg">
      <PageHead code="AUG.OS // TELEMETRIA" title="Progresso" sub="Volume da semana, recordes e evolução por exercício." />

      <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
        <div>
          <h2 className="h-sec">Séries desta semana</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Séries de trabalho feitas por músculo. O traço marca o que a ficha pede na semana {week === 7 ? "de deload" : week}.
          </p>
        </div>
        <div className="stack" style={{ gap: 9 }}>
          {MUSCLE_ORDER.map((m) => {
            const target = plan[m];
            const scale = Math.max(target, vol[m], 1) * 1.1;
            return (
              <div key={m} className="vol">
                <span className="small">{MUSCLE_LABEL[m]}</span>
                <span className="vol-track" aria-hidden="true">
                  <span className="vol-fill" style={{ width: `${(vol[m] / scale) * 100}%` }} />
                  <span className="vol-target" style={{ left: `${(target / scale) * 100}%` }} />
                </span>
                <span className="small num" style={{ textAlign: "right" }}>
                  {vol[m]}/{target}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
        <h2 className="h-sec">Treinos por semana</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, alignItems: "end", height: 110 }}>
          {perWeek.map((p) => (
            <div
              key={p.w}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}
            >
              <span className="tiny num muted">{p.n}</span>
              <span
                title={`${p.n} treinos na semana de ${shortDate(p.w)}`}
                style={{
                  width: "100%",
                  maxWidth: 28,
                  height: `${(p.n / maxN) * 70}px`,
                  minHeight: p.n ? 4 : 2,
                  background: p.n ? "repeating-linear-gradient(0deg, var(--purple) 0 3px, transparent 3px 5px)" : "var(--line)",
                }}
              />
              <span className="tiny faint">{shortDate(p.w).split(" ")[0]}</span>
            </div>
          ))}
        </div>
        <p className="tiny faint">Semanas começando na segunda. A ficha pede 5 treinos por semana.</p>
      </section>

      <section className="stack">
        <h2 className="h-sec">Recordes recentes</h2>
        {recent.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
            Recordes aparecem a partir da segunda vez que você faz cada exercício: a primeira vira a linha de base.
          </div>
        ) : (
          <ul data-augmented-ui="tl-clip br-clip border" className="list">
            {recent.map((p, i) => (
              <li key={i}>
                <Link to={`/exercicios/${EXERCISE_BY_ID[p.exId]?.lib}`} className="list-item">
                  <span style={{ color: "var(--cyan)" }}>
                    <Icon name="trophy" size={20} />
                  </span>
                  <span className="grow small">
                    <strong>{shortName(EXERCISE_BY_ID[p.exId])}</strong> <span className="faint">{shortDate(p.date)}</span>
                    <br />
                    {p.text}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack">
        <h2 className="h-sec">Cargas atuais</h2>
        {PROGRAM.map((d) => (
          <div key={d.id} className="stack" style={{ gap: 6 }}>
            <div className="label">{dayName(d.id)}</div>
            <ul data-augmented-ui="tl-clip br-clip border" className="list">
              {d.exercises.map((ex) => {
                const h = historyOf(done, ex.id);
                const last = h[h.length - 1];
                const load = last ? mainLoad(workSets(last.entry, false)) : null;
                const first = h[0] ? mainLoad(workSets(h[0].entry, false)) : null;
                const delta = load != null && first != null && h.length > 1 ? load - first : null;
                return (
                  <li key={ex.id}>
                    <Link to={`/exercicios/${ex.lib}`} className="list-item" style={{ paddingBlock: 10 }}>
                      <span className="grow small" style={{ fontWeight: 500 }}>
                        {shortName(ex)}
                      </span>
                      {load != null ? (
                        <span className="small num">
                          <strong>
                            {formatWeight(load)} {last!.entry.unit}
                          </strong>
                          {delta != null && delta !== 0 && (
                            <span style={{ color: delta > 0 ? "var(--cyan)" : "var(--amber)", marginLeft: 6 }}>
                              {delta > 0 ? "+" : ""}
                              {formatWeight(delta)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="small faint">sem registro</span>
                      )}
                      <span className="chev">
                        <Icon name="chev" size={16} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="tiny faint">A diferença compara a carga de trabalho atual com a do primeiro registro.</p>
      </section>
    </div>
  );
}
