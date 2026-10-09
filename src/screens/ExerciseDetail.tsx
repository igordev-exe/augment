import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { dayName, PageHead, StopBadge } from "../components/bits";
import { Icon } from "../components/Icon";
import { LineChart } from "../components/LineChart";
import { LIB_BY_ID } from "../data/library";
import { dayOfExercise, usesOfLibrary } from "../data/program";
import type { ProgramExercise, Session, Unit } from "../data/types";
import { shortDate } from "../lib/dates";
import { useSessions, useSettings, useToday } from "../lib/hooks";
import { setsFor, weekFor } from "../lib/mesocycle";
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

export function ExerciseDetail() {
  const { libId = "" } = useParams();
  const lib = LIB_BY_ID[libId];
  const uses = usesOfLibrary(libId);
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

      <section className="stack">
        <h2 className="h-sec">Na sua ficha</h2>
        {uses.map((ex) => (
          <div key={ex.id} data-augmented-ui="tl-clip br-clip border" className="card stack" style={{ gap: 8 }}>
            <div className="spread">
              <strong>{dayName(dayOfExercise(ex.id)!.id)}</strong>
              <StopBadge stop={ex.stop} week={week} />
            </div>
            <div className="small">
              {setsFor(ex, week)} séries de {ex.reps[0]}–{ex.reps[1]} reps{ex.perSide ? " por lado" : ""}. Descanso:{" "}
              {ex.restLabel.toLowerCase()}.{ex.tempo ? ` ${ex.tempo}.` : ""}
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

      {sessions && uses.map((ex) => <ExerciseProgress key={ex.id} ex={ex} sessions={sessions} showDay={uses.length > 1} />)}
    </div>
  );
}

function ExerciseProgress({ ex, sessions, showDay }: { ex: ProgramExercise; sessions: Session[]; showDay: boolean }) {
  const hist = historyOf(sessions, ex.id);
  const title = showDay ? `Progresso no ${dayName(dayOfExercise(ex.id)!.id)}` : "Progresso";

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
                    <Link to={`/treino/${h.session.id}`}>{shortDate(h.session.date)}</Link>
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
