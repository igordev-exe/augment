import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { USERNAME_RE, type BackupMeta, type Sex } from "../../server/src/protocol";
import { PageHead } from "../components/bits";
import { HoldButton } from "../components/HoldButton";
import { useBodyLog, useSessions, useSettings, useToast } from "../lib/hooks";
import { changePassword, deleteAccount, login, logout, newRecoveryCode, recover, register, updateProfile } from "../lib/online/account";
import { apiUrl, hasCustomApiUrl, onlineErrorText, setApiUrl } from "../lib/online/client";
import { listCloudBackups, restoreCloudBackup, saveOnline, syncNow, useOnline, type OnlineState } from "../lib/online/sync";
import { parseNum } from "../components/SetRow";

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function agoText(ms: number | undefined, now = Date.now()): string {
  if (!ms) return "nunca";
  const min = Math.round((now - ms) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

function dateTime(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function sizeText(bytes: number): string {
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`;
}

export function Online() {
  const online = useOnline();
  const [freshCode, setFreshCode] = useState<string | null>(null);
  const [, setServerTick] = useState(0);
  const url = apiUrl();

  return (
    <div className="stack-lg">
      <PageHead
        back="/ajustes"
        code="AUG.NET // CONTA ONLINE"
        title="Conta online"
        sub="Opcional. Sem conta, o app funciona igual, só no aparelho."
      />

      {freshCode && (
        <RecoveryCodeCard
          code={freshCode}
          onDone={() => {
            setFreshCode(null);
            void saveOnline({ recoveryAck: true });
          }}
        />
      )}

      {!url ? (
        <section data-augmented-ui="tl-clip br-clip border" className="card stack">
          <h2 className="h-sec">Servidor não configurado</h2>
          <p className="small muted">
            Esta versão do app não tem um servidor online. Se você tiver o endereço de um servidor do AUGMENT, coloque em
            &quot;Servidor&quot; logo abaixo.
          </p>
        </section>
      ) : online === undefined ? null : online.user ? (
        <SignedIn online={online} showingCode={!!freshCode} onRecoveryCode={setFreshCode} />
      ) : (
        <SignedOut onRecoveryCode={setFreshCode} lastError={online.lastError} />
      )}

      <HowItWorks />
      <Link to="/privacidade" className="tap small">
        Política de privacidade: o que vai para o servidor &gt;
      </Link>
      <ServerCard onChange={() => setServerTick((n) => n + 1)} />
    </div>
  );
}

// ---------- sem conta ----------

type Mode = "entrar" | "criar" | "recuperar";

function SignedOut({ onRecoveryCode, lastError }: { onRecoveryCode: (code: string) => void; lastError?: string }) {
  const [settings] = useSettings();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("entrar");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(settings.operator);
  const [code, setCode] = useState("");
  const [sharePercentiles, setSharePercentiles] = useState(true);
  const [shareActivity, setShareActivity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Os ajustes carregam depois do primeiro desenho: preenche o nome com o "como o app te chama".
  useEffect(() => {
    if (settings.operator) setDisplayName((cur) => cur || settings.operator);
  }, [settings.operator]);

  const user = username.trim().toLowerCase();
  const userOk = USERNAME_RE.test(user);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode !== "entrar" && !userOk) return setError("Usuário: de 3 a 20 letras minúsculas, números, ponto ou _ (sem espaço nem acento).");
    if (mode !== "entrar" && password.length < 8) return setError("A senha precisa de pelo menos 8 caracteres.");
    setBusy(true);
    try {
      if (mode === "entrar") {
        await login(user, password);
        toast("Conta conectada. Sincronizando…", "ok");
      } else if (mode === "criar") {
        const r = await register({ username: user, password, displayName: displayName.trim() || user, sharePercentiles, shareActivity });
        if (r.recoveryCode) onRecoveryCode(r.recoveryCode);
        toast("Conta criada.", "ok");
      } else {
        const r = await recover(user, code, password);
        if (r.recoveryCode) onRecoveryCode(r.recoveryCode);
        toast("Senha trocada. Guarde o código novo.", "ok");
      }
    } catch (err) {
      setError(onlineErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <div className="row-wrap" role="group" aria-label="O que você quer fazer">
        {(
          [
            ["entrar", "Entrar"],
            ["criar", "Criar conta"],
            ["recuperar", "Esqueci a senha"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="toggle-chip"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {lastError && mode === "entrar" && <p className="small warn-text">{lastError}</p>}

      <form className="stack" onSubmit={submit} noValidate>
        <label className="label" htmlFor="on-user">
          Usuário
        </label>
        <input
          id="on-user"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
          placeholder="ex.: ana.silva"
        />
        {mode !== "entrar" && username && !userOk && (
          <span className="tiny faint">3 a 20 caracteres: letras minúsculas, números, ponto ou _.</span>
        )}

        {mode === "criar" && (
          <>
            <label className="label" htmlFor="on-name">
              Nome que os amigos veem
            </label>
            <input
              id="on-name"
              className="input"
              maxLength={24}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome"
            />
          </>
        )}

        {mode === "recuperar" && (
          <>
            <label className="label" htmlFor="on-code">
              Código de recuperação
            </label>
            <input
              id="on-code"
              className="input mono"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
            <span className="tiny faint">É o código que o app mostrou quando você criou a conta.</span>
          </>
        )}

        <label className="label" htmlFor="on-pass">
          {mode === "recuperar" ? "Senha nova" : "Senha"}
        </label>
        <input
          id="on-pass"
          className="input"
          type="password"
          autoComplete={mode === "entrar" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "entrar" ? "" : "Pelo menos 8 caracteres"}
        />

        {mode === "criar" && (
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Privacidade (dá para mudar depois)</span>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="toggle-chip wide"
              aria-pressed={sharePercentiles}
              onClick={() => setSharePercentiles(!sharePercentiles)}
            >
              Entrar na comparação com todos (anônimo)
            </button>
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="toggle-chip wide"
              aria-pressed={shareActivity}
              onClick={() => setShareActivity(!shareActivity)}
            >
              Amigos veem meus treinos e recordes
            </button>
            <p className="tiny faint">
              Na comparação ninguém vê seu nome: só entra a sua melhor marca em cada exercício. Seus treinos completos ficam no celular e no
              seu backup, que só você acessa. As fotos do corpo não vão para o servidor.{" "}
              <Link to="/privacidade" className="tap">
                Ler a política de privacidade
              </Link>
            </p>
          </div>
        )}

        {error && (
          <p className="small warn-text" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          data-augmented-ui="tl-clip br-clip border"
          className="btn btn-primary"
          disabled={busy || !username || !password}
        >
          {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Trocar a senha"}
        </button>
      </form>
    </section>
  );
}

function RecoveryCodeCard({ code, onDone }: { code: string; onDone: () => void }) {
  const toast = useToast();
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card hot stack" aria-live="polite">
      <h2 className="h-sec">Guarde seu código de recuperação</h2>
      <p className="small">Se esquecer a senha, é com ele que você volta para a conta. O app não mostra este código de novo.</p>
      <p className="recovery-code mono">{code}</p>
      <div className="row-wrap">
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              toast("Código copiado. Cole num lugar seguro (anotações, gerenciador de senhas).", "ok");
            } catch {
              toast("Não consegui copiar. Anote o código à mão.", "warn");
            }
          }}
        >
          Copiar código
        </button>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" onClick={onDone}>
          Já guardei
        </button>
      </div>
    </section>
  );
}

// ---------- com conta ----------

function SignedIn({
  online,
  showingCode,
  onRecoveryCode,
}: {
  online: OnlineState;
  showingCode: boolean;
  onRecoveryCode: (code: string) => void;
}) {
  const user = online.user!;
  const toast = useToast();
  const [settings, saveSettings] = useSettings();
  const sessions = useSessions();
  const [syncing, setSyncing] = useState(false);
  const [backups, setBackups] = useState<BackupMeta[] | null>(null);
  const [backupError, setBackupError] = useState("");
  const [restoring, setRestoring] = useState<string | null>(null);
  const localDone = (sessions ?? []).filter((s) => s.status === "done").length;
  const incoming = online.social?.friends.incoming.length ?? 0;

  async function refreshBackups() {
    try {
      setBackups(await listCloudBackups());
      setBackupError("");
    } catch (err) {
      setBackupError(onlineErrorText(err));
    }
  }

  useEffect(() => {
    void refreshBackups();
  }, [online.backupAt]);

  async function syncClick() {
    setSyncing(true);
    const st = await syncNow("manual");
    setSyncing(false);
    if (st?.lastError) toast(st.lastError, "warn");
    else toast("Tudo sincronizado.", "ok");
  }

  return (
    <>
      {!showingCode && <RecoveryCard remind={!online.recoveryAck} onCode={onRecoveryCode} />}
      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <div className="spread">
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <strong className="h-card">{user.displayName}</strong>
            <span className="small faint mono">@{user.username}</span>
          </div>
          <span className={`sync-led${online.lastError ? " off" : ""}`} aria-hidden="true" />
        </div>
        <p className="small" role="status">
          {online.lastError ? online.lastError : `Sincronizado ${agoText(online.lastSyncAt)}.`}
        </p>
        <div className="row-wrap">
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn btn-primary"
            onClick={syncClick}
            disabled={syncing}
          >
            {syncing ? "Sincronizando…" : "Sincronizar agora"}
          </button>
          <Link to="/amigos" data-augmented-ui="tl-clip br-clip border" className="btn">
            Amigos{incoming ? ` (${incoming} pedido${incoming > 1 ? "s" : ""})` : ""}
          </Link>
        </div>
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Backup automático</h2>
        <p className="small muted">
          Ao terminar um treino, ao sair do app e a cada 15 minutos (se algo mudou), uma cópia de tudo vai para a nuvem. Ficam as 5 mais
          recentes. Último envio: {online.backupAt ? `${dateTime(online.backupAt)} (${agoText(online.backupAt)})` : "ainda nenhum"}.
        </p>
        {backupError && <p className="small warn-text">{backupError}</p>}
        {backups && backups.length === 0 && (
          <p className="small faint">Nenhum backup na nuvem ainda. Ele sobe depois do primeiro treino concluído.</p>
        )}
        {backups && backups.length > 0 && localDone === 0 && (
          <p className="small strong-note">
            Este aparelho está sem treinos e há um backup na nuvem com {backups[0].sessions} treinos. Restaure para continuar de onde parou.
          </p>
        )}
        {backups && backups.length > 0 && (
          <ul className="cloud-list">
            {backups.map((b, i) => (
              <li key={b.id} className="cloud-item">
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <strong className="small">
                    {dateTime(b.createdAt)}
                    {i === 0 ? " · mais recente" : ""}
                  </strong>
                  <span className="tiny faint">
                    {b.sessions} treinos · {sizeText(b.size)}
                  </span>
                </div>
                {restoring === b.id ? (
                  <HoldButton
                    className="btn btn-sm"
                    label="Restaurar este backup"
                    ms={1200}
                    onConfirm={async () => {
                      try {
                        const n = await restoreCloudBackup(b.id);
                        toast(`${n} treinos restaurados da nuvem.`, "ok");
                      } catch (err) {
                        toast(onlineErrorText(err), "warn");
                      }
                      setRestoring(null);
                    }}
                  >
                    Segure
                  </HoldButton>
                ) : (
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className={`btn btn-sm${i === 0 && localDone === 0 ? " btn-primary" : ""}`}
                    onClick={() => setRestoring(b.id)}
                  >
                    Restaurar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="tiny faint">
          Restaurar troca os dados deste aparelho pelos do backup. Antes, o estado atual vira um ponto de restauração.
        </p>
        <div className="divider" />
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="toggle-chip wide"
          aria-pressed={settings.cloudPhotos === true}
          onClick={async () => {
            await saveSettings({ cloudPhotos: !settings.cloudPhotos });
            void syncNow("manual");
          }}
        >
          Incluir fotos do corpo no backup da nuvem
        </button>
        <p className="tiny faint">
          {settings.cloudPhotos
            ? "As fotos do corpo sobem junto com o backup. Desligue para o próximo backup ir sem elas."
            : "Desligado: as fotos do corpo ficam só neste aparelho e nunca vão para o servidor. Para guardar as fotos, use Ajustes > Exportar backup."}
        </p>
      </section>

      <Privacy online={online} />
      <FairCompare online={online} />
      <Security />
    </>
  );
}

function Privacy({ online }: { online: OnlineState }) {
  const user = online.user!;
  const toast = useToast();
  const [name, setName] = useState(user.displayName);

  async function save(patch: Parameters<typeof updateProfile>[0]) {
    try {
      await updateProfile(patch);
    } catch (err) {
      toast(onlineErrorText(err), "warn");
    }
  }

  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <h2 className="h-sec">Perfil e privacidade</h2>
      <label className="label" htmlFor="on-display">
        Nome que os amigos veem
      </label>
      <input
        id="on-display"
        className="input"
        maxLength={24}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== user.displayName && save({ displayName: name.trim() })}
      />
      <button
        type="button"
        data-augmented-ui="tl-clip br-clip border"
        className="toggle-chip wide"
        aria-pressed={user.sharePercentiles}
        onClick={() => save({ sharePercentiles: !user.sharePercentiles })}
      >
        Entrar na comparação com todos (anônimo)
      </button>
      <button
        type="button"
        data-augmented-ui="tl-clip br-clip border"
        className="toggle-chip wide"
        aria-pressed={user.shareActivity}
        onClick={() => save({ shareActivity: !user.shareActivity })}
      >
        Amigos veem meus treinos e recordes
      </button>
      <p className="tiny faint">Fora da comparação, você continua vendo a sua posição, mas ninguém conta a sua marca.</p>
    </section>
  );
}

/** Sexo e peso corporal (opcionais): comparação dentro da própria faixa e força relativa. */
function FairCompare({ online }: { online: OnlineState }) {
  const user = online.user!;
  const toast = useToast();
  const bodyLog = useBodyLog();
  const sex: Sex = user.sex ?? "";
  const [kg, setKg] = useState(user.bodyweightKg ? String(user.bodyweightKg).replace(".", ",") : "");
  const lastKg = [...(bodyLog ?? [])].sort((a, b) => b.date.localeCompare(a.date)).find((e) => e.weightKg)?.weightKg;

  async function save(patch: Parameters<typeof updateProfile>[0], ok: string) {
    try {
      await updateProfile(patch);
      toast(ok, "ok");
    } catch (err) {
      toast(onlineErrorText(err), "warn");
    }
  }

  const typed = parseNum(kg);
  const changed = kg.trim() === "" ? user.bodyweightKg != null : typed !== user.bodyweightKg;

  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <h2 className="h-sec">Comparação mais justa (opcional)</h2>
      <p className="small muted">
        Informe sexo e peso para o app te comparar também com pessoas parecidas com você e pela força relativa (quanto você levanta por
        quilo de peso corporal). Ninguém vê esses dados: eles só entram na conta da porcentagem.
      </p>
      <span className="label" id="fair-sex">
        Sexo
      </span>
      <div className="row-wrap" role="group" aria-labelledby="fair-sex">
        {(
          [
            ["", "Não informar"],
            ["f", "Feminino"],
            ["m", "Masculino"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id || "nenhum"}
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="toggle-chip"
            aria-pressed={sex === id}
            onClick={() => sex !== id && save({ sex: id }, "Comparação atualizada.")}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="label" htmlFor="fair-kg">
        Peso corporal (kg)
      </label>
      <input
        id="fair-kg"
        className="input"
        inputMode="decimal"
        value={kg}
        onChange={(e) => setKg(e.target.value)}
        placeholder={lastKg ? `Ex.: ${String(lastKg).replace(".", ",")}` : "Ex.: 72,5"}
      />
      <div className="row-wrap">
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn"
          disabled={!changed || (kg.trim() !== "" && typed == null)}
          onClick={() =>
            kg.trim() === ""
              ? save({ bodyweightKg: null }, "Peso removido da comparação.")
              : typed != null && save({ bodyweightKg: typed }, "Comparação atualizada.")
          }
        >
          Salvar peso
        </button>
        {lastKg && lastKg !== user.bodyweightKg && (
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn btn-ghost"
            onClick={() => {
              setKg(String(lastKg).replace(".", ","));
              void save({ bodyweightKg: lastKg }, "Comparação atualizada.");
            }}
          >
            Usar meu último peso ({String(lastKg).replace(".", ",")} kg)
          </button>
        )}
      </div>
      <p className="tiny faint">
        Faixa de peso: pessoas com até 10% a mais ou a menos que você. Atualize quando o seu peso mudar; deixe em branco e salve para
        remover.
      </p>
    </section>
  );
}

/** Sem e-mail, o código de recuperação é a única volta se a senha for esquecida: lembra de guardar e gera outro. */
function RecoveryCard({ remind, onCode }: { remind: boolean; onCode: (code: string) => void }) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const form = (
    <form
      className="stack"
      style={{ marginTop: 10 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          onCode(await newRecoveryCode(pass));
          setPass("");
          setAsking(false);
          window.scrollTo({ top: 0 });
        } catch (err) {
          toast(onlineErrorText(err), "warn");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="label" htmlFor="rc-pass">
        Confirme sua senha
      </label>
      <input
        id="rc-pass"
        className="input"
        type="password"
        autoComplete="current-password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      <button type="submit" data-augmented-ui="tl-clip br-clip border" className="btn" disabled={!pass || busy}>
        {busy ? "Aguarde…" : "Gerar código novo"}
      </button>
      <p className="tiny faint">O código antigo deixa de valer na hora.</p>
    </form>
  );

  if (!remind) {
    return (
      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <details>
          <summary className="h-sec" style={{ cursor: "pointer" }}>
            Código de recuperação
          </summary>
          <p className="small muted" style={{ marginTop: 10 }}>
            Perdeu o código que recebeu ao criar a conta? Gere outro aqui, enquanto ainda está logado. Sem ele, quem esquece a senha não
            consegue voltar para a conta.
          </p>
          {form}
        </details>
      </section>
    );
  }

  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card hot stack">
      <h2 className="h-sec">Você guardou o código de recuperação?</h2>
      <p className="small">
        Esta conta não usa e-mail. Se você esquecer a senha, o código de recuperação é o único jeito de voltar. Se perdeu ou não anotou,
        gere um novo agora.
      </p>
      {asking ? (
        form
      ) : (
        <div className="row-wrap">
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" onClick={() => setAsking(true)}>
            Gerar um código novo
          </button>
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn"
            onClick={() => saveOnline({ recoveryAck: true })}
          >
            Já tenho guardado
          </button>
        </div>
      )}
    </section>
  );
}

function Security() {
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [delPass, setDelPass] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <details>
          <summary className="h-sec" style={{ cursor: "pointer" }}>
            Trocar a senha
          </summary>
          <form
            className="stack"
            style={{ marginTop: 10 }}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await changePassword(cur, next);
                setCur("");
                setNext("");
                toast("Senha trocada. Os outros aparelhos vão pedir login de novo.", "ok");
              } catch (err) {
                toast(onlineErrorText(err), "warn");
              }
            }}
          >
            <label className="label" htmlFor="pw-cur">
              Senha atual
            </label>
            <input
              id="pw-cur"
              className="input"
              type="password"
              autoComplete="current-password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
            />
            <label className="label" htmlFor="pw-new">
              Senha nova
            </label>
            <input
              id="pw-new"
              className="input"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <button type="submit" data-augmented-ui="tl-clip br-clip border" className="btn" disabled={!cur || next.length < 8}>
              Trocar a senha
            </button>
          </form>
        </details>
        <div className="divider" />
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn"
          onClick={async () => {
            await logout();
            toast("Você saiu da conta. Os treinos continuam neste aparelho.", "info");
          }}
        >
          Sair da conta
        </button>
        <p className="tiny faint">Sair não apaga nada do celular: só para de sincronizar.</p>
      </section>

      <section className="danger-zone" aria-labelledby="del-title">
        <div className="dz-head">
          <div>
            <span className="dz-code">[ PERIGO ]</span>
            <h2 id="del-title">Apagar conta online</h2>
            <span className="dz-sub">Servidor · irreversível</span>
          </div>
        </div>
        <p className="dz-text">
          Apaga do servidor sua conta, amizades, recordes, treinos resumidos e backups. O que está neste celular continua.
        </p>
        {confirmDelete ? (
          <div className="stack">
            <label className="label" htmlFor="del-pass">
              Sua senha
            </label>
            <input
              id="del-pass"
              className="input"
              type="password"
              autoComplete="current-password"
              value={delPass}
              onChange={(e) => setDelPass(e.target.value)}
            />
            <div className="row">
              <HoldButton
                className="btn-danger dz-btn grow"
                label="Apagar conta"
                ms={1400}
                onConfirm={async () => {
                  try {
                    await deleteAccount(delPass);
                    toast("Conta apagada do servidor.", "danger");
                  } catch (err) {
                    toast(onlineErrorText(err), "warn");
                  }
                }}
              >
                Apagar conta
              </HoldButton>
              <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-augmented-ui="tl-clip br-clip border"
            className="btn btn-danger dz-btn"
            onClick={() => setConfirmDelete(true)}
          >
            Apagar minha conta
          </button>
        )}
      </section>
    </>
  );
}

// ---------- explicação e servidor ----------

function HowItWorks() {
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <details>
        <summary className="h-sec" style={{ cursor: "pointer" }}>
          Como o online funciona
        </summary>
        <ul className="small muted prose-list">
          <li>O celular é o principal: você treina, registra e vê tudo sem internet, como sempre.</li>
          <li>Com conta e internet, o app envia uma cópia: suas melhores marcas, o resumo de cada treino e o backup completo.</li>
          <li>Sem internet, nada se perde: o envio fica para quando a conexão voltar (o app tenta ao abrir, ao sair e a cada 15 min).</li>
          <li>Em outro celular, entre na mesma conta e restaure o backup mais recente.</li>
          <li>
            A comparação usa o 1RM estimado e a maior carga, em kg, no mesmo exercício da biblioteca. Aparelhos de marcas diferentes podem
            pesar diferente: trate como referência, não como placar exato.
          </li>
        </ul>
      </details>
    </section>
  );
}

function ServerCard({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(apiUrl());
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <details>
        <summary className="h-sec" style={{ cursor: "pointer" }}>
          Servidor
        </summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <label className="label" htmlFor="on-url">
            Endereço do servidor
          </label>
          <input
            id="on-url"
            className="input mono"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://augment-api.seu-nome.workers.dev"
          />
          <div className="row-wrap">
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn"
              onClick={async () => {
                const v = value.trim();
                if (v && !/^https?:\/\//.test(v)) return toast("O endereço começa com https://", "warn");
                setApiUrl(v);
                onChange();
                if (!v) return toast("Usando o servidor padrão do app.", "info");
                try {
                  const r = await fetch(`${apiUrl()}/health`);
                  toast(
                    r.ok
                      ? "Servidor respondeu. Pode entrar ou criar a conta."
                      : "O endereço respondeu, mas não parece um servidor do AUGMENT.",
                    r.ok ? "ok" : "warn",
                  );
                } catch {
                  toast("Não consegui falar com esse endereço.", "warn");
                }
              }}
            >
              Salvar e testar
            </button>
            {hasCustomApiUrl() && (
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-ghost"
                onClick={() => {
                  setApiUrl("");
                  setValue(apiUrl());
                  onChange();
                }}
              >
                Voltar ao padrão
              </button>
            )}
          </div>
          <p className="tiny faint">Só mexa aqui se você hospedou o próprio servidor. Contas de um servidor não existem nos outros.</p>
        </div>
      </details>
    </section>
  );
}
