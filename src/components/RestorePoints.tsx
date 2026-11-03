import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { shareOrDownload } from "../lib/files";
import { useToast } from "../lib/hooks";
import {
  createRestorePoint,
  deleteRestorePoint,
  listRestorePoints,
  loadRestorePoint,
  MAX_POINTS,
  RESTORE_LABEL,
  restoreFrom,
  type RestorePoint,
} from "../lib/restore";

function when(p: RestorePoint): string {
  return new Date(p.at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function RestorePoints() {
  const points = useLiveQuery(() => listRestorePoints(), []);
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      toast("Não deu certo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <h2 className="h-sec">Pontos de restauração</h2>
      <p className="small muted">
        Cópias completas guardadas neste aparelho: uma por semana e antes de importar, restaurar ou apagar tudo. Ficam as {MAX_POINTS} mais
        recentes. Não substituem o backup exportado: se o navegador apagar os dados, os pontos vão junto.
      </p>

      {!points || points.length === 0 ? (
        <p className="small faint" style={{ margin: 0 }}>
          Nenhum ponto ainda. O primeiro aparece sozinho quando houver treinos salvos.
        </p>
      ) : (
        <ul data-augmented-ui="tl-clip br-clip border" className="list">
          {points.map((p) => (
            <li key={p.id} className="stack" style={{ padding: "10px 14px", gap: 6 }}>
              <div className="spread small">
                <span>
                  <strong>{when(p)}</strong> · {RESTORE_LABEL[p.reason]}
                  <span className="faint">
                    {" "}
                    · {p.sessions} treinos{p.bodyEntries ? `, ${p.bodyEntries} medições` : ""}
                  </span>
                </span>
              </div>
              {confirm === p.id ? (
                <div className="row-wrap" style={{ gap: 8 }}>
                  <span className="small grow">Voltar a este ponto? O estado atual vira um ponto novo antes.</span>
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-danger"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const n = await restoreFrom(p.id);
                        setConfirm(null);
                        toast(`Restaurado: ${n} treinos.`);
                      })
                    }
                  >
                    Restaurar
                  </button>
                  <button type="button" className="link-btn" onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="row" style={{ gap: 14 }}>
                  <button type="button" className="link-btn" onClick={() => setConfirm(p.id)}>
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() =>
                      run(async () => {
                        const data = await loadRestorePoint(p.id);
                        if (!data) throw new Error("sem dados");
                        const day = p.at.slice(0, 10);
                        await shareOrDownload(`augment-backup-${day}-ponto.json`, JSON.stringify(data, null, 2), `AUGMENT Ponto (${day})`);
                      })
                    }
                  >
                    Baixar .json
                  </button>
                  <button type="button" className="link-btn" aria-label="Excluir ponto" onClick={() => run(() => deleteRestorePoint(p.id))}>
                    Excluir
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        data-augmented-ui="tl-clip br-clip border"
        className="btn btn-ghost"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const p = await createRestorePoint("manual");
            toast(p ? "Ponto de restauração criado." : "Nada para guardar ainda.");
          })
        }
      >
        Criar ponto agora
      </button>
    </section>
  );
}
