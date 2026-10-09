import { useRef, useState } from "react";
import { PageHead, WeekStrip } from "../components/bits";
import { EXERCISE_BY_ID, PROGRAM } from "../data/program";
import { addDays, mondayOf, shortDate, weekdayShort } from "../lib/dates";
import { db, DEFAULT_SETTINGS, exportBackup, importBackup, isBackup } from "../lib/db";
import { useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { weekFor } from "../lib/mesocycle";
import { formatWeight, workSets } from "../lib/progression";
import { shortName } from "./SessionScreen";

/** Salva um arquivo: usa a folha de compartilhar no celular (iPhone instalado não baixa blobs) e cai para download. */
async function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  if (navigator.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function SettingsScreen() {
  const [settings, update, loaded] = useSettings();
  const sessions = useSessions();
  const today = useToday();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [wipe, setWipe] = useState(false);
  const week = weekFor(settings.mesoStart, today);

  async function doExport() {
    const b = await exportBackup();
    await download(`augment-backup-${today}.json`, JSON.stringify(b, null, 2), "application/json");
    toast("Backup exportado.");
  }

  async function doCsv() {
    const rows = [["data", "treino", "semana", "exercicio", "tipo", "peso", "unidade", "reps"]];
    const done = (sessions ?? []).filter((s) => s.status === "done").sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const s of done) {
      for (const e of s.exercises) {
        for (const st of workSets(e)) {
          rows.push([
            s.date,
            s.dayId,
            String(s.week),
            shortName(EXERCISE_BY_ID[e.exId]),
            st.kind === "drop" ? "-15%" : "trabalho",
            formatWeight(st.weight),
            e.unit,
            String(st.reps),
          ]);
        }
      }
    }
    const csv = rows.map((r) => r.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    await download(`augment-series-${today}.csv`, csv, "text/csv");
    toast(`CSV exportado com ${rows.length - 1} séries.`);
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!isBackup(data)) {
        toast("Esse arquivo não é um backup do AUGMENT.");
        return;
      }
      const n = await importBackup(data, mode);
      toast(`${n} treinos importados.`);
    } catch {
      toast("Não consegui ler o arquivo. Use o .json exportado pelo próprio app.");
    }
  }

  return (
    <div className="stack-lg">
      <PageHead back="/" code="AUG.OS // CONFIGURAÇÃO" title="Ajustes" />

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}avatar.png`} alt="" width={48} height={48} />
          </span>
          <h2 className="h-sec">Operador</h2>
        </div>
        <label className="label" htmlFor="operator">
          Como o app te chama
        </label>
        <input
          key={String(loaded)}
          id="operator"
          className="input"
          defaultValue={settings.operator}
          placeholder="Seu nome"
          maxLength={24}
          onBlur={(e) => update({ operator: e.target.value.trim() })}
        />
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Mesociclo</h2>
        <p className="small muted">
          Toque na semana em que você está. O app recalcula o início e ajusta séries, selos e intensificadores. Início atual:{" "}
          {shortDate(settings.mesoStart)}.
        </p>
        <WeekStrip week={week} onPick={(w) => update({ mesoStart: addDays(mondayOf(today), -(w - 1) * 7) })} />
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn btn-sm"
          onClick={() => update({ mesoStart: mondayOf(today) })}
        >
          Começar novo mesociclo nesta semana
        </button>
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Dias de treino</h2>
        <p className="small muted">A agenda distribui a sequência só nesses dias.</p>
        <div className="row-wrap">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <button
              key={d}
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="toggle-chip"
              aria-pressed={settings.trainingDays.includes(d)}
              onClick={() => {
                const on = settings.trainingDays.includes(d);
                const next = on ? settings.trainingDays.filter((x) => x !== d) : [...settings.trainingDays, d];
                if (next.length) update({ trainingDays: next });
              }}
            >
              {weekdayShort(d)}
            </button>
          ))}
        </div>
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Timer de descanso</h2>
        <div className="row-wrap">
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="toggle-chip"
            aria-pressed={settings.sound}
            onClick={() => update({ sound: !settings.sound })}
          >
            Som ao terminar
          </button>
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="toggle-chip"
            aria-pressed={settings.vibrate}
            onClick={() => update({ vibrate: !settings.vibrate })}
          >
            Vibrar ao terminar
          </button>
        </div>
        <p className="tiny faint">
          O alarme toca com o app aberto. A tela fica acesa durante o treino quando o celular permite. No iPhone a vibração não é suportada
          pelo navegador.
        </p>
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <details key={String(loaded)}>
          <summary className="h-sec" style={{ cursor: "pointer" }}>
            Incremento de carga por exercício
          </summary>
          <p className="small muted" style={{ marginTop: 8 }}>
            Quanto sobe quando todas as séries batem o topo da faixa. Padrão da ficha: +2,5 kg nos compostos e +1 a 2,5 kg nos isolados. Em
            lb, o padrão é 5.
          </p>
          <div className="stack" style={{ marginTop: 10, gap: 8 }}>
            {PROGRAM.flatMap((d) =>
              d.exercises.map((ex) => (
                <label key={ex.id} className="spread small">
                  <span className="grow">
                    {shortName(ex)} <span className="faint">({d.name})</span>
                  </span>
                  <input
                    className="input"
                    style={{ width: 84, minHeight: 36, textAlign: "center" }}
                    inputMode="decimal"
                    defaultValue={settings.increments[ex.id] != null ? formatWeight(settings.increments[ex.id]) : ""}
                    placeholder={formatWeight(ex.increment)}
                    onBlur={(e) => {
                      const v = Number(e.target.value.replace(",", "."));
                      const next = { ...settings.increments };
                      if (e.target.value.trim() === "" || !Number.isFinite(v) || v <= 0) delete next[ex.id];
                      else next[ex.id] = v;
                      update({ increments: next });
                    }}
                  />
                </label>
              )),
            )}
          </div>
        </details>
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Backup</h2>
        <p className="small muted">
          Seus treinos ficam só neste aparelho. Exporte um backup de vez em quando e antes de trocar de celular ou limpar o navegador.
        </p>
        <div className="row-wrap">
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={doExport}>
            Exportar backup (.json)
          </button>
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={doCsv}>
            Exportar séries (.csv)
          </button>
        </div>
        <p className="tiny faint">O CSV abre em qualquer planilha.</p>
        <div className="divider" />
        <div className="row-wrap">
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="toggle-chip"
            aria-pressed={mode === "merge"}
            onClick={() => setMode("merge")}
          >
            Juntar com o que existe
          </button>
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="toggle-chip"
            aria-pressed={mode === "replace"}
            onClick={() => setMode("replace")}
          >
            Substituir tudo
          </button>
        </div>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn" onClick={() => fileRef.current?.click()}>
          Importar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Apagar dados</h2>
        {wipe ? (
          <>
            <p className="small">Isso apaga todos os treinos e ajustes deste aparelho. Exporte um backup antes se quiser guardar.</p>
            <div className="row">
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-danger grow"
                onClick={async () => {
                  await db.sessions.clear();
                  await db.kv.put({ key: "settings", value: DEFAULT_SETTINGS });
                  setWipe(false);
                  toast("Dados apagados.");
                }}
              >
                Apagar tudo
              </button>
              <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={() => setWipe(false)}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" onClick={() => setWipe(true)}>
            Apagar todos os treinos
          </button>
        )}
      </section>

      <p className="tiny faint center">AUGMENT 1.0 // feito para o Programa de Hipertrofia v2 (set/2026)</p>
    </div>
  );
}
