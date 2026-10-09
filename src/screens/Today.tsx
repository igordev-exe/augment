import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dayCode, dayName, StopBadge, WeekStrip } from "../components/bits";
import { CyberFigure } from "../components/CyberFigure";
import { Icon } from "../components/Icon";
import { DAY_BY_ID, PROGRAM } from "../data/program";
import type { Session } from "../data/types";
import { addDays, formatDuration, fromISO, mondayOf, shortDate, weekdayName, weekdayShort } from "../lib/dates";
import { db } from "../lib/db";
import { useSessions, useSettings, useToday } from "../lib/hooks";
import { defaultRest, setsFor, weekFor, WEEK_RULES } from "../lib/mesocycle";
import { planAhead } from "../lib/schedule";
import { buildSession, sessionStats } from "../lib/sessions";

/** Marca do AUGMENT (a mesma do ícone). */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="96 64 352 384" aria-hidden="true">
      <path d="M96 64h300l52 52v332H148l-52-52z" fill="#ef302c" />
      <path d="M256 128l-92 256h52l18-56h44l18 56h52zm0 92l14 64h-28z" fill="#0c0e11" />
      <circle cx="396" cy="404" r="12" fill="#3fd8e0" />
    </svg>
  );
}

/** Duração estimada: séries × (descanso + ~40 s de execução). */
function estimateMinutes(dayId: string, week: number): number {
  const d = DAY_BY_ID[dayId];
  let sec = 0;
  for (const ex of d.exercises) {
    const n = setsFor(ex, week);
    sec += n * (defaultRest(ex.rest) + 40) + 90; // + aquecimento e troca de aparelho
  }
  return Math.round(sec / 60 / 5) * 5;
}

