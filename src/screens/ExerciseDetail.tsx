import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dayName, PageHead, StopBadge } from "../components/bits";
import { ExerciseDemo } from "../components/ExerciseDemo";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { LIB_BY_ID } from "../data/library";
import { EXT_BY_ID, useLibraryEntry } from "../data/library-extended";
import { dayOfExercise, usesOfLibrary } from "../data/program";
import type { LibraryEntry, ProgramDay, Session, Unit } from "../data/types";
import { shortDate } from "../lib/dates";
import { saveProgram } from "../lib/db";
import { useProgram, useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { addExercise, exerciseFromLibrary } from "../lib/program-edit";
import { setsFor, weekFor } from "../lib/mesocycle";
import { CommunityCard } from "../components/CommunityCard";
import { e1rm, formatWeight, historyOf, LB_TO_KG, mainLoad, recordsOf, toKg, workSets } from "../lib/progression";

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
  } catch {
    /* não é URL */
  }
  return null;
}

const yt = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/**
 * "Adicionar ao meu programa": escolhe o dia e inclui o exercício com séries, reps e descanso padrão (dá para ajustar
 * depois no montador). Só para exercícios da biblioteca.
 */
function AddToProgram({ libId }: { libId: string }) {
  const program = useProgram();
  const toast = useToast();
  const [dayId, setDayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!LIB_BY_ID[libId] && !EXT_BY_ID[libId]) return null;
  const has = (d: ProgramDay) => d.exercises.some((e) => e.lib === libId);
  const day = program.days.find((d) => d.id === dayId);
  async function add() {
    if (!day) return;
    setBusy(true);
    try {
      await saveProgram(addExercise(program, day.id, (taken) => exerciseFromLibrary(libId, day.id, taken)));
      toast(`Entrou no ${day.name} do programa "${program.name}". Ajuste séries e reps no montador, se quiser.`, "ok");
      setDayId(null);
    } catch {
      toast("Não deu para salvar o programa. Tente de novo.", "warn");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack add-to-program">
      <h2 className="h-sec">Adicionar ao meu programa</h2>
      <p className="tiny faint" style={{ margin: 0 }}>
        Em qual dia de "{program.name}"?
      </p>
      <div className="row-wrap" role="group" aria-label="Dia do programa">
        {program.days.map((d) => (
          <button
            key={d.id}
            type="button"
            className="toggle-chip"
            data-augmented-ui="tl-clip br-clip border"
            aria-pressed={dayId === d.id}
            disabled={has(d)}
            onClick={() => setDayId(d.id)}
          >
            {d.name}
            {has(d) ? " · já tem" : ""}
          </button>
        ))}
      </div>
      <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" disabled={!day || busy} onClick={add}>
        {day ? `Adicionar ao ${day.name}` : "Escolha um dia"}
      </button>
    </section>
  );
}

export function ExerciseDetail() {
  const { libId = "" } = useParams();
  const uses = usesOfLibrary(libId);
  // Exercício personalizado (fora da biblioteca): ficha mínima a partir do programa.
  const fromLibrary = useLibraryEntry(libId);
  const lib: LibraryEntry | undefined =
    fromLibrary ??
    (uses[0]
      ? {
          id: libId,
          name: uses[0].name,
          primary: uses[0].muscleLabel,
          equipment: "Exercício personalizado",
          setup: [],
          execution: [],
          errors: [],
          why: "",
          videoPt: uses[0].name,
          videoEn: uses[0].name,
        }
      : undefined);
  const sessions = useSessions();
  const [settings, update] = useSettings();
  const today = useToday();
  const week = weekFor(settings.mesoStart, today);
  const saved = settings.videos[libId] ?? "";
  const [draft, setDraft] = useState<string | null>(null);

  if (!lib) {
    return (
      <div className="empty">
        <p>Exercício não encontrado.</p>
        <Link to="/exercicios" data-augmented-ui="tl-clip br-clip border" className="btn">
          Ver exercícios
        </Link>
      </div>
    );
  }
  const vid = youtubeId(saved);

  return (
    <div className="stack-lg">
      <PageHead
        back="/exercicios"
        code={`MÓDULO // ${lib.primary.split(" ")[0].toUpperCase()}`}
        title={lib.name}
        sub={`${lib.primary}${lib.secondary ? `; ajuda: ${lib.secondary}` : ""}. ${lib.equipment}.`}
      />

      <ExerciseDemo libId={lib.id} />

      <section className="stack">
        <h2 className="h-sec">Na sua ficha</h2>
        {uses.length === 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            Não está no programa em uso. Escolha um dia abaixo para incluir.
          </p>
        )}
        {uses.map((ex) => (
          <div key={ex.id} data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
            <div className="spread">
              <strong>{dayName(dayOfExercise(ex.id)!.id)}</strong>
              <StopBadge stop={ex.stop} week={week} />
            </div>
            <div className="small">
              {setsFor(ex, week, settings.setAdjust?.[ex.id])} séries de {ex.reps[0]}–{ex.reps[1]} reps{ex.perSide ? " por lado" : ""}.
              Descanso: {ex.restLabel.toLowerCase()}.{ex.tempo ? ` ${ex.tempo}.` : ""}
              {ex.intensifier ? ` Intensificador (semana 3+): ${ex.intensifier.toLowerCase()}.` : ""}
            </div>
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              {ex.cues.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <AddToProgram libId={libId} />

      <section className="stack">
        <h2 className="h-sec">Vídeo de execução</h2>
        {vid ? (
          <div className="video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0&playsinline=1`}
              title={`Vídeo: ${lib.name}`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ) : (
          <p className="small muted">
            Escolha um vídeo de confiança no YouTube e cole o link aqui. Ele fica salvo e aparece sempre que você abrir este exercício.
          </p>
        )}
        <div className="row-wrap">
          <a data-augmented-ui="tl-clip br-clip border" className="btn btn-sm" href={yt(lib.videoPt)} target="_blank" rel="noreferrer">
            <Icon name="video" size={16} /> Buscar em português
          </a>
          <a data-augmented-ui="tl-clip br-clip border" className="btn btn-sm" href={yt(lib.videoEn)} target="_blank" rel="noreferrer">
            <Icon name="video" size={16} /> Buscar em inglês
          </a>
        </div>
        <div className="row">
          <input
            className="input grow"
            type="url"
            inputMode="url"
            placeholder="Cole o link do YouTube"
            value={draft ?? saved}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Link do vídeo de referência"
          />
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn"
            disabled={draft == null || (draft.trim() !== "" && !youtubeId(draft))}
            onClick={async () => {
              await update({ videos: { ...settings.videos, [libId]: (draft ?? "").trim() } });
              setDraft(null);
            }}
          >
            Salvar
          </button>
        </div>
        {draft && draft.trim() !== "" && !youtubeId(draft) && (
          <p className="tiny" style={{ color: "var(--red-hi)" }}>
            Esse link não parece ser do YouTube.
          </p>
        )}
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Preparação</h2>
        <ul className="prose" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {lib.setup.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <h2 className="h-sec" style={{ marginTop: 6 }}>
          Execução
        </h2>
        <ol className="prose" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {lib.execution.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="small muted">Cadência da ficha: desce em 2–3 s, controla no alongado sem quicar, sobe rápido sem impulso.</p>
        <h2 className="h-sec" style={{ marginTop: 6 }}>
          Erros comuns
        </h2>
        <ul className="prose" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {lib.errors.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h2 className="h-sec">Por que está na ficha</h2>
        <p className="callout">{lib.why}</p>
        {lib.alternatives?.length ? (
          <p className="small muted">
            <strong>Se estiver ocupado ou incomodar:</strong> {lib.alternatives.join(", ")}.
          </p>
        ) : null}
      </section>

      {sessions &&
        (uses.length === 0 ? (
          <ExerciseProgress exId={lib.id} libId={lib.id} sessions={sessions} />
        ) : uses.length === 1 ||
          !sessions.some(
            (s) => s.status === "done" && s.exercises.some((e) => uses.some((u) => u.id === e.exId) && workSets(e).length > 0),
          ) ? (
          <ExerciseProgress exId={uses[0].id} libId={uses[0].lib} sessions={sessions} />
        ) : (
          uses.map((ex) => <ExerciseProgress key={ex.id} exId={ex.id} libId={ex.lib} sessions={sessions} showDay ownOnly />)
        ))}

      <CommunityCard libId={libId} />
    </div>
  );
}

function ExerciseProgress({
  exId,
  libId,
  sessions,
  showDay = false,
  ownOnly = false,
}: {
  exId: string;
  libId: string;
  sessions: Session[];
  showDay?: boolean;
  ownOnly?: boolean;
}) {
  const rawHist = historyOf(sessions, exId, undefined, libId);
  const hist = ownOnly ? rawHist.filter((h) => h.entry.exId === exId) : rawHist;
  const day = dayOfExercise(exId);
  const title = showDay && day ? `Progresso no ${dayName(day.id)}` : "Progresso";

  if (!hist.length) {
    return (
      <section className="stack">
        <h2 className="h-sec">{title}</h2>
        <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
          Ainda sem registros. Depois do primeiro treino, aparecem aqui o gráfico, os recordes e o histórico.
        </div>
      </section>
    );
  }

  const unit: Unit = hist[hist.length - 1].entry.unit;
  const conv = (w: number, u: Unit) => (u === unit ? w : unit === "kg" ? toKg(w, u) : w / LB_TO_KG);
  const rec = recordsOf(hist);
  const labels = hist.map((h) => shortDate(h.session.date));
  const load = hist.map((h) => {
    const l = mainLoad(workSets(h.entry, false));
    return l == null ? null : conv(l, h.entry.unit);
  });
  const best = hist.map((h) => {
    const vals = workSets(h.entry).map((s) => e1rm(conv(s.weight!, h.entry.unit), s.reps!));
    return vals.length ? Math.max(...vals) : null;
  });
  const u = ` ${unit}`;

  return (
    <section className="stack">
      <h2 className="h-sec">{title}</h2>
      <div className="tiles">
        <div data-augmented-ui="tl-clip border" className="tile">
          <span className="label">Carga máxima</span>
          <span className="v">
            {formatWeight(rec.heaviest ? Math.round(conv(rec.heaviest.weight, rec.heaviest.unit) * 10) / 10 : null)}
            <small>{u}</small>
          </span>
          <span className="tiny faint">× {rec.heaviest?.reps} reps</span>
        </div>
        <div data-augmented-ui="tl-clip border" className="tile">
          <span className="label">1RM estimado</span>
          <span className="v">
            {formatWeight(rec.bestE1rm ? Math.round(conv(rec.bestE1rm.value, "kg")) : null)}
            <small>{u}</small>
          </span>
          <span className="tiny faint">{rec.bestE1rm ? shortDate(rec.bestE1rm.date) : ""}</span>
        </div>
        <div data-augmented-ui="tl-clip border" className="tile">
          <span className="label">Sessões</span>
          <span className="v">{rec.sessions}</span>
          <span className="tiny faint">desde {shortDate(hist[0].session.date)}</span>
        </div>
      </div>

      {hist.length > 1 ? (
        <div data-augmented-ui="tr-clip bl-clip border" className="card data">
          <LineChart
            labels={labels}
            unit={unit}
            series={[
              { name: "Carga de trabalho", color: "--chart-1", values: load },
              { name: "1RM estimado", color: "--chart-2", values: best },
            ]}
          />
        </div>
      ) : (
        <p className="small muted">O gráfico aparece a partir do segundo registro.</p>
      )}

      <div data-augmented-ui="tl-clip br-clip border" className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Carga</th>
              <th className="r">Recorde de reps</th>
              <th className="r">Quando</th>
            </tr>
          </thead>
          <tbody>
            {rec.repRecords.slice(0, 8).map((r) => (
              <tr key={`${r.weight}${r.unit}`}>
                <td>
                  {formatWeight(r.weight)} {r.unit}
                </td>
                <td className="r">{r.reps}</td>
                <td className="r faint">{shortDate(r.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-augmented-ui="tl-clip br-clip border" className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Data</th>
              <th>Séries de trabalho</th>
            </tr>
          </thead>
          <tbody>
            {[...hist]
              .reverse()
              .slice(0, 10)
              .map((h) => (
                <tr key={h.session.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="tap" to={`/treino/${h.session.id}`}>
                      {shortDate(h.session.date)}
                    </Link>
                  </td>
                  <td>
                    {workSets(h.entry)
                      .map((s) => `${formatWeight(s.weight)}×${s.reps}${s.kind === "drop" ? " (−15%)" : ""}`)
                      .join(", ")}{" "}
                    <span className="faint">{h.entry.unit}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
