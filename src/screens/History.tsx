import { useState } from "react";
import { Link } from "react-router-dom";
import { dayCode, dayName, PageHead } from "../components/bits";
import { Icon } from "../components/Icon";
import { addDays, formatDuration, fromISO, monthName, mondayOf, shortDate, toISO, weekdayShort } from "../lib/dates";
import { useSessions, useSettings, useToday } from "../lib/hooks";
import { weekFor } from "../lib/mesocycle";
import { prsInSession } from "../lib/progression";
import { planAhead } from "../lib/schedule";
import { sessionStats } from "../lib/sessions";

export function History() {
  const sessions = useSessions();
  const [settings] = useSettings();
  const today = useToday();
  const [cursor, setCursor] = useState(() => {
    const d = fromISO(today);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  if (!sessions) return null;

  const done = sessions
    .filter((s) => s.status === "done")
    .sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1));
  const plan = planAhead(sessions, today, 70, settings.trainingDays);

  // Grade do mês (semanas começando na segunda).
  const first = toISO(new Date(cursor.y, cursor.m, 1));
  const gridStart = mondayOf(first);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i));
    if (w > 3 && fromISO(row[0]).getMonth() !== cursor.m) break;
    weeks.push(row);
  }

  const monthSessions = done.filter((s) => {
    const d = fromISO(s.date);
    return d.getFullYear() === cursor.y && d.getMonth() === cursor.m;
  });

  function shift(n: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <div className="stack-lg">
      <PageHead code="AUG.OS // REGISTRO DE MISSÕES" title="Histórico" sub={`${done.length} treinos registrados.`} />

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <div className="spread">
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="icon-btn"
            aria-label="Mês anterior"
            onClick={() => shift(-1)}
          >
            <Icon name="back" size={18} />
          </button>
          <div className="h-sec" style={{ textTransform: "capitalize" }}>
            {monthName(cursor.m)} {cursor.y}
          </div>
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="icon-btn"
            aria-label="Próximo mês"
            onClick={() => shift(1)}
          >
            <Icon name="chev" size={18} />
          </button>
        </div>

        <div className="cal" role="grid" aria-label="Agenda de treinos">
          <span className="hd" title="Semana do mesociclo">
            S
          </span>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <span key={wd} className="hd">
              {weekdayShort(wd)}
            </span>
          ))}
          {weeks.map((row) => {
            const wk = weekFor(settings.mesoStart, row[0]);
            const beforeStart = row[6] < settings.mesoStart;
            return [
              <span
                key={row[0] + "w"}
                className={`wk${wk === 7 && !beforeStart ? " deload" : ""}`}
                title={beforeStart ? "Antes do mesociclo" : wk === 7 ? "Deload" : `Semana ${wk}`}
              >
                {beforeStart ? "·" : wk === 7 ? "D" : wk}
              </span>,
              ...row.map((d) => {
                const daySessions = done.filter((s) => s.date === d);
                const planned = plan.find((p) => p.date === d);
                const out = fromISO(d).getMonth() !== cursor.m;
                const cls = `cell${out ? " out" : ""}${d === today ? " today" : ""}`;
                const inner = (
                  <>
                    <span className="d">{fromISO(d).getDate()}</span>
                    {daySessions.map((s) => (
                      <span key={s.id} className="code done">
                        {dayCode(s.dayId)}
                      </span>
                    ))}
                    {!daySessions.length && planned && <span className="code planned">{dayCode(planned.dayId)}</span>}
                  </>
                );
                return daySessions.length === 1 ? (
                  <Link key={d} to={`/treino/${daySessions[0].id}`} data-augmented-ui="tl-clip border" className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <div key={d} data-augmented-ui="tl-clip border" className={cls}>
                    {inner}
                  </div>
                );
              }),
            ];
          })}
        </div>
        <div className="legend">
          <span>
            <span className="cal">
              <span className="code done">PA</span>
            </span>{" "}
            feito
          </span>
          <span>
            <span className="cal">
              <span className="code planned">PL</span>
            </span>{" "}
            planejado
          </span>
          <span>S = semana do mesociclo, D = deload</span>
        </div>
      </section>

      <section className="stack">
        <h2 className="h-sec">Treinos de {monthName(cursor.m)}</h2>
        {monthSessions.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
            Nenhum treino concluído neste mês.
          </div>
        ) : (
          <ul data-augmented-ui="tl-clip br-clip border" className="list">
            {monthSessions.map((s) => {
              const st = sessionStats(s);
              const prs = prsInSession(s, sessions);
              return (
                <li key={s.id}>
                  <Link to={`/treino/${s.id}`} className="list-item">
                    <span className="display" style={{ fontSize: 17, width: 34, color: "var(--red-hi)" }}>
                      {dayCode(s.dayId)}
                    </span>
                    <span className="grow">
                      <span className="h-card">{dayName(s.dayId)}</span>
                      <span className="small muted" style={{ display: "block" }}>
                        {shortDate(s.date)}, {st.sets} séries em {formatDuration(st.duration)}
                        {s.week === 7 ? ", deload" : `, semana ${s.week}`}
                      </span>
                    </span>
                    {prs.length > 0 && (
                      <span data-augmented-ui="br-clip border" className="chip go">
                        <Icon name="trophy" size={14} /> {prs.length}
                      </span>
                    )}
                    <span className="chev">
                      <Icon name="chev" size={18} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
