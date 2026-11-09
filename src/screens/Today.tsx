import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dayCode, dayName, StopBadge, WeekStrip } from "../components/bits";
import { SysModule } from "../components/SysModule";
import { HoldButton } from "../components/HoldButton";
import { Icon } from "../components/Icon";
import { dayById, programDays } from "../data/program";
import type { Session } from "../data/types";
import { addDays, bySessionDesc, daysBetween, formatDuration, fromISO, mondayOf, shortDate, weekdayName, weekdayShort } from "../lib/dates";
import { db, exportBackup } from "../lib/db";
import { bootBeam } from "../lib/fx";
import { shareOrDownload } from "../lib/files";
import { useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { fatigueAlert } from "../lib/engine";
import { defaultRest, reentryFor, setsFor, weekFor, WEEK_RULES } from "../lib/mesocycle";
import { weeklyReport } from "../lib/report";
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
function estimateMinutes(dayId: string, week: number, adjust: Record<string, number> = {}): number {
  const d = dayById(dayId);
  let sec = 0;
  for (const ex of d.exercises) {
    const n = setsFor(ex, week, adjust[ex.id]);
    sec += n * (defaultRest(ex.rest) + 40) + 90; // + aquecimento e troca de aparelho
  }
  return Math.round(sec / 60 / 5) * 5;
}

export function Today() {
  const sessions = useSessions();
  const [settings, updateSettings] = useSettings();
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  if (!sessions) return null;

  const week = weekFor(settings.mesoStart, today);
  const rule = WEEK_RULES[week];
  const active = sessions.find((s) => s.status === "active");
  const plan = planAhead(sessions, today, 14, settings.trainingDays);
  const next = plan[0];
  const dayId = picked ?? next?.dayId ?? programDays()[0].id;
  const day = dayById(dayId);
  const dayIdx = programDays().findIndex((d) => d.id === dayId) + 1;
  const isToday = next?.date === today;
  const doneAll = sessions.filter((s) => s.status === "done");
  const doneToday = doneAll.filter((s) => s.date === today);
  const lastDone = [...doneAll].sort(bySessionDesc)[0];

  async function start(from?: Session) {
    bootBeam();
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
  const fixed = week === 0;
  const reentry = fixed
    ? null
    : reentryFor(
        doneAll.map((s) => s.date),
        settings.mesoStart,
        today,
        settings.trainingDays,
        settings.reentryDismissed,
      );
  const fatigue = !reentry && !fixed ? fatigueAlert(doneAll, settings.mesoStart, today, settings.reentryDismissed) : null;
  const lastWeek = addDays(monday, -7);
  const report =
    settings.reportSeen === monday
      ? null
      : weeklyReport(sessions, lastWeek, settings.mesoStart, settings.trainingDays, today, settings.setAdjust);
  const showReport = !!report && (report.done > 0 || lastWeek >= settings.mesoStart);
  const doneThisWeek = doneAll.filter((s) => s.date >= monday && s.date < addDays(monday, 7)).length;
  const backupAge = settings.lastBackupAt ? daysBetween(settings.lastBackupAt, today) : null;
  const showBackupReminder =
    !active && doneAll.length >= 5 && settings.backupDismissed !== monday && (backupAge == null || backupAge >= 14);
  // Etiqueta do banner: sempre uma linha curta (o tamanho de "Missão do dia"), para não chegar no capacete do robô.
  // Quando hoje não é dia de treino, a data do próximo entra no lugar de "Protocolo 0N", acima do nome.
  const missionLabel = doneToday.length ? "Próxima missão" : picked ? "Missão trocada" : isToday ? "Missão do dia" : "Descanso hoje";
  const nextDateLabel =
    !isToday && !picked && next ? `${weekdayShort(fromISO(next.date).getDay()).toLowerCase()}, ${shortDate(next.date)}` : null;

  // Retomada e fadiga mudam o treino da semana: ficam sempre à vista. Relatório e backup vão para a barra de avisos.
  const warnItems = [!active && showReport ? "relatório" : null, showBackupReminder ? "backup" : null].filter((x): x is string => !!x);
  const warnCount = warnItems.length;
  const warnHint = warnItems.join(" · ");

  async function quickBackup() {
    await updateSettings({ lastBackupAt: today, backupDismissed: monday });
    const b = await exportBackup();
    await shareOrDownload(`augment-backup-${today}.json`, JSON.stringify(b, null, 2), `AUGMENT Backup (${today})`);
    toast("Backup exportado.", "ok");
  }

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
            <img src={`${import.meta.env.BASE_URL}avatar.png`} alt="" width={48} height={48} />
          </Link>
        </div>
      </header>

      {active && (
        <Link
          to={`/treino/${active.id}`}
          data-augmented-ui="tl-clip br-clip border"
          className="card hot"
          style={{ textDecoration: "none" }}
        >
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

      {!active && reentry && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 10 }}>
          <div className="callout warn">
            {reentry.kind === "restart"
              ? `${reentry.gapDays} dias sem treinar. O calendário te põe na ${WEEK_RULES[reentry.week].label.toLowerCase()}, mas voltar direto para falha e séries extras é arriscado. Recomece o mesociclo na semana 1: histórico e recordes ficam.`
              : `Semana passada: ${reentry.done} de ${reentry.planned} treinos. Em vez de avançar para a semana ${reentry.week}, repita a semana ${reentry.week - 1}.`}
          </div>
          <div className="row">
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-primary btn-sm grow"
              onClick={() =>
                updateSettings({
                  mesoStart: reentry.kind === "restart" ? monday : addDays(settings.mesoStart, 7),
                  reentryDismissed: monday,
                })
              }
            >
              {reentry.kind === "restart" ? "Recomeçar na semana 1" : `Repetir a semana ${reentry.week - 1}`}
            </button>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-sm btn-ghost"
              onClick={() => updateSettings({ reentryDismissed: monday })}
            >
              Manter semana {reentry.week === 7 ? "D" : reentry.week}
            </button>
          </div>
        </section>
      )}

      {/* F3: Deload antecipado por fadiga */}
      {!active && fatigue && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 10 }}>
          <div className="callout warn">
            <strong>Fadiga acumulada na Semana {fatigue.week}:</strong> {fatigue.reasons.join(", ")}. Você pode antecipar a semana de Deload
            para recuperar articulações e sistema nervoso antes do próximo bloco.
          </div>
          <div className="row">
            <HoldButton
              className="btn-primary btn-sm grow"
              label="Antecipar Deload agora"
              onConfirm={() => {
                updateSettings({
                  mesoStart: fatigue.targetMesoStart,
                  reentryDismissed: monday,
                });
                toast("Semana de Deload ativada.", "ok");
              }}
            >
              Antecipar Deload agora
            </HoldButton>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-sm btn-ghost"
              onClick={() => updateSettings({ reentryDismissed: monday })}
            >
              Seguir na semana {fatigue.week}
            </button>
          </div>
        </section>
      )}

      {warnCount > 0 && (
        <SysModule
          id="avisos-home"
          code="SYS.!"
          title={warnCount === 1 ? "1 aviso" : `${warnCount} avisos`}
          hint={warnHint}
          tone="amber"
          meta={warnCount}
        >
          <div className="stack">
            {!active && showReport && (
              <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
                <div className="spread">
                  <span className="label">
                    Relatório da semana passada · {report!.done}/{report!.planned} treinos
                  </span>
                </div>
                <div className="display" style={{ fontSize: 20 }}>
                  {report!.focus.title}
                </div>
                <p className="small muted" style={{ margin: 0 }}>
                  {report!.focus.detail}
                </p>
                <div className="row">
                  <Link to={`/relatorio/${lastWeek}`} data-augmented-ui="tl-clip br-clip border" className="btn btn-sm grow">
                    Ver relatório <span className="arrow">&gt;</span>
                  </Link>
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    onClick={() => updateSettings({ reportSeen: monday })}
                  >
                    Entendido
                  </button>
                </div>
              </section>
            )}

            {showBackupReminder && (
              <section data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 8 }}>
                <span className="label">Segurança local // Backup</span>
                <p className="small muted" style={{ margin: 0 }}>
                  {backupAge == null
                    ? `Você já tem ${doneAll.length} treinos salvos no aparelho e ainda não exportou um backup.`
                    : `Faz ${backupAge} dias desde o último backup (${shortDate(settings.lastBackupAt!)}). Guarde uma cópia.`}
                </p>
                <div className="row">
                  <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm grow" onClick={quickBackup}>
                    Exportar backup (.json)
                  </button>
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    onClick={() => updateSettings({ backupDismissed: monday })}
                  >
                    Depois
                  </button>
                </div>
              </section>
            )}
          </div>
        </SysModule>
      )}

      {!active && (
        <section className="stack">
          <div data-augmented-ui="tl-clip br-clip border" className="mission">
            <img className="figure" src={`${import.meta.env.BASE_URL}hero.webp`} alt="" width={720} height={720} decoding="async" />
            <span className="shade" aria-hidden="true" />
            <span className="hatch" aria-hidden="true" />
            <div className="mission-top">
              <span className="mission-tag">{missionLabel}</span>
              <span className="mission-code">EXO.PROTOCOL / {day.code}</span>
            </div>
            <div className="mission-body">
              <div className="mission-label">
                {nextDateLabel ?? `Protocolo ${String(dayIdx).padStart(2, "0")}`} // {day.focus}
              </div>
              <h1 data-len={day.name.length > 22 ? "xl" : day.name.length > 10 ? "l" : undefined}>{day.name}</h1>
              <div className="mission-meta">
                <span>
                  <Icon name="barbell" size={15} /> {day.exercises.length} módulos
                </span>
                <span>
                  <Icon name="clock" size={15} /> ~{estimateMinutes(day.id, week, settings.setAdjust)} min
                </span>
                <span>
                  <Icon name="chart" size={15} /> {rule.label}
                </span>
              </div>
            </div>
            <div className="btn-dock">
              <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-light" onClick={() => start()}>
                Iniciar protocolo <span className="arrow">&gt;</span>
              </button>
              <span className="dock-row" aria-hidden="true">
                <span className="dock-tag">
                  {day.code}-{String(dayIdx).padStart(2, "0")}
                </span>
              </span>
            </div>
            <span className="sticker">
              Bio / mod {String(dayIdx).padStart(2, "0")}
              <br />
              Human enhancement
            </span>
          </div>

          {!picking ? (
            <div className="row-wrap">
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-ghost grow"
                onClick={() => setPicking(true)}
              >
                Trocar o protocolo de hoje
              </button>
              <Link to="/programas" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost grow">
                Editar programa <span className="arrow">&gt;</span>
              </Link>
            </div>
          ) : (
            <div data-augmented-ui="tl-clip br-clip border" className="card flat stack">
              <div className="small muted">A sequência não pula treino: se faltar um dia, o próximo continua de onde parou.</div>
              <div className="row-wrap">
                {programDays().map((d) => (
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
            <span className="label hide-narrow">Sys.0{dayIdx} // no excuses</span>
          </div>
          <ol data-augmented-ui="tl-clip br-clip border" className="list">
            {day.exercises.map((ex, i) => {
              const swapped = settings.swaps?.[ex.id];
              return (
                <li key={ex.id} className="list-item" style={{ paddingBlock: 11 }}>
                  <span className="idx">{ex.superset ? (ex.superset.order === 1 ? "A1" : "A2") : String(i + 1).padStart(2, "0")}</span>
                  <span className="grow">
                    <span style={{ fontWeight: 600, display: "block", lineHeight: 1.25 }}>
                      {swapped ?? ex.name.replace(/^A[12] · /, "")}
                      {ex.up && week >= 4 && week <= 6 && <span className="plus">▲</span>}
                    </span>
                    <span className="mono faint" style={{ fontSize: "var(--fs-2)" }}>
                      {swapped ? `Troca do ciclo (${ex.name.replace(/^A[12] · /, "")}) · ` : ""}
                      {setsFor(ex, week, settings.setAdjust?.[ex.id])}×{ex.reps[0]}–{ex.reps[1]}
                      {ex.perSide ? " por lado" : ""}, {ex.restLabel.toLowerCase()}
                    </span>
                  </span>
                  <StopBadge stop={ex.stop} week={week} />
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <Link to="/treinador" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost coach-link">
        <span className="status-dot ok" /> Falar com o treinador <span className="arrow">&gt;</span>
      </Link>

      <div className="stack" style={{ gap: 8 }}>
        <div className="eyebrow">
          Sistema online / {weekdayName(today)}, {shortDate(today)}
        </div>
        <p className="h-hero h-hero-sm" aria-hidden="true">
          Beyond
          <br />
          limits<span style={{ color: "var(--red)" }}>.</span>
        </p>
        <p className="small muted">
          {settings.operator ? `Operador: ${settings.operator}. ` : ""}Seu corpo é o hardware. Cada série registrada é uma atualização.
        </p>
      </div>

      <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
        <div className="spread">
          <div>
            <h2 className="h-sec">{fixed ? "Programa fixo" : "Ciclo do mesociclo"}</h2>
            <p className="small muted" style={{ marginTop: 4 }}>
              {rule.summary}
            </p>
          </div>
          <span className="display" style={{ fontSize: 26, color: "var(--red-hi)" }}>
            {fixed ? "FX" : week === 7 ? "D" : `0${week}`}
          </span>
        </div>
        {!fixed && <WeekStrip week={week} />}
        <div data-augmented-ui="br-clip border" className="stats">
          <div className="stat">
            <span className="label">Compostos</span>
            <span className="small" style={{ fontWeight: 600 }}>
              {rule.compounds}
            </span>
          </div>
          <div className="stat">
            <span className="label">Isolados</span>
            <span className="small" style={{ fontWeight: 600 }}>
              {rule.isolations}
            </span>
          </div>
          <div className="stat">
            <span className="label">Intensif.</span>
            <span className="small" style={{ fontWeight: 600 }}>
              {rule.intensifierLabel}
            </span>
          </div>
        </div>
        {fixed ? (
          <Link to="/programas" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm btn-ghost">
            Ligar o mesociclo no programa <span className="arrow">&gt;</span>
          </Link>
        ) : (
          <Link to="/relatorio?tab=meso" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm btn-ghost">
            Resumo do mesociclo e rotação de acessórios <span className="arrow">&gt;</span>
          </Link>
        )}
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <div className="spread">
          <h2 className="h-sec">Ciclo semanal</h2>
          <Link to="/historico" className="label tap" style={{ color: "var(--red-hi)", textDecoration: "none" }}>
            Agenda &gt;
          </Link>
        </div>
        <div className="days">
          {weekDates.map((d) => {
            const done = doneAll.find((s) => s.date === d);
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
                  <Link
                    to={`/treino/${done.id}`}
                    data-augmented-ui="tl-clip br-clip border"
                    className={`day-dot ${cls}${d === today ? " today" : ""}`}
                  >
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
          生体 / {week === 0 ? "FX" : `0${week === 7 ? "D" : week}`}
          <br />
          Access granted
        </span>
      </footer>
    </div>
  );
}
