import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { dayName, PageHead } from "../components/bits";
import { BodyGoalCard } from "../components/BodyGoalCard";
import { bodyAdvice } from "../lib/engine";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { AttributeWheel } from "../components/AttributeWheel";
import { SysModule, SysModuleGroup } from "../components/SysModule";
import { PanelActions } from "../components/PanelActions";
import { weekdayName } from "../lib/dates";
import { FatigueMap } from "../components/FatigueMap";
import { VolumeSlots } from "../components/VolumeSlots";
import { PhotoCompare } from "../components/PhotoCompare";
import { RecordList } from "../components/RecordList";
import { CommunityModule } from "../components/CommunityCard";
import { exById, programDays, shortName } from "../data/program";
import type { Unit } from "../data/types";
import { computeAchievements } from "../lib/achievements";
import { addDays, bySessionDesc, mondayOf, shortDate } from "../lib/dates";
import { deleteBodyEntry, uid, upsertBodyEntry } from "../lib/db";
import { learnedRecoveryMultipliers } from "../lib/core/operator";
import { resizeImageFile } from "../lib/files";
import { useBodyLog, useOperatorMemory, useOperatorState, useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { weekFor } from "../lib/mesocycle";
import { formatWeight, historyOf, LB_TO_KG, mainLoad, prsBySession, toKg, workSets, type PR } from "../lib/progression";
import { planAhead } from "../lib/schedule";
import { attributes } from "../lib/attributes";
import { volumeSlots } from "../lib/slots";
import { activityGrid, dailySets, muscleStatus, readiness, relativeStrength } from "../lib/visual";

export function Progress() {
  const sessions = useSessions();
  const bodyLog = useBodyLog();
  const [settings, updateSettings] = useSettings();
  const today = useToday();
  const toast = useToast();

  // Form de peso corporal / medidas / foto (F4)
  const [showBodyForm, setShowBodyForm] = useState(false);
  const [bDate, setBDate] = useState(today);
  const [bWeight, setBWeight] = useState("");
  const [bWaist, setBWaist] = useState("");
  const [bArm, setBArm] = useState("");
  const [bNotes, setBNotes] = useState("");
  const [bPhoto, setBPhoto] = useState<string | undefined>(undefined);
  const [viewPhotoId, setViewPhotoId] = useState<string | null>(null);
  const [bioSignal, setBioSignal] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const prMap = useMemo(() => (sessions ? prsBySession(sessions) : new Map<string, PR[]>()), [sessions]);
  const achievements = useMemo(
    () => (sessions ? computeAchievements(sessions, settings, bodyLog ?? []) : []),
    [sessions, settings, bodyLog],
  );
  const week = weekFor(settings.mesoStart, today);
  const operator = useOperatorState(sessions, bodyLog, settings, today);
  const [memory] = useOperatorMemory();
  const recoveryMultipliers = useMemo(() => learnedRecoveryMultipliers(operator), [operator]);
  const muscles = useMemo(
    () => muscleStatus(sessions ?? [], week, today, Date.now(), settings.setAdjust, recoveryMultipliers),
    [sessions, week, today, settings.setAdjust, recoveryMultipliers],
  );
  const grid = useMemo(
    () => activityGrid(sessions ?? [], today, settings.trainingDays.length, 53, memory.absences),
    [sessions, today, settings.trainingDays.length, memory.absences],
  );
  const relative = useMemo(() => relativeStrength(sessions ?? [], bodyLog ?? []), [sessions, bodyLog]);
  const daily = useMemo(() => dailySets(sessions ?? [], today), [sessions, today]);
  const nextWorkout = useMemo(() => {
    const p = planAhead(sessions ?? [], today, 14, settings.trainingDays)[0];
    const day = p && programDays().find((d) => d.id === p.dayId);
    if (!day) return undefined;
    const ms = [...new Set(day.exercises.flatMap((e) => e.muscles))];
    return { name: day.name, date: p.date, muscles: ms, readiness: readiness(muscles, ms) };
  }, [sessions, today, settings.trainingDays, muscles]);

  if (!sessions) return null;

  const done = sessions.filter((s) => s.status === "done");
  const slots = volumeSlots(sessions, today, week, settings.setAdjust);
  const attrs = attributes({ sessions, bodyLog: bodyLog ?? [], settings, today });

  // Treinos por semana (últimas 8)
  const monday = mondayOf(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i)));
  const perWeek = weeks.map((w) => ({
    w,
    n: done.filter((s) => s.date >= w && s.date < addDays(w, 7)).length,
  }));
  const maxN = Math.max(5, ...perWeek.map((p) => p.n));

  // Recordes recentes (em O(N) via prMap)
  const sorted = [...done].sort(bySessionDesc);
  const recent = sorted
    .slice(0, 20)
    .flatMap((s) => (prMap.get(s.id) ?? []).map((p) => ({ ...p, date: s.date })))
    .slice(0, 12);

  // Pontos de gráfico de peso corporal (F4)
  const weightPoints = [...(bodyLog ?? [])]
    .filter((e) => e.weightKg != null && e.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, value: e.weightKg! }));

  async function saveBody() {
    const parseOpt = (s: string) => {
      const n = Number(s.replace(",", ".").trim());
      return Number.isFinite(n) && n > 0 ? Number(n.toFixed(1)) : undefined;
    };
    const weightKg = parseOpt(bWeight);
    const waistCm = parseOpt(bWaist);
    const armCm = parseOpt(bArm);
    if (!weightKg && !waistCm && !armCm && !bPhoto && !bNotes.trim()) {
      toast("Preencha pelo menos peso, medida ou foto.", "warn");
      return;
    }
    await upsertBodyEntry({
      id: uid(),
      date: bDate || today,
      weightKg,
      waistCm,
      armCm,
      notes: bNotes.trim() || undefined,
      photoDataUrl: bPhoto,
    });
    setBWeight("");
    setBWaist("");
    setBArm("");
    setBNotes("");
    setBPhoto(undefined);
    setShowBodyForm(false);
    toast("Medição corporal registrada.", "ok");
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const lastWeight = weightPoints.length ? weightPoints[weightPoints.length - 1].value : null;
  const withPlan = slots.filter((x) => x.planned > 0);
  const missingSets = withPlan.reduce((a, x) => a + x.missing, 0);
  const missingMuscles = withPlan.filter((x) => x.missing > 0).length;
  const lowest = attrs.list.filter((a) => a.level != null).sort((a, b) => a.level! - b.level!)[0];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="stack-lg">
      <PageHead code="AUG.OS // TELEMETRIA" title="Progresso" sub="Volume da semana, biometria, conquistas e evolução por exercício." />

      <div className="row-wrap">
        <Link to="/relatorio" data-augmented-ui="tl-clip br-clip border" className="btn grow" style={{ flexBasis: "auto" }}>
          Relatório da semana <span className="arrow">&gt;</span>
        </Link>
        <Link
          to="/relatorio?tab=meso"
          data-augmented-ui="tl-clip br-clip border"
          className="btn btn-ghost grow"
          style={{ flexBasis: "auto" }}
        >
          Resumo do mesociclo <span className="arrow">&gt;</span>
        </Link>
      </div>

      <section data-augmented-ui="tl-clip br-clip border" className="card sys-brief" aria-label="Resumo da semana">
        <span className="sys-brief-tag">SYS // RESUMO</span>
        <button type="button" className="sys-brief-row" onClick={() => jump("p-series")}>
          <b className={missingSets > 0 ? "warn" : "ok"}>{missingSets > 0 ? missingSets : "OK"}</b>
          <span>
            {missingSets > 0
              ? `Faltam ${missingSets} séries em ${missingMuscles} ${missingMuscles === 1 ? "músculo" : "músculos"} nesta semana`
              : "Plano de séries da semana cumprido"}
          </span>
        </button>
        <button type="button" className="sys-brief-row" onClick={() => jump("p-atributos")}>
          <b>{lowest?.level ?? "–"}</b>
          <span>{lowest ? `Atributo mais baixo: ${lowest.name}` : "Atributos aparecem com os primeiros registros"}</span>
        </button>
        <button type="button" className="sys-brief-row" onClick={() => jump("p-fadiga")}>
          <b>{nextWorkout ? `${nextWorkout.readiness}%` : "–"}</b>
          <span>{nextWorkout ? `Próximo: ${nextWorkout.name} · ${weekdayName(nextWorkout.date)}` : "Sem treino agendado"}</span>
        </button>
      </section>

      <div id="p-fadiga" className="stack panel-wrap">
        <FatigueMap status={muscles} daily={daily} next={nextWorkout} today={today} />
        <PanelActions
          links={[
            {
              to: `/treinador?auto=1&q=${encodeURIComponent("Como está minha recuperação muscular agora e o que ajusto no próximo treino?")}`,
              label: "Perguntar ao treinador",
            },
          ]}
        />
      </div>

      <div id="p-atributos" className="stack panel-wrap">
        <AttributeWheel list={attrs.list} index={attrs.index} />
        <PanelActions
          links={[
            { to: "/relatorio", label: "Ver relatório da semana" },
            {
              to: `/treinador?auto=1&q=${encodeURIComponent(`Meu atributo mais baixo é ${lowest?.name ?? "—"}. O que faço nas próximas sessões para subir?`)}`,
              label: "Como subir o mais baixo",
            },
          ]}
        />
      </div>

      <div id="p-series" className="stack panel-wrap">
        <VolumeSlots
          slots={slots}
          weekLabel={week === 7 ? "semana de deload" : week === 0 ? "programa fixo" : `semana ${week} do mesociclo`}
          weekOver={false}
        />
        <PanelActions links={[{ to: "/relatorio", label: "Ver no relatório" }]} />
      </div>

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
        <p className="tiny faint">
          Semanas começando na segunda. O programa em uso pede {programDays().length} {programDays().length === 1 ? "treino" : "treinos"}{" "}
          por semana.
        </p>
      </section>

      <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
        <h2 className="h-sec">Atividade do ano</h2>
        <div className="stats-grid">
          <div>
            <span className="label">Treinos</span>
            <strong className="num">{grid.totalSessions}</strong>
            <span className="tiny faint">53 semanas</span>
          </div>
          <div>
            <span className="label">Sequência</span>
            <strong className="num">
              {grid.streak} {grid.streak === 1 ? "semana" : "semanas"}
            </strong>
            <span className="tiny faint">com {settings.trainingDays.length}+ treinos</span>
          </div>
          <div>
            <span className="label">Recorde</span>
            <strong className="num">
              {grid.longestStreak} {grid.longestStreak === 1 ? "semana" : "semanas"}
            </strong>
            <span className="tiny faint">seguidas na meta</span>
          </div>
        </div>
        <ActivityHeatmap grid={grid} today={today} />
      </section>

      <SysModuleGroup label="SUBSISTEMAS // TELEMETRIA" count={5}>
        {/* F4: Peso corporal, medidas e fotos */}
        <SysModule
          id="biometria"
          code="BIO.01"
          title="Biometria"
          hint="Peso, medidas e fotos"
          meta={lastWeight != null ? `${formatWeight(lastWeight)} kg` : "—"}
          quick={{
            label: "+ Peso",
            onClick: () => {
              setShowBodyForm(true);
              setBioSignal((n) => n + 1);
              window.setTimeout(() => document.getElementById("b-weight")?.focus(), 450);
            },
          }}
          openSignal={bioSignal}
        >
          <div className="stack">
            <div className="spread">
              <p className="small muted" style={{ margin: 0 }}>
                Acompanhe se a progressão de carga está acompanhada de ganho de massa ou recomposição.
              </p>
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm"
                onClick={() => setShowBodyForm((v) => !v)}
              >
                {showBodyForm ? "Fechar" : "+ Registrar"}
              </button>
            </div>

            {showBodyForm && (
              <div data-augmented-ui="tl-clip br-clip border" className="card flat stack" style={{ gap: 8 }}>
                <div className="row-wrap">
                  <div className="grow">
                    <label className="label" htmlFor="b-date">
                      Data
                    </label>
                    <input id="b-date" type="date" className="input" value={bDate} onChange={(e) => setBDate(e.target.value)} />
                  </div>
                  <div className="grow">
                    <label className="label" htmlFor="b-weight">
                      Peso (kg)
                    </label>
                    <input
                      id="b-weight"
                      className="input"
                      inputMode="decimal"
                      placeholder="ex.: 82,4"
                      value={bWeight}
                      onChange={(e) => setBWeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="row-wrap">
                  <div className="grow">
                    <label className="label" htmlFor="b-waist">
                      Cintura (cm)
                    </label>
                    <input
                      id="b-waist"
                      className="input"
                      inputMode="decimal"
                      placeholder="ex.: 81"
                      value={bWaist}
                      onChange={(e) => setBWaist(e.target.value)}
                    />
                  </div>
                  <div className="grow">
                    <label className="label" htmlFor="b-arm">
                      Braço (cm)
                    </label>
                    <input
                      id="b-arm"
                      className="input"
                      inputMode="decimal"
                      placeholder="ex.: 40,5"
                      value={bArm}
                      onChange={(e) => setBArm(e.target.value)}
                    />
                  </div>
                </div>
                <input
                  className="input"
                  placeholder="Observação (em jejum, pós-deload…)"
                  value={bNotes}
                  onChange={(e) => setBNotes(e.target.value)}
                />
                <div className="row-wrap">
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {bPhoto ? "Trocar foto anexada" : "Anexar foto (opcional)"}
                  </button>
                  {bPhoto && (
                    <button type="button" className="link-btn" onClick={() => setBPhoto(undefined)}>
                      Remover foto
                    </button>
                  )}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const dataUrl = await resizeImageFile(file, 720, 0.78);
                        setBPhoto(dataUrl);
                      } catch {
                        toast("Não foi possível carregar a imagem.", "warn");
                      }
                    }}
                  />
                </div>
                {bPhoto && (
                  <img
                    src={bPhoto}
                    alt="Prévia"
                    style={{ maxHeight: 160, width: "auto", alignSelf: "flex-start", borderRadius: 4, border: "1px solid var(--line)" }}
                  />
                )}
                <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm btn-primary" onClick={saveBody}>
                  Salvar medição
                </button>
              </div>
            )}

            <BodyGoalCard
              entries={bodyLog ?? []}
              goal={settings.bodyGoal}
              onGoal={updateSettings}
              advice={bodyAdvice(bodyLog ?? [], settings.bodyGoal, sessions ?? [], today)}
            />

            {weightPoints.length >= 2 && (
              <LineChart
                labels={weightPoints.map((p) => shortDate(p.date))}
                series={[
                  { name: "Peso corporal", color: "--cyan", values: weightPoints.map((p) => p.value) },
                  ...(settings.bodyGoal?.targetKg != null
                    ? [{ name: "Meta", color: "--amber", dashed: true, values: weightPoints.map(() => settings.bodyGoal!.targetKg!) }]
                    : []),
                ]}
                unit="kg"
              />
            )}

            <PhotoCompare entries={bodyLog ?? []} />

            {(bodyLog ?? []).length === 0 ? (
              <p className="small faint" style={{ margin: 0 }}>
                Nenhuma medição registrada ainda.
              </p>
            ) : (
              <ul data-augmented-ui="tl-clip br-clip border" className="list">
                {(bodyLog ?? []).slice(0, 10).map((entry) => (
                  <li key={entry.id} className="stack" style={{ padding: "10px 14px", gap: 6 }}>
                    <div className="spread small">
                      <span>
                        <strong>{shortDate(entry.date)}</strong>
                        {entry.weightKg != null && ` · ${formatWeight(entry.weightKg)} kg`}
                        {entry.waistCm != null && ` · cintura ${formatWeight(entry.waistCm)} cm`}
                        {entry.armCm != null && ` · braço ${formatWeight(entry.armCm)} cm`}
                        {entry.notes && <span className="faint"> ({entry.notes})</span>}
                      </span>
                      <div className="row" style={{ gap: 8 }}>
                        {entry.photoDataUrl && (
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => setViewPhotoId(viewPhotoId === entry.id ? null : entry.id)}
                          >
                            {viewPhotoId === entry.id ? "Ocultar foto" : "Ver foto"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="link-btn x-btn"
                          aria-label="Excluir medição"
                          onClick={() => deleteBodyEntry(entry.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {viewPhotoId === entry.id && entry.photoDataUrl && (
                      <img
                        src={entry.photoDataUrl}
                        alt={`Registro de ${entry.date}`}
                        style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 4, border: "1px solid var(--line)" }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SysModule>

        <SysModule
          id="forca-relativa"
          code="FRC.02"
          title="Força relativa"
          hint="1RM estimado ÷ peso corporal"
          tone="red"
          meta={relative.length ? `${relative.length} ex.` : "—"}
        >
          <div className="stack">
            <div>
              <p className="small muted" style={{ margin: 0 }}>
                1RM estimado ÷ peso corporal da época, nos compostos. Se a carga sobe junto com o peso, o número fica parado: é o que separa
                ganho de força de ganho de peso.
              </p>
            </div>
            {relative.length === 0 ? (
              <p className="small faint" style={{ margin: 0 }}>
                {weightPoints.length === 0
                  ? "Registre o peso corporal em Biometria para calcular."
                  : "Aparece depois do primeiro treino com séries registradas."}
              </p>
            ) : (
              <div className="stack" style={{ gap: 7 }}>
                {relative.map((r) => (
                  <div key={r.exId} className="rel">
                    <span className="small">{shortName(exById(r.exId))}</span>
                    <span className="small num" style={{ textAlign: "right" }}>
                      <strong>{r.ratio.toFixed(2).replace(".", ",")}×</strong>
                      <span className="faint"> PC</span>
                    </span>
                    <span
                      className="tiny num"
                      style={{
                        textAlign: "right",
                        color: r.sessions < 2 || Math.abs(r.deltaPct) < 0.5 ? "var(--ink-3)" : r.deltaPct > 0 ? "var(--ok)" : "var(--warn)",
                      }}
                    >
                      {r.sessions < 2 ? "base" : `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct.toFixed(1).replace(".", ",")}%`}
                    </span>
                  </div>
                ))}
                <p className="tiny faint" style={{ margin: 0 }}>
                  A porcentagem compara com o primeiro treino registrado de cada exercício.
                </p>
              </div>
            )}
          </div>
        </SysModule>

        {/* F12: Conquistas (Módulos desbloqueados) */}
        <SysModule
          id="modulos"
          code="MOD.03"
          title="Módulos desbloqueados"
          hint="Conquistas do operador"
          tone="green"
          meta={`${unlockedCount}/${achievements.length}`}
        >
          <div className="mod-grid">
            {achievements.map((a, i) => (
              <div
                key={a.id}
                style={{ "--i": i } as CSSProperties}
                data-augmented-ui="tl-clip br-clip border"
                className={`card flat stack mod-card${a.unlocked ? " unlocked" : ""}`}
              >
                <div className="spread">
                  <span className="tiny mono" style={{ color: a.unlocked ? "var(--ok)" : "var(--muted)" }}>
                    {a.code}
                  </span>
                  <span className="tiny mono">{a.unlocked ? "ATIVO" : a.progress}</span>
                </div>
                <strong className="small">{a.title}</strong>
                <span className="tiny muted">{a.detail}</span>
              </div>
            ))}
          </div>
        </SysModule>

        <SysModule id="recordes" code="REC.04" title="Recordes recentes" hint="Últimos 20 treinos" tone="amber" meta={recent.length || "—"}>
          {recent.length === 0 ? (
            <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
              Recordes aparecem a partir da segunda vez que você faz cada exercício: a primeira vira a linha de base.
            </div>
          ) : (
            <RecordList items={recent} linkToExercise />
          )}
        </SysModule>

        <CommunityModule />

        <SysModule
          id="cargas"
          code="CRG.05"
          title="Cargas atuais"
          hint="Carga de trabalho por exercício"
          meta={`${programDays().reduce((n, d) => n + d.exercises.length, 0)} ex.`}
        >
          <div className="stack">
            {programDays().map((d) => (
              <div key={d.id} className="stack" style={{ gap: 6 }}>
                <div className="label">{dayName(d.id)}</div>
                <ul data-augmented-ui="tl-clip br-clip border" className="list">
                  {d.exercises.map((ex) => {
                    const activeAlt = settings.swaps?.[ex.id] || undefined;
                    const h = historyOf(done, ex.id, activeAlt);
                    const last = h[h.length - 1];
                    const unit: Unit = last?.entry.unit ?? "kg";
                    const conv = (w: number, u: Unit) => (u === unit ? w : unit === "kg" ? toKg(w, u) : w / LB_TO_KG);
                    const load = last ? mainLoad(workSets(last.entry, false)) : null;
                    const firstRaw = h[0] ? mainLoad(workSets(h[0].entry, false)) : null;
                    const first = firstRaw != null && h[0] ? conv(firstRaw, h[0].entry.unit) : null;
                    const delta = load != null && first != null && h.length > 1 ? Math.round((load - first) * 10) / 10 : null;
                    return (
                      <li key={ex.id}>
                        <Link to={`/exercicios/${ex.lib}`} className="list-item" style={{ paddingBlock: 10 }}>
                          <span className="grow small" style={{ fontWeight: 500 }}>
                            {shortName(ex)}
                            {activeAlt && <span className="faint"> ({activeAlt})</span>}
                          </span>
                          {load != null ? (
                            <span className="small num">
                              <strong>
                                {formatWeight(load)} {unit}
                              </strong>
                              {delta != null && delta !== 0 && (
                                <span style={{ color: delta > 0 ? "var(--ok)" : "var(--warn)", marginLeft: 6 }}>
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
            <p className="tiny faint">A diferença compara a carga de trabalho atual com a do primeiro registro (na mesma unidade).</p>
          </div>
        </SysModule>
      </SysModuleGroup>
    </div>
  );
}
