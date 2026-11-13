import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHead, WeekStrip } from "../components/bits";
import { HoldButton } from "../components/HoldButton";
import { FoldRow, GroupPanel, LinkRow, SwitchRow } from "../components/Pieces";
import { ImportCsv } from "../components/ImportCsv";
import { RestorePoints } from "../components/RestorePoints";
import { apiUrl } from "../lib/online/client";
import { useOnline } from "../lib/online/sync";
import { LIB_BY_ID } from "../data/library";
import { avatarSrc, PERSONAS, personaOf } from "../data/personas";
import { programDays, shortName, exOf } from "../data/program";
import { addDays, bySessionAsc, mondayOf, shortDate, weekdayShort } from "../lib/dates";
import { db, DEFAULT_SETTINGS, exportBackup, importBackup, isBackup, loadActiveProgram } from "../lib/db";
import { shareOrDownload } from "../lib/files";
import { isNative, requestNotifyPermission } from "../lib/native";
import { useSessions, useSettings, useToast, useToday, useProgram } from "../lib/hooks";
import { weekFor } from "../lib/mesocycle";
import { createRestorePoint } from "../lib/restore";
import { formatWeight, workSets } from "../lib/progression";

export function SettingsScreen() {
  const [settings, update, loaded] = useSettings();
  const program = useProgram();
  const sessions = useSessions();
  const today = useToday();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [wipe, setWipe] = useState(false);
  const week = weekFor(settings.mesoStart, today);
  const online = useOnline();

  async function doExport() {
    await update({ lastBackupAt: today, backupDismissed: mondayOf(today) });
    const b = await exportBackup();
    await shareOrDownload(`augment-backup-${today}.json`, JSON.stringify(b, null, 2), `AUGMENT Backup (${today})`);
    toast("Backup exportado.", "ok");
  }

  async function doCsv() {
    const rows = [["data", "treino", "semana", "exercicio", "tipo", "peso", "unidade", "reps", "sobra"]];
    const done = (sessions ?? []).filter((s) => s.status === "done").sort(bySessionAsc);
    for (const s of done) {
      for (const e of s.exercises) {
        for (const st of workSets(e)) {
          rows.push([
            s.date,
            s.dayId,
            String(s.week),
            e.alt ? `${shortName(exOf(e))} (${e.alt})` : shortName(exOf(e)),
            st.kind === "drop" ? "-15%" : "trabalho",
            formatWeight(st.weight),
            e.unit,
            String(st.reps),
            st.rir == null ? "" : String(st.rir),
          ]);
        }
      }
    }
    const csv = rows.map((r) => r.map((c) => (/[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    await shareOrDownload(`augment-series-${today}.csv`, csv, `AUGMENT Séries (${today})`, "text/csv");
    toast(`CSV exportado com ${rows.length - 1} séries.`, "ok");
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!isBackup(data)) {
        toast("Esse arquivo não é um backup do AUGMENT.", "warn");
        return;
      }
      const n = await importBackup(data, mode);
      toast(`${n} treinos importados.`, "ok");
    } catch {
      toast("Não consegui ler o arquivo. Use o .json exportado pelo próprio app.", "warn");
    }
  }

  async function toggleNotify() {
    if (settings.notify) {
      await update({ notify: false });
      return;
    }
    if (!isNative && typeof Notification === "undefined") {
      toast("Este navegador não suporta notificações.", "warn");
      return;
    }
    if (await requestNotifyPermission()) {
      await update({ notify: true });
      toast(isNative ? "Aviso ativado, mesmo com a tela bloqueada." : "Aviso ativado ao trocar de aba/janela.", "ok");
    } else {
      toast(
        isNative
          ? "Permissão de notificação negada nas configurações do Android."
          : "Permissão de notificação negada nas configurações do navegador.",
        "warn",
      );
    }
  }

  return (
    <div className="stack-lg set-screen">
      <PageHead back="/" code="AUG.OS // CONFIGURAÇÃO" title="Ajustes" />

      <GroupPanel label="Operador">
        <FoldRow
          title="Operador"
          value={`${settings.operator || "Sem nome"} · ${personaOf(settings.persona).name}`}
          icon={<img src={avatarSrc(settings.persona)} alt="" width={36} height={36} />}
        >
          <span className="label" id="persona-label">
            Aparência
          </span>
          <div className="persona-pick" role="group" aria-labelledby="persona-label">
            {PERSONAS.map((p) => {
              const on = personaOf(settings.persona).id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="persona-opt"
                  aria-pressed={on}
                  onClick={() => update({ persona: p.id })}
                >
                  <img src={avatarSrc(p.id)} alt="" width={56} height={56} />
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <strong>{p.name}</strong>
                    <span className="tiny faint">{p.hint}</span>
                  </span>
                </button>
              );
            })}
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
        </FoldRow>
        {apiUrl() && (
          <LinkRow
            to="/online"
            title="Conta online"
            value={
              online?.user ? `@${online.user.username} · backup, amigos e comparação` : "Sem conta (opcional) · backup na nuvem e amigos"
            }
          />
        )}
        <LinkRow to="/programas" title="Programa de treino" value={`${program.name} · ${program.days.map((d) => d.code).join(" · ")}`} />
      </GroupPanel>

      <GroupPanel label="Treino">
        <FoldRow title="Mesociclo" value={week === 0 ? "Periodização fixa" : `Semana ${week} de 7`}>
          {week === 0 ? (
            <p className="small muted">
              O programa em uso (<strong>{program.name}</strong>) usa periodização fixa: mesmas séries e esforço toda semana, sem semana de
              deload. Você pode mudar para 6 + 1 no <Link to={`/programas/${program.id}`}>montador do programa</Link>.
            </p>
          ) : (
            <>
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
            </>
          )}
        </FoldRow>
        <FoldRow
          title="Dias de treino"
          value={[1, 2, 3, 4, 5, 6, 0]
            .filter((d) => settings.trainingDays.includes(d))
            .map(weekdayShort)
            .join(" · ")}
        >
          <p className="small muted">A agenda distribui a sequência só nesses dias.</p>
          <div className="row-wrap">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="toggle-chip multi"
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
        </FoldRow>
        <FoldRow
          title="Timer de descanso"
          value={
            [settings.sound && "Som", settings.vibrate && "Vibração", settings.notify && "Aviso"].filter(Boolean).join(" · ") ||
            "Silencioso"
          }
        >
          <div>
            <SwitchRow label="Som ao terminar" checked={settings.sound} onChange={(v) => update({ sound: v })} />
            <SwitchRow label="Vibrar ao terminar" checked={settings.vibrate} onChange={(v) => update({ vibrate: v })} />
            <SwitchRow label="Aviso em outra aba" checked={!!settings.notify} onChange={() => toggleNotify()} />
          </div>
          <p className="tiny faint">
            O alarme toca com o app aberto. O aviso em outra aba dispara quando o navegador permite em segundo plano (com a tela bloqueada,
            o sistema do celular pode congelar ou silenciar timers web). Mantenha a tela acesa durante o treino.
          </p>
        </FoldRow>
        <FoldRow
          key={`inc-${loaded}`}
          title="Incrementos e pesos"
          value={`Barra de ${formatWeight(settings.barWeightKg ?? 20)} kg · salto de carga e placas`}
        >
          <span className="label" id="bar-label">
            Peso da barra (conta das anilhas)
          </span>
          <div className="row-wrap" role="group" aria-labelledby="bar-label">
            {[20, 15, 10, 7].map((kg) => (
              <button
                key={kg}
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="toggle-chip"
                aria-pressed={(settings.barWeightKg ?? 20) === kg}
                onClick={() => update({ barWeightKg: kg === 20 ? undefined : kg })}
              >
                {kg} kg
              </button>
            ))}
          </div>
          <p className="tiny faint">Olímpica 20 kg, feminina 15 kg, barras menores 10 ou 7 kg. Em libras, 20 kg vira 45 lb.</p>
          <p className="small muted" style={{ marginTop: 8 }}>
            Defina o salto de carga padrão ou, se a polia/máquina tiver placas fora do padrão, informe os pesos disponíveis separados por
            vírgula ou espaço (ex.: <code>12,5 17,5 22,5 27,5</code>).
          </p>
          <div className="stack" style={{ marginTop: 10, gap: 12 }}>
            {programDays().flatMap((d) =>
              d.exercises.map((ex) => (
                <div key={ex.id} className="stack" style={{ gap: 4 }}>
                  <div className="spread small">
                    <span className="grow">
                      <strong>{shortName(ex)}</strong> <span className="faint">({d.name})</span>
                    </span>
                    <input
                      className="input"
                      style={{ width: 84, minHeight: 36, textAlign: "center" }}
                      inputMode="decimal"
                      aria-label={`Incremento de ${shortName(ex)}`}
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
                  </div>
                  <input
                    className="input"
                    style={{ minHeight: 34, fontSize: "var(--fs-2)" }}
                    aria-label={`Pesos disponíveis para ${shortName(ex)}`}
                    placeholder="Pinos da máquina (opcional, ex.: 10, 15, 20, 25)"
                    defaultValue={
                      settings.machineWeights?.[ex.id]?.length ? settings.machineWeights[ex.id].map((w) => formatWeight(w)).join(", ") : ""
                    }
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = { ...settings.machineWeights };
                      if (!raw) {
                        delete next[ex.id];
                      } else {
                        const nums = Array.from(
                          new Set(
                            raw
                              .split(/[;\s]+|,\s+(?=\d)/)
                              .flatMap((tok) =>
                                tok.includes(",") && tok.split(",").every((p) => Number.isInteger(Number(p))) && tok.split(",").length > 2
                                  ? tok.split(",")
                                  : [tok],
                              )
                              .map((s) => Number(s.replace(",", ".").trim()))
                              .filter((n) => Number.isFinite(n) && n > 0 && n <= 1000),
                          ),
                        ).sort((a, b) => a - b);
                        if (nums.length > 0) next[ex.id] = nums;
                        else delete next[ex.id];
                      }
                      update({ machineWeights: next });
                    }}
                  />
                </div>
              )),
            )}
          </div>
        </FoldRow>
        <FoldRow key={`swaps-${loaded}`} title="Rotação de acessórios" value="Trocar acessórios no fim do deload">
          <p className="small muted" style={{ marginTop: 8 }}>
            Ao fim do deload, troque 2–3 acessórios por alternativas da biblioteca. Os treinos novos já abrem com a variação escolhida,
            mantendo o histórico separado.
          </p>
          <div className="stack" style={{ marginTop: 10, gap: 10 }}>
            {programDays().flatMap((d) =>
              d.exercises
                .filter((ex) => (LIB_BY_ID[ex.lib]?.alternatives?.length ?? 0) > 0)
                .map((ex) => {
                  const alts = LIB_BY_ID[ex.lib]?.alternatives ?? [];
                  const cur = settings.swaps?.[ex.id] ?? "";
                  return (
                    <label key={ex.id} className="stack" style={{ gap: 4 }}>
                      <span className="small">
                        <strong>{shortName(ex)}</strong> <span className="faint">({d.name})</span>
                      </span>
                      <select
                        className="input"
                        value={cur}
                        onChange={(e) => {
                          const v = e.target.value;
                          const next = { ...settings.swaps };
                          if (!v) delete next[ex.id];
                          else next[ex.id] = v;
                          update({ swaps: next });
                        }}
                      >
                        <option value="">Titular: {shortName(ex)}</option>
                        {alts.map((a) => (
                          <option key={a} value={a}>
                            Alternativa: {a}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }),
            )}
          </div>
        </FoldRow>
      </GroupPanel>

      <GroupPanel label="Sistema">
        <FoldRow title="Treinador (IA)" value="Chave, modelo e profundidade">
          <p className="small muted">
            Chave da API da Anthropic, modelo e profundidade. A chave fica só neste aparelho e não vai no backup.
          </p>
          <Link to="/treinador?config=1" data-augmented-ui="tl-clip br-clip border" className="btn btn-sm">
            Configurar treinador
          </Link>
        </FoldRow>
        <FoldRow title="Efeitos visuais" value={{ max: "Máximo", auto: "Automático", min: "Mínimo" }[settings.fx ?? "auto"]}>
          <div className="row-wrap" role="group" aria-label="Nível dos efeitos visuais">
            {(
              [
                ["max", "Máximo"],
                ["auto", "Automático"],
                ["min", "Mínimo"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="toggle-chip"
                aria-pressed={(settings.fx ?? "auto") === v}
                onClick={() => update({ fx: v })}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="tiny faint">
            Automático: tudo ligado fora do treino e modo academia durante o protocolo (sem animações em loop, mais bateria). Mínimo: só o
            essencial, sem retícula de toque nem transições. O sistema em &quot;reduzir movimento&quot; sempre vence.
          </p>
        </FoldRow>
        <FoldRow title="Backup" value={settings.lastBackupAt ? `Último: ${shortDate(settings.lastBackupAt)}` : "Nunca exportado"}>
          <p className="small muted">
            Seus treinos ficam só neste aparelho. Exporte um backup de vez em quando e antes de trocar de celular ou limpar o navegador.
            {settings.lastBackupAt ? ` Último backup: ${shortDate(settings.lastBackupAt)}.` : ""}
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
          <div className="divider" />
          <ImportCsv />
        </FoldRow>
      </GroupPanel>

      <RestorePoints />

      <section className="danger-zone" aria-labelledby="danger-title">
        <div className="dz-head">
          <svg className="dz-icon" viewBox="0 0 64 56" aria-hidden="true">
            <path className="dz-tri" d="M32 3 L61 53 H3 Z" />
            <path className="dz-tri-in" d="M32 17 L49 46 H15 Z" />
            <rect x="29.5" y="23" width="5" height="13" />
            <rect x="29.5" y="39" width="5" height="5" />
          </svg>
          <div>
            <span className="dz-code">[ PERIGO ]</span>
            <h2 id="danger-title">Apagar dados</h2>
            <span className="dz-sub">Ação irreversível · aparelho local</span>
          </div>
        </div>
        <p className="dz-text">
          Apaga todos os treinos, medidas e ajustes deste aparelho. Um ponto de restauração com tudo fica guardado antes: exclua-o em Pontos
          de restauração se quiser limpar de vez.
          {online?.user
            ? " Com a conta online conectada, os treinos voltam da nuvem na próxima sincronização: saia da conta antes se quiser o aparelho vazio."
            : ""}
        </p>
        {wipe ? (
          <div className="row">
            <HoldButton
              className="btn-danger dz-btn grow"
              label="Apagar tudo"
              ms={1400}
              onConfirm={async () => {
                await createRestorePoint("antes-apagar");
                await db.sessions.clear();
                await db.kv.put({ key: "settings", value: DEFAULT_SETTINGS });
                await db.kv.delete("body-log");
                await loadActiveProgram();
                setWipe(false);
                toast("Dados apagados.", "danger");
              }}
            >
              Apagar tudo
            </HoldButton>
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={() => setWipe(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-danger dz-btn" onClick={() => setWipe(true)}>
            Apagar todos os treinos
          </button>
        )}
      </section>
    </div>
  );
}
