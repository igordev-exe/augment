import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { FeedItem, FriendsResponse, PublicUser, RecordIn } from "../../server/src/protocol";
import { PageHead } from "../components/bits";
import { HoldButton } from "../components/HoldButton";
import { UserModeration } from "../components/UserModeration";
import { libraryName } from "../data/library-extended";
import { shortDate } from "../lib/dates";
import { useSessions, useToast } from "../lib/hooks";
import {
  acceptFriend,
  getBlocked,
  getFeed,
  getFriends,
  removeFriend,
  requestFriend,
  searchUsers,
  unblockUser,
  userRecords,
} from "../lib/online/account";
import { apiUrl, onlineErrorText } from "../lib/online/client";
import { libraryBests, saveOnline, useOnline } from "../lib/online/sync";
import { formatWeight } from "../lib/progression";
import { agoText } from "./Online";

const EMPTY: FriendsResponse = { friends: [], incoming: [], outgoing: [] };

export function Friends() {
  const online = useOnline();
  const toast = useToast();
  const [friends, setFriends] = useState<FriendsResponse | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState("");
  const [blocked, setBlocked] = useState<PublicUser[]>([]);
  const user = online?.user;

  async function refresh() {
    try {
      const [f, fd, bl] = await Promise.all([getFriends(), getFeed(), getBlocked().catch(() => [])]);
      setFriends(f);
      setFeed(fd);
      setBlocked(bl);
      setOffline("");
      await saveOnline({ social: { friends: f, feed: fd, at: Date.now() } });
    } catch (err) {
      setOffline(onlineErrorText(err));
    }
  }

  // Busca ao abrir e sempre que o app volta para a frente (pedidos e treinos novos dos amigos).
  useEffect(() => {
    if (!user) return;
    void refresh();
    const onShow = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("online", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("online", onShow);
    };
  }, [user?.id]);

  if (online === undefined) return null;

  if (!user || !apiUrl()) {
    return (
      <div className="stack-lg">
        <PageHead back="/" code="AUG.NET // AMIGOS" title="Amigos" />
        <section data-augmented-ui="tl-clip br-clip border" className="card stack">
          <h2 className="h-sec">Treine junto, mesmo longe</h2>
          <p className="small muted">
            Com uma conta online você adiciona amigos, vê os treinos deles, compara recordes e descobre como você está em relação aos outros
            usuários. É opcional: sem conta, o app funciona igual.
          </p>
          <Link to="/online" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary">
            Criar conta ou entrar
          </Link>
        </section>
      </div>
    );
  }

  const fr = friends ?? online.social?.friends ?? EMPTY;
  const items = feed ?? online.social?.feed ?? [];

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok, "ok");
      await refresh();
    } catch (err) {
      toast(onlineErrorText(err), "warn");
    }
  }

  return (
    <div className="stack-lg">
      <PageHead
        back="/"
        code="AUG.NET // AMIGOS"
        title="Amigos"
        sub={`Você é @${user.username}. Passe esse nome para quem quiser te adicionar.`}
      />

      {offline && (
        <p className="small warn-text" role="status">
          {offline}
          {online.social ? ` Mostrando o que veio ${agoText(online.social.at)}.` : ""}
        </p>
      )}

      <AddFriend onDone={refresh} />

      {fr.incoming.length > 0 && (
        <section data-augmented-ui="tl-clip br-clip border" className="card hot stack">
          <h2 className="h-sec">Pedidos de amizade</h2>
          <ul className="friend-list">
            {fr.incoming.map((u) => (
              <li key={u.id} className="stack" style={{ gap: 6 }}>
                <div className="friend-row">
                  <Name u={u} />
                  <span className="actions">
                    <button
                      type="button"
                      data-augmented-ui="tl-clip br-clip border"
                      className="btn btn-sm btn-primary"
                      onClick={() => act(() => acceptFriend(u.id), `Agora você e ${u.displayName} são amigos.`)}
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      data-augmented-ui="tl-clip br-clip border"
                      className="btn btn-sm btn-ghost"
                      onClick={() => act(() => removeFriend(u.id), "Pedido recusado.")}
                    >
                      Recusar
                    </button>
                  </span>
                </div>
                <UserModeration user={u} onDone={refresh} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack">
        <h2 className="h-sec">Treinos dos amigos</h2>
        {items.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
            {fr.friends.length
              ? "Nenhum treino dos seus amigos nos últimos 30 dias."
              : "Quando você tiver amigos, os treinos deles aparecem aqui."}
          </div>
        ) : (
          <div data-augmented-ui="tl-clip br-clip border" className="card">
            <ul className="feed-list">
              {items.map((it) => (
                <li key={`${it.user.id}-${it.id}`} className="feed-item">
                  <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                    <span className="small">
                      <strong>{it.user.displayName}</strong> <span className="faint">· {shortDate(it.date)}</span>
                    </span>
                    <span>{it.title}</span>
                    <span className="feed-stats">
                      <span>{it.sets} séries</span>
                      <span>{formatWeight(Math.round(it.volumeKg / 100) / 10)} t</span>
                      {it.minutes > 0 && <span>{it.minutes} min</span>}
                      {it.prs > 0 && (
                        <span className="feed-pr">
                          {it.prs} recorde{it.prs > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="h-sec">Seus amigos ({fr.friends.length})</h2>
        {fr.friends.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
            Ninguém ainda. Adicione pelo nome de usuário logo acima.
          </div>
        ) : (
          <div data-augmented-ui="tl-clip br-clip border" className="card">
            <ul className="friend-list">
              {fr.friends.map((f) => (
                <FriendRow key={f.id} friend={f} onRemove={() => act(() => removeFriend(f.id), "Amizade desfeita.")} onChange={refresh} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {fr.outgoing.length > 0 && (
        <section className="stack">
          <h2 className="h-sec">Pedidos enviados</h2>
          <div data-augmented-ui="tl-clip br-clip border" className="card">
            <ul className="friend-list">
              {fr.outgoing.map((u) => (
                <li key={u.id} className="friend-row">
                  <Name u={u} />
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    onClick={() => act(() => removeFriend(u.id), "Pedido cancelado.")}
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {blocked.length > 0 && (
        <section className="stack">
          <h2 className="h-sec">Bloqueados ({blocked.length})</h2>
          <div data-augmented-ui="tl-clip br-clip border" className="card">
            <ul className="friend-list">
              {blocked.map((u) => (
                <li key={u.id} className="friend-row">
                  <Name u={u} />
                  <button
                    type="button"
                    data-augmented-ui="tl-clip br-clip border"
                    className="btn btn-sm btn-ghost"
                    onClick={() => act(() => unblockUser(u.id), `${u.displayName} foi desbloqueado.`)}
                  >
                    Desbloquear
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Link to="/privacidade" className="tap small">
        Privacidade e regras de convivência &gt;
      </Link>
    </div>
  );
}

function Name({ u }: { u: PublicUser }) {
  return (
    <span className="friend-name">
      <strong>{u.displayName}</strong>
      <span className="tiny faint mono">@{u.username}</span>
    </span>
  );
}

function AddFriend({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<PublicUser[]>([]);
  const [busy, setBusy] = useState(false);

  // Sugestões enquanto digita (espera 300 ms parado).
  useEffect(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(term)
        .then(setFound)
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function send(username: string) {
    setBusy(true);
    try {
      const r = await requestFriend(username);
      toast(
        r.status === "accepted" ? `Agora você e ${r.user.displayName} são amigos.` : `Pedido enviado para ${r.user.displayName}.`,
        "ok",
      );
      setQ("");
      setFound([]);
      onDone();
    } catch (err) {
      toast(onlineErrorText(err), "warn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <h2 className="h-sec">Adicionar amigo</h2>
      <form
        className="stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (q.trim()) void send(q.trim().toLowerCase().replace(/^@/, ""));
        }}
      >
        <label className="label" htmlFor="fr-q">
          Nome de usuário
        </label>
        <input
          id="fr-q"
          className="input"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={q}
          onChange={(e) => setQ(e.target.value.replace(/\s/g, ""))}
          placeholder="@usuario"
        />
        {found.length > 0 && (
          <ul className="suggest-list" aria-label="Usuários encontrados">
            {found.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  data-augmented-ui="tl-clip br-clip border"
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => send(u.username)}
                >
                  + {u.displayName} <span className="faint">@{u.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="submit" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" disabled={busy || q.trim().length < 3}>
          Enviar pedido
        </button>
      </form>
    </section>
  );
}

/** Amigo: toque abre a comparação de recordes nos exercícios que os dois fazem. */
function FriendRow({ friend, onRemove, onChange }: { friend: PublicUser; onRemove: () => void; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [theirs, setTheirs] = useState<RecordIn[] | null>(null);
  const [error, setError] = useState("");
  const sessions = useSessions();
  const mine = useMemo(() => new Map(libraryBests(sessions ?? []).map((r) => [r.lib, r])), [sessions]);

  useEffect(() => {
    if (!open || theirs) return;
    userRecords(friend.id)
      .then(setTheirs)
      .catch((err) => setError(onlineErrorText(err)));
  }, [open, theirs, friend.id]);

  const common = (theirs ?? [])
    .filter((r) => mine.has(r.lib))
    .sort((a, b) => (libraryName(a.lib) ?? a.lib).localeCompare(libraryName(b.lib) ?? b.lib));

  return (
    <li className="stack" style={{ gap: 8, padding: "6px 0" }}>
      <button type="button" className="friend-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Name u={friend} />
        <span className="arrow" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="stack" style={{ gap: 8 }}>
          {error && <p className="small warn-text">{error}</p>}
          {theirs && common.length === 0 && (
            <p className="small muted">
              Vocês ainda não têm recordes no mesmo exercício (ou {friend.displayName} não compartilha os recordes).
            </p>
          )}
          {common.length > 0 && (
            <div className="table-wrap">
              <table className="t cmp-table">
                <thead>
                  <tr>
                    <th>Exercício (1RM est.)</th>
                    <th className="r">Você</th>
                    <th className="r">{friend.displayName.split(" ")[0]}</th>
                  </tr>
                </thead>
                <tbody>
                  {common.map((r) => {
                    const me = mine.get(r.lib)!;
                    return (
                      <tr key={r.lib}>
                        <td>
                          <Link className="tap" to={`/exercicios/${r.lib}`}>
                            {libraryName(r.lib) ?? r.lib}
                          </Link>
                        </td>
                        <td className={`r${me.e1rmKg > r.e1rmKg ? " win" : ""}`}>{formatWeight(Math.round(me.e1rmKg))}</td>
                        <td className={`r${r.e1rmKg > me.e1rmKg ? " win" : ""}`}>{formatWeight(Math.round(r.e1rmKg))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <HoldButton className="btn btn-sm btn-ghost" label={`Desfazer amizade com ${friend.displayName}`} ms={1000} onConfirm={onRemove}>
            Segure para desfazer amizade
          </HoldButton>
          <UserModeration user={friend} onDone={onChange} />
        </div>
      )}
    </li>
  );
}
