import { useRef, useState } from "react";
import type { Unit } from "../data/types";
import { shortDate } from "../lib/dates";
import { db } from "../lib/db";
import { useToast } from "../lib/hooks";
import { importWorkoutsCsv, type ImportResult } from "../lib/importcsv";
import { createRestorePoint } from "../lib/restore";

// Ajustes → Backup: trazer o histórico do Hevy ou do Strong (CSV exportado lá). Lê no aparelho, mostra o que vai
// entrar e só grava com o toque em "Importar". Antes, o estado atual vira um ponto de restauração.

const treinos = (n: number) => `${n} ${n === 1 ? "treino" : "treinos"}`;

export function ImportCsv() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("kg");
  const [preview, setPreview] = useState<(ImportResult & { fresh: number }) | null>(null);
  const [busy, setBusy] = useState(false);

  async function read(t: string, u: Unit) {
    const r = importWorkoutsCsv(t, u);
    if (!r || !r.sessions.length) {
      setPreview(null);
      setText(null);
      toast("Esse arquivo não parece um CSV exportado do Hevy ou do Strong.", "warn");
      return;
    }
    const existing = new Set(
      await db.sessions
        .where("id")
        .anyOf(r.sessions.map((s) => s.id))
        .primaryKeys(),
    );
    setPreview({ ...r, fresh: r.sessions.filter((s) => !existing.has(s.id)).length });
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true);
    try {
      await createRestorePoint("antes-importar");
      await db.sessions.bulkPut(preview.sessions);
      toast(
        `${treinos(preview.sessions.length)} importado${preview.sessions.length === 1 ? "" : "s"} do ${preview.source === "hevy" ? "Hevy" : "Strong"}.`,
        "ok",
      );
      setPreview(null);
      setText(null);
    } catch {
      toast("Não consegui importar. Nada foi alterado.", "warn");
    } finally {
      setBusy(false);
    }
  }

  const first = preview?.sessions[0];
  const last = preview?.sessions[preview.sessions.length - 1];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="label">Vem de outro app?</span>
      <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={() => fileRef.current?.click()}>
        Importar do Hevy ou Strong (.csv)
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const t = await f.text();
          setText(t);
          await read(t, unit);
        }}
      />
      <p className="tiny faint">
        No Hevy e no Strong, a exportação fica nas configurações do app (exportar dados em CSV). Os treinos entram no histórico e alimentam
        a sugestão de carga; o seu programa não muda.
      </p>

      {preview && first && last && (
        <div data-augmented-ui="tl-clip br-clip border" className="card flat stack import-preview" style={{ gap: 8 }}>
          <strong>
            {treinos(preview.sessions.length)} do {preview.source === "hevy" ? "Hevy" : "Strong"}
          </strong>
          <span className="small muted">
            De {shortDate(first.date)} a {shortDate(last.date)}.{" "}
            {preview.fresh < preview.sessions.length
              ? `${preview.sessions.length - preview.fresh} já estavam aqui e serão atualizados.`
              : "Nenhum repetido."}
          </span>
          <span className="small">
            {preview.matched.size} {preview.matched.size === 1 ? "exercício reconhecido" : "exercícios reconhecidos"} na biblioteca
            {preview.unmatched.length
              ? `, ${preview.unmatched.length} ${preview.unmatched.length === 1 ? "entra" : "entram"} como exercício próprio`
              : ""}
            .
          </span>
          {preview.unmatched.length > 0 && (
            <details className="tiny faint">
              <summary>Ver os exercícios próprios</summary>
              {preview.unmatched.join(" · ")}
            </details>
          )}
          {preview.source === "strong" && (
            <div className="stack" style={{ gap: 4 }}>
              <span className="label" id="imp-unit">
                Unidade no Strong
              </span>
              <span className="unit-toggle" role="group" aria-labelledby="imp-unit">
                {(["kg", "lb"] as Unit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => {
                      setUnit(u);
                      if (text) void read(text, u);
                    }}
                  >
                    {u}
                  </button>
                ))}
              </span>
              <span className="tiny faint">O arquivo do Strong não diz a unidade: use a que estava no app.</span>
            </div>
          )}
          {preview.skipped > 0 && (
            <span className="tiny faint">{preview.skipped} linhas sem carga e reps (cardio, alongamento) ficam de fora.</span>
          )}
          <div className="row-wrap">
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" disabled={busy} onClick={doImport}>
              {busy ? "Importando…" : `Importar ${treinos(preview.sessions.length)}`}
            </button>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-ghost"
              onClick={() => {
                setPreview(null);
                setText(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