export function Today() {
  const sessions = useSessions();
  const [settings] = useSettings();
  const today = useToday();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  if (!sessions) return null;

  const week = weekFor(settings.mesoStart, today);
  const rule = WEEK_RULES[week];
  const active = sessions.find((s) => s.status === "active");
  const plan = planAhead(sessions, today, 14, settings.trainingDays);
  const next = plan[0];
  const dayId = picked ?? next?.dayId ?? PROGRAM[0].id;
  const day = DAY_BY_ID[dayId];
  const dayIdx = PROGRAM.findIndex((d) => d.id === dayId) + 1;
  const isToday = next?.date === today;
  const doneToday = sessions.filter((s) => s.status === "done" && s.date === today);
  const lastDone = [...sessions]
    .filter((s) => s.status === "done")
    .sort((a, b) => (a.date === b.date ? b.startedAt - a.startedAt : a.date < b.date ? 1 : -1))[0];

  async function start(from?: Session) {
    if (active) {
      navigate(`/treino/${active.id}`);
      return;
    }
    const s = buildSession(from?.dayId ?? dayId, today, week, settings, sessions!, from);
    await db.sessions.add(s);
    navigate(`/treino/${s.id}`);
  }

  const monday = mondayOf(today);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const doneThisWeek = sessions.filter((s) => s.status === "done" && s.date >= monday && s.date < addDays(monday, 7)).length;
  const missionLabel = doneToday.length
    ? `Hoje já foi ${dayName(doneToday[0].dayId)}. Próxima missão`
    : picked
      ? "Missão escolhida"
      : isToday
        ? "Missão do dia"
        : `Descanso hoje. Próxima: ${next ? `${weekdayName(next.date)}, ${shortDate(next.date)}` : "—"}`;

  return (
    <div className="stack-lg">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="AUGMENT">
          <BrandMark />
          <span className="brand-name">
            AUGMENT<i>.</i>
          </span>
        </Link>
        <div className="row" style={{ gap: 10 }}>
          <span className="status">
            <span className="status-dot ok" /> Local / ativo
          </span>
          <Link to="/ajustes" className="avatar" aria-label="Ajustes e perfil">
            <img src={`${import.meta.env.BASE_URL}avatar.png`} alt="" width={34} height={34} />
          </Link>
        </div>
      </header>

      <div className="stack" style={{ gap: 8 }}>
        <div className="eyebrow">Sistema online / {weekdayName(today)}, {shortDate(today)}</div>
        <p className="h-hero" aria-hidden="true">
          Beyond
          <br />
          limits<span style={{ color: "var(--red)" }}>.</span>
        </p>
        <p className="small muted">
          {settings.operator ? `Operador: ${settings.operator}. ` : ""}Seu corpo é o hardware. Cada série registrada é uma atualização.
        </p>
      </div>

      {active && (
        <Link to={`/treino/${active.id}`} data-augmented-ui="tl-clip br-clip border" className="card hot" style={{ textDecoration: "none" }}>
          <div className="spread">
            <div>
              <div className="label">Missão em andamento</div>
              <div className="display" style={{ fontSize: 26, marginTop: 6 }}>
                {dayName(active.dayId)}
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                Começou há {formatDuration(Date.now() - active.startedAt)}, {sessionStats(active).sets} séries feitas
              </div>
            </div>
            <span data-augmented-ui="tl-clip br-clip border" className="btn btn-primary">
              Continuar <span className="arrow">&gt;</span>
            </span>
          </div>
        </Link>
      )}

      {!active && (
        <section className="stack">
          <div data-augmented-ui="tl-clip br-clip border" className="mission">
            <CyberFigure className="figure" />
            <div className="mission-top">
              <span className="mission-tag">{missionLabel}</span>
              <span className="mission-code">EXO.PROTOCOL / {day.code}</span>
            </div>
            <div className="mission-body">
              <div className="mission-label">
                Protocolo {String(dayIdx).padStart(2, "0")} // {day.focus}
              </div>
              <h1>{day.name}</h1>
              <div className="mission-meta">
                <span>
                  <Icon name="barbell" size={15} /> {day.exercises.length} módulos
                </span>
                <span>
                  <Icon name="clock" size={15} /> ~{estimateMinutes(day.id, week)} min
                </span>
                <span>
                  <Icon name="chart" size={15} /> {rule.label}
                </span>
              </div>
            </div>
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-light" onClick={() => start()}>
              Iniciar protocolo <span className="arrow">&gt;</span>
            </button>
            <span className="sticker">
              Bio / mod {String(dayIdx).padStart(2, "0")}
              <br />
              Human enhancement
            </span>
          </div>

          {!picking ? (
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" onClick={() => setPicking(true)}>
              Trocar o protocolo de hoje
            </button>
          ) : (
            <div data-augmented-ui="tl-clip br-clip border" className="card flat stack">
              <div className="small muted">
                A sequência não pula treino: se faltar um dia, o próximo continua de onde parou.
              </div>
              <div className="row-wrap">
                {PROGRAM.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="toggle-chip"
                    aria-pressed={d.id === dayId}
                    onClick={() => setPicked(d.id === next?.dayId ? null : d.id)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="spread" style={{ marginTop: 6 }}>
            <span className="label" style={{ color: "var(--red-hi)" }}>
              [ {String(dayIdx).padStart(2, "0")} ] Módulos do protocolo
            </span>
            <span className="label">Sys.0{dayIdx} // no excuses</span>
          </div>
          <ol data-augmented-ui="tl-clip br-clip border" className="list">
            {day.exercises.map((ex, i) => (
              <li key={ex.id} className="list-item" style={{ paddingBlock: 11 }}>
                <span className="idx">{ex.superset ? (ex.superset.order === 1 ? "A1" : "A2") : String(i + 1).padStart(2, "0")}</span>
                <span className="grow">
                  <span style={{ fontWeight: 600, display: "block", lineHeight: 1.25 }}>
                    {ex.name.replace(/^A[12] · /, "")}
                    {ex.up && week >= 4 && week <= 6 && <span className="plus">▲</span>}
                  </span>
                  <span className="mono faint" style={{ fontSize: 12 }}>
                    {setsFor(ex, week)}×{ex.reps[0]}–{ex.reps[1]}
                    {ex.perSide ? " por lado" : ""}, {ex.restLabel.toLowerCase()}
                  </span>
                </span>
                <StopBadge stop={ex.stop} week={week} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
        <div className="spread">
          <div>
            <h2 className="h-sec">Ciclo do mesociclo</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {rule.summary}
            </p>
          </div>
          <span className="display" style={{ fontSize: 26, color: "var(--red-hi)" }}>
            {week === 7 ? "D" : `0${week}`}
          </span>
        </div>
        <WeekStrip week={week} />
        <div data-augmented-ui="br-clip border" className="stats">
          <div className="stat">
            <span className="label">Compostos</span>
            <span className="small" style={{ fontWeight: 600 }}>{rule.compounds}</span>
          </div>
          <div className="stat">
            <span className="label">Isolados</span>
            <span className="small" style={{ fontWeight: 600 }}>{rule.isolations}</span>
          </div>
          <div className="stat">
            <span className="label">Intensif.</span>
            <span className="small" style={{ fontWeight: 600 }}>{rule.intensifierLabel}</span>
          </div>
        </div>
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <div className="spread">
          <h2 className="h-sec">Ciclo semanal</h2>
          <Link to="/historico" className="label" style={{ color: "var(--red-hi)", textDecoration: "none" }}>
            Agenda &gt;
          </Link>
        </div>
        <div className="days">
          {weekDates.map((d) => {
            const done = sessions.find((s) => s.status === "done" && s.date === d);
            const planned = plan.find((p) => p.date === d);
            const cls = done ? "done" : planned ? "planned" : "rest";
            const content = done ? dayCode(done.dayId) : planned ? dayCode(planned.dayId) : "—";
            const wd = fromISO(d).getDay();
            const inner = (
              <>
                <small>{fromISO(d).getDate()}</small>
                {content}
              </>
            );
            return (
              <div key={d} className="day-cell">
                <span>{weekdayShort(wd)}</span>
                {done ? (
                  <Link to={`/treino/${done.id}`} data-augmented-ui="tl-clip br-clip border" className={`day-dot ${cls}${d === today ? " today" : ""}`}>
                    {inner}
                  </Link>
                ) : (
                  <span data-augmented-ui="tl-clip br-clip border" className={`day-dot ${cls}${d === today ? " today" : ""}`}>
                    {inner}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="spread">
            <span className="label">Meta semanal</span>
            <span className="mono small">
              <strong style={{ color: "#fff" }}>{doneThisWeek}</strong> / {settings.trainingDays.length} treinos
            </span>
          </div>
          <div className="seg-track">
            <div className="seg-bar" style={{ width: `${Math.min(100, (doneThisWeek / settings.trainingDays.length) * 100)}%` }} />
          </div>
        </div>
      </section>

      {lastDone && !active && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack">
          <div className="spread">
            <div>
              <div className="label">Última missão</div>
              <div className="h-card" style={{ marginTop: 4 }}>
                {dayName(lastDone.dayId)}, {weekdayName(lastDone.date)} {shortDate(lastDone.date)}
              </div>
              <div className="small muted">
                {sessionStats(lastDone).sets} séries em {formatDuration(sessionStats(lastDone).duration)}
              </div>
            </div>
            <Link to={`/treino/${lastDone.id}`} data-augmented-ui="tl-clip br-clip border" className="icon-btn" aria-label="Ver treino">
              <Icon name="chev" size={18} />
            </Link>
          </div>
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={() => start(lastDone)}>
            <Icon name="repeat" size={17} /> Repetir com as mesmas cargas
          </button>
        </section>
      )}

      {sessions.length === 0 && (
        <div className="callout">
          Primeiro uso: inicie o protocolo e anote peso e reps de cada série. A partir do segundo treino, o AUGMENT mostra a última vez ao
          lado e sugere quando subir a carga.
        </div>
      )}

      <footer className="sysfoot" aria-hidden="true">
        <span>AUGMENT // human performance division</span>
        <span className="barcode" />
        <span>
          生体 / 0{week === 7 ? "D" : week}
          <br />
          Access granted
        </span>
      </footer>
    </div>
  );
}
