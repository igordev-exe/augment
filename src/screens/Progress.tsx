import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { dayName, PageHead } from "../components/bits";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { EXERCISE_BY_ID, MUSCLE_LABEL, MUSCLE_ORDER, PROGRAM, shortName } from "../data/program";
import type { Unit } from "../data/types";
import { computeAchievements } from "../lib/achievements";
import { addDays, bySessionDesc, mondayOf, shortDate } from "../lib/dates";
import { deleteBodyEntry, uid, upsertBodyEntry } from "../lib/db";
import { resizeImageFile } from "../lib/files";
import { useBodyLog, useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { weekFor } from "../lib/mesocycle";
import { formatWeight, historyOf, LB_TO_KG, mainLoad, prsBySession, toKg, workSets, type PR } from "../lib/progression";
import { plannedVolume, weeklyVolume } from "../lib/sessions";

export function Progress() {
  const sessions = useSessions();
  const bodyLog = useBodyLog();
  const [settings] = useSettings();
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
  const photoInputRef = useRef<HTMLInputElement>(null);

  const prMap = useMemo(() => (sessions ? prsBySession(sessions) : new Map<string, PR[]>()), [sessions]);
  const achievements = useMemo(
    () => (sessions ? computeAchievements(sessions, settings, bodyLog ?? []) : []),
    [sessions, settings, bodyLog],
  );

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
      toast("Preencha pelo menos peso, medida ou foto.");
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
    toast("Medição corporal registrada.");
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="stack-lg">
      <PageHead code="AUG.OS // TELEMETRIA" title="Progresso" sub="Volume da semana, biometria, conquistas e evolução por exercício." />

      <div className="row-wrap">
        <Link to="/relatorio" data-augmented-ui="tl-clip br-clip border" className="btn grow">
          Relatório da semana <span className="arrow">&gt;</span>
        </Link>
        <Link to="/relatorio?tab=meso" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost grow">
          Resumo do mesociclo <span className="arrow">&gt;</span>
        </Link>
      </div>

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

      {/* F4: Peso corporal, medidas e fotos */}
      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <div className="spread">
          <div>
            <h2 className="h-sec">Biometria (peso, medidas e fotos)</h2>
            <p className="small muted" style={{ marginTop: 2 }}>
              Acompanhe se a progressão de carga está acompanhada de ganho de massa ou recomposição.
            </p>
          </div>
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
                    toast("Não foi possível carregar a imagem.");
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

        {weightPoints.length >= 2 && (
          <LineChart
            labels={weightPoints.map((p) => shortDate(p.date))}
            series={[{ name: "Peso corporal", color: "var(--cyan)", values: weightPoints.map((p) => p.value) }]}
            unit="kg"
          />
        )}

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
                      <button type="button" className="link-btn" onClick={() => setViewPhotoId(viewPhotoId === entry.id ? null : entry.id)}>
                        {viewPhotoId === entry.id ? "Ocultar foto" : "Ver foto"}
                      </button>
                    )}
                    <button type="button" className="link-btn" aria-label="Excluir medição" onClick={() => deleteBodyEntry(entry.id)}>
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
      </section>

      {/* F12: Conquistas (Módulos desbloqueados) */}
      <section data-augmented-ui="tr-clip bl-clip border" className="card data stack">
        <div className="spread">
          <h2 className="h-sec">Módulos desbloqueados</h2>
          <span className="mono small" style={{ color: "var(--cyan)" }}>
            {unlockedCount}/{achievements.length}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
          {achievements.map((a) => (
            <div
              key={a.id}
              data-augmented-ui="tl-clip br-clip border"
              className="card flat stack"
              style={{
                gap: 4,
                padding: 10,
                opacity: a.unlocked ? 1 : 0.55,
                borderColor: a.unlocked ? "var(--cyan)" : undefined,
              }}
            >
              <div className="spread">
                <span className="tiny mono" style={{ color: a.unlocked ? "var(--cyan)" : "var(--muted)" }}>
                  {a.code}
                </span>
                <span className="tiny mono">{a.unlocked ? "ATIVO" : a.progress}</span>
              </div>
              <strong className="small">{a.title}</strong>
              <span className="tiny muted">{a.detail}</span>
            </div>
          ))}
        </div>
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
        <p className="tiny faint">A diferença compara a carga de trabalho atual com a do primeiro registro (na mesma unidade).</p>
      </section>
    </div>
  );
}
