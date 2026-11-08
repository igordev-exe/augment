import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { dayCode, dayName, PageHead } from "../components/bits";
import { BodyLab } from "../components/BodyLab";
import { EngineLab } from "../components/EngineLab";
import { HoldButton } from "../components/HoldButton";
import { RecordList } from "../components/RecordList";
import { Icon } from "../components/Icon";
import { exById, MUSCLE_LABEL, shortName } from "../data/program";
import { addDays, mondayOf, shortDate } from "../lib/dates";
import { useBodyLog, useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { whyLabel } from "../components/NudgeList";
import { fatigueAlert } from "../lib/engine";
import { WEEK_RULES, withSetAdjust } from "../lib/mesocycle";
import { engineDiagnostics } from "../lib/diagnostics";
import { formatWeight } from "../lib/progression";
import { mesoReport, weeklyReport } from "../lib/report";

function rirLabel([a, b]: [number, number]): string {
  return a === b ? `${a}` : `${a}–${b}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack">
      <h2 className="h-sec h-cut">{title}</h2>
      {children}
    </section>
  );
}

type LaudoTab = "week" | "meso" | "corpo" | "motor";
const LAUDO_TABS: { id: LaudoTab; label: string; code: string }[] = [
  { id: "week", label: "Semana", code: "SEMANAL" },
  { id: "meso", label: "Mesociclo", code: "MESOCICLO" },
  { id: "corpo", label: "Corpo", code: "BIOMETRIA" },
  { id: "motor", label: "Motor", code: "MOTOR" },
];

/** Relatório da semana e consolidado do mesociclo (6 semanas + deload), em formato de laudo com abas embaixo. */
export function Report() {
  const { week: param } = useParams();
  const [searchParams] = useSearchParams();
  const sessions = useSessions();
  const [settings, updateSettings] = useSettings();
  const today = useToday();
  const toast = useToast();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<LaudoTab>(LAUDO_TABS.some((t) => t.id === tabParam) ? (tabParam as LaudoTab) : "week");
  const bodyLog = useBodyLog();

  if (!sessions) return null;

  const current = mondayOf(today);
  const weekStart = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? mondayOf(param) : addDays(current, -7);
  const r = weeklyReport(sessions, weekStart, settings.mesoStart, settings.trainingDays, today, settings.setAdjust);
  const m = mesoReport(sessions, settings.mesoStart, settings.trainingDays, today);
  const fatigue = fatigueAlert(sessions, settings.mesoStart, today, settings.reentryDismissed);
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

  /** Ajustes ativos que o relatório deste ciclo não está sugerindo (vindos de outro ciclo ou do treinador). */
  const extraAdjust = Object.entries(settings.setAdjust ?? {}).filter(
    ([exId]) => exById(exId) && !m.volumeAdvice.some((v) => v.exId === exId),
  );

  function setAdjustFor(exId: string, valor: number, name: string) {
    updateSettings({ setAdjust: withSetAdjust(settings.setAdjust, exId, valor) });
    const ex = exById(exId);
    toast(
      valor ? `${name}: ${ex.sets + valor} séries por treino a partir do próximo.` : `${name}: de volta às ${ex.sets} séries da ficha.`,
      "ok",
    );
  }

  function toggleAccessorySwap(exId: string, alt: string) {
    const next = { ...settings.swaps };
    if (next[exId] === alt) delete next[exId];
    else next[exId] = alt;
    updateSettings({ swaps: next });
  }

  const tabCode = LAUDO_TABS.find((t) => t.id === tab)!.code;
  return (
    <div className="stack-lg laudo">
      <PageHead
        back="/"
        code="AUG.OS // RELATÓRIO"
        title="Relatório"
        sub={
          tab === "corpo" ? (
            <>Peso, medidas, foto e a orientação do motor pelo plano alimentar.</>
          ) : tab === "motor" ? (
            <>O que as regras do motor estão vendo agora.</>
          ) : tab === "meso" ? (
            <>
              Ciclo de {shortDate(m.cycleStart)} a {shortDate(m.cycleEnd)} · {WEEK_RULES[m.currentWeek].label}.
            </>
          ) : (
            <>
              {shortDate(weekStart)} a {shortDate(addDays(weekStart, 6))}.{" "}
              {r.mesoWeek == null
                ? "Antes do mesociclo atual."
                : r.mesoWeek === 0
                  ? "Programa fixo (sem mesociclo)."
                  : `${WEEK_RULES[r.mesoWeek].label} do mesociclo.`}
              {open ? " Semana em andamento." : ""}
            </>
          )
        }
      />

      <div className="laudo-bar" aria-hidden="true">
        <span>AUG.MED // LAUDO {tabCode}</span>
        <span className="barcode" />
        <span>FIR {weekStart.replaceAll("-", "").slice(2)}</span>
      </div>

      <div className="laudo-tabs" role="tablist" aria-label="Seções do laudo">
        {LAUDO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`laudo-tab-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              // Padrão de abas: setas trocam de aba, Home/End vão às pontas.
              const i = LAUDO_TABS.findIndex((x) => x.id === tab);
              const to =
                e.key === "ArrowRight"
                  ? i + 1
                  : e.key === "ArrowLeft"
                    ? i - 1
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? LAUDO_TABS.length - 1
                        : null;
              if (to == null) return;
              e.preventDefault();
              const next = LAUDO_TABS[(to + LAUDO_TABS.length) % LAUDO_TABS.length];
              setTab(next.id);
              document.getElementById(`laudo-tab-${next.id}`)?.focus();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* F3: Deload antecipado por fadiga */}
      {fatigue && (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
          <div className="callout warn">
            <strong>Fadiga acumulada (Semana {fatigue.week}):</strong> {fatigue.reasons.join(", ")}.
          </div>
          <div className="row">
            <HoldButton
              className="btn-sm btn-primary grow"
              label="Antecipar Deload agora"
              onConfirm={() => {
                updateSettings({ mesoStart: fatigue.targetMesoStart, reentryDismissed: current });
                toast("Semana de Deload ativada.", "ok");
              }}
            >
              Antecipar Deload agora
            </HoldButton>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-sm btn-ghost"
              onClick={() => updateSettings({ reentryDismissed: current })}
            >
              Dispensar
            </button>
          </div>
        </section>
      )}

      {tab === "corpo" ? (
        <BodyLab entries={bodyLog ?? []} goal={settings.bodyGoal} sessions={sessions} today={today} />
      ) : tab === "motor" ? (
        <EngineLab items={engineDiagnostics({ sessions, settings, bodyLog: bodyLog ?? [], today })} />
      ) : tab === "meso" ? (
        <>
          <div className="tiles">
            <div data-augmented-ui="tl-clip border" className="tile">
              <span className="label">Treinos</span>
              <span className="v">
                {m.sessionsDone}
                <small>/{m.sessionsPlanned}</small>
              </span>
            </div>
            <div data-augmented-ui="tl-clip border" className="tile">
              <span className="label">Volume</span>
              <span className="v">
                {(m.totalVolumeKg / 1000).toFixed(1).replace(".", ",")}
                <small> t</small>
              </span>
            </div>
            <div data-augmented-ui="tl-clip border" className="tile">
              <span className="label">Recordes</span>
              <span className="v">{m.prsCount}</span>
            </div>
          </div>

          {m.cardioMinutes > 0 && (
            <div className="callout">
              Cardio acumulado no ciclo: <strong>{m.cardioMinutes} min</strong> ({m.totalSets} séries de musculação concluídas).
            </div>
          )}

          {/* F1: Rotação de acessórios */}
          <Section title="Rotação de acessórios (próximo mesociclo)">
            <p className="small muted" style={{ margin: 0 }}>
              Ao fim do deload, troque 2–3 acessórios (especialmente os que incomodaram articulação ou estagnaram). Toque na alternativa
              para deixá-la ativa nos próximos treinos.
            </p>
            {m.swapCandidates.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                Registre mais sessões no ciclo para o sistema sugerir os acessórios candidatos à troca.
              </p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {m.swapCandidates.map((c) => {
                  const chosen = settings.swaps?.[c.exId];
                  return (
                    <div key={c.exId} data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 8 }}>
                      <div className="spread">
                        <strong>{c.name}</strong>
                        <span className="label" style={{ color: c.reason === "articular" ? "var(--red-hi)" : "var(--amber)" }}>
                          {c.reason === "articular" ? "Articulação" : c.reason === "estagnado" ? "Estagnado" : "Variação"}
                        </span>
                      </div>
                      <span className="small muted">{c.detail}</span>
                      <div className="row-wrap">
                        {c.alternatives.map((alt) => (
                          <button
                            key={alt}
                            type="button"
                            data-augmented-ui="tl-clip br-clip border"
                            className="toggle-chip"
                            style={{ fontSize: "var(--fs-2)", textTransform: "none" }}
                            aria-pressed={chosen === alt}
                            onClick={() => toggleAccessorySwap(c.exId, alt)}
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="row-wrap">
              <Link
                to={`/treinador?q=${encodeURIComponent("Analise o relatório do meu mesociclo atual e me diga quais acessórios trocar para o próximo ciclo.")}`}
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm grow"
              >
                Analisar ciclo com o treinador <span className="arrow">&gt;</span>
              </Link>
              {m.currentWeek === 7 && (
                <HoldButton
                  className="btn-sm btn-primary"
                  label="Iniciar novo mesociclo"
                  onConfirm={() => {
                    updateSettings({ mesoStart: current });
                    toast("Novo mesociclo iniciado na Semana 1.", "ok");
                  }}
                >
                  Iniciar novo mesociclo (Semana 1)
                </HoldButton>
              )}
            </div>
          </Section>

          {/* Motor de decisões: +1/−1 série por exercício para o próximo mesociclo, com aplicar/desfazer */}
          {(m.volumeAdvice.length > 0 || extraAdjust.length > 0) && (
            <Section title="Séries no próximo mesociclo">
              <p className="small muted" style={{ margin: 0 }}>
                Pelo seu "como bateu" e pela evolução do 1RM estimado. Toque para aplicar: vale a partir do próximo treino, sem passar de 4
                séries, e dá para desfazer aqui.
              </p>
              <ul data-augmented-ui="tl-clip br-clip border" className="list">
                {m.volumeAdvice.map((v) => {
                  const applied = settings.setAdjust?.[v.exId] === v.change;
                  const label = v.change > 0 ? "+1 série" : "−1 série";
                  return (
                    <li key={v.exId} className="list-item small" style={{ gap: 8 }}>
                      <span className="grow">
                        <strong>{v.name}</strong> <span className="muted">· {v.reason}</span>
                      </span>
                      <button
                        type="button"
                        data-augmented-ui="tl-clip br-clip border"
                        className="toggle-chip"
                        style={{
                          fontSize: "var(--fs-2)",
                          textTransform: "none",
                          color: applied ? "var(--ok)" : v.change > 0 ? "var(--sel)" : "var(--warn)",
                        }}
                        aria-pressed={applied}
                        onClick={() => setAdjustFor(v.exId, applied ? 0 : v.change, v.name)}
                      >
                        {applied ? `${label} ✓ desfazer` : `Aplicar ${label}`}
                      </button>
                    </li>
                  );
                })}
                {extraAdjust.map(([exId, n]) => (
                  <li key={exId} className="list-item small" style={{ gap: 8 }}>
                    <span className="grow">
                      <strong>{shortName(exById(exId))}</strong>{" "}
                      <span className="muted">
                        · ajuste ativo: {n > 0 ? "+" : "−"}
                        {Math.abs(n)} série{Math.abs(n) > 1 ? "s" : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      data-augmented-ui="tl-clip br-clip border"
                      className="toggle-chip"
                      style={{ fontSize: "var(--fs-2)", textTransform: "none" }}
                      onClick={() => setAdjustFor(exId, 0, shortName(exById(exId)))}
                    >
                      Voltar à ficha
                    </button>
                  </li>
                ))}
              </ul>
              <span className="tiny faint">{whyLabel("feedback-volume")}</span>
            </Section>
          )}

          {/* F2: Evolução de carga e 1RM do início ao fim do mesociclo */}
          <Section title="Evolução por exercício no mesociclo">
            {m.exercises.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                Nenhum treino concluído neste mesociclo ainda.
              </p>
            ) : (
              <ul data-augmented-ui="tl-clip br-clip border" className="list">
                {m.exercises.map((e) => (
                  <li key={e.exId} className="list-item small">
                    <span className="grow">
                      <strong>
                        {e.name}
                        {e.alt ? ` (${e.alt})` : ""}
                      </strong>{" "}
                      <span className="faint">· {e.sessions}x</span>
                      <br />
                      <span className="faint">
                        {shortDate(e.firstDate)}: {formatWeight(e.firstLoad)}
                        {e.unit} × {e.firstReps} → {shortDate(e.lastDate)}: {formatWeight(e.lastLoad)}
                        {e.unit} × {e.lastReps}
                      </span>
                    </span>
                    <span
                      className="num"
                      style={{
                        color: e.deltaE1rmPct > 0 ? "var(--ok)" : e.deltaE1rmPct < 0 ? "var(--warn)" : "var(--muted)",
                        textAlign: "right",
                      }}
                    >
                      {e.deltaE1rmPct > 0 ? `+${e.deltaE1rmPct}%` : `${e.deltaE1rmPct}%`}
                      <br />
                      <small className="faint">1RM ~{e.lastE1rm}kg</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : (
        <>
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

          {(r.cardioMinutes > 0 || r.avgSteps != null) && (
            <div className="callout">
              {r.cardioMinutes > 0 && (
                <span>
                  Cardio na semana: <strong>{r.cardioMinutes} min</strong> em {r.cardioSessions} sessão(ões).{" "}
                </span>
              )}
              {r.avgSteps != null && (
                <span>
                  Média de passos: <strong>{r.avgSteps.toLocaleString("pt-BR")}/dia</strong>.
                </span>
              )}
            </div>
          )}

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
              <RecordList items={r.prs} linkToExercise />
            </Section>
          )}

          {r.shortfalls.length > 0 && (
            <Section title="Séries que faltaram">
              <ul data-augmented-ui="tl-clip br-clip border" className="list">
                {r.shortfalls.map((s) => (
                  <li key={s.date + s.exId} className="list-item small">
                    <span className="grow">
                      {shortName(exById(s.exId))} <span className="faint">{shortDate(s.date)}</span>
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
                      <span
                        className="small num"
                        style={{ textAlign: "right", color: v.done < v.planned * 0.7 ? "var(--amber)" : undefined }}
                      >
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
                            {shortName(exById(m.exId))} <span className="faint">{shortDate(m.date)}</span>
                          </span>
                          <span style={{ color: "var(--red-hi)" }}>
                            {m.rir === 0 ? "falha" : `sobra ${m.rir}`}, meta {rirLabel(m.target)}
                          </span>
                        </li>
                      ))}
                      {r.rir.easier.map((m) => (
                        <li key={"e" + m.date + m.exId} className="list-item small">
                          <span className="grow">
                            {shortName(exById(m.exId))} <span className="faint">{shortDate(m.date)}</span>
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
                      <strong>{shortName(exById(s.exId))}</strong>
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
                  {shortName(exById(j.exId))}: articulação incomodou {j.times === 1 ? "nesta semana" : `${j.times} vezes em 3 semanas`}.
                  {j.alternatives.length ? ` Alternativas: ${j.alternatives.join(", ")}.` : ""}
                </div>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
