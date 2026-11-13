import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { FeedItem, FriendsResponse, PublicUser, RecordIn } from "../../server/src/protocol";
import { PageHead } from "../components/bits";
import { HoldButton } from "../components/HoldButton";
import { UserModeration } from "../components/UserModeration";
import { libraryName } from "../data/library-extended";
import { avatarSrc } from "../data/personas";
import { addDays, shortDate } from "../lib/dates";
import { useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { tonnes } from "../lib/profile";
import { sessionStats } from "../lib/sessions";
import { FoldRow, GroupPanel, LinkRow } from "../components/Pieces";
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
  const [settings] = useSettings();
  const sessions = useSessions();
  const today = useToday();
  const [friends, setFriends] = useState<FriendsResponse | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [offline, setOffline] = useState("");
  const [blocked, setBlocked] = useState<PublicUser[]>([]);
  const [shown, setShown] = useState(5); // transmissões: as 5 mais recentes, depois de 5 em 5
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
  // Ranking da semana: volume dos últimos 7 dias (o seu, do aparelho; o dos amigos, do feed).
  const since = addDays(today, -6);
  const byUser = new Map<string, { id: string; name: string; kg: number; me?: boolean }>();
  for (const f of fr.friends) byUser.set(f.id, { id: f.id, name: f.displayName, kg: 0 });
  for (const it of items) {
    if (it.date < since) continue;
    const cur = byUser.get(it.user.id) ?? { id: it.user.id, name: it.user.displayName, kg: 0 };
    cur.kg += it.volumeKg;
    byUser.set(it.user.id, cur);
  }
  const myKg = (sessions ?? [])
    .filter((s) => s.status === "done" && s.date >= since && s.date <= today)
    .reduce((a, s) => a + sessionStats(s).volumeKg, 0);
  byUser.set(user.id, { id: user.id, name: user.displayName, kg: myKg, me: true });
  const ranking = [...byUser.values()].sort((a, b) => b.kg - a.kg || (a.me ? -1 : b.me ? 1 : 0)).slice(0, 5);

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(`@${user!.username}`);
      toast("Seu @ foi copiado.", "ok");
    } catch {
      toast(`Seu @ é ${user!.username}`, "info");
    }
  }

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast(ok, "ok");
      await refresh();
    } catch (err) {
      toast(onlineErrorText(err), "warn");
    }
  }

  const noFriends = fr.friends.length === 0;
  const add = <AddFriend onDone={refresh} />;

  return (
    <div className="stack-lg squad-screen">
      <PageHead back="/" code="AUG.NET // ESQUADRÃO" title="Amigos" />

      <section data-augmented-ui="tl-clip br-clip border" className="card squad-head">
        <div className="squad-me">
          <span className="id-avatar sm" aria-hidden="true">
            <img src={avatarSrc(settings.persona)} alt="" width={56} height={56} />
          </span>
          <div className="squad-me-name">
            <strong>{user.displayName}</strong>
            <button
              type="button"
              className="squad-handle"
              onClick={copyHandle}
              aria-label={`Copiar @${user.username} para passar a quem quiser te adicionar`}
            >
              @{user.username} <span aria-hidden="true">⧉</span>
            </button>
          </div>
        </div>
        <dl className="workout-data squad-stats">
          <div>
            <dt>Amigos</dt>
            <dd>{fr.friends.length}</dd>
          </div>
          <div>
            <dt>Pedidos</dt>
            <dd className={fr.incoming.length ? "hot" : undefined}>{fr.incoming.length}</dd>
          </div>
          <div>
            <dt>Treinos 30d</dt>
            <dd>{items.length}</dd>
          </div>
        </dl>
      </section>

      {offline && (
        <p className="small warn-text" role="status">
          {offline}
          {online.social ? ` Mostrando o que veio ${agoText(online.social.at)}.` : ""}
        </p>
      )}

      {/* Sem nenhum amigo, adicionar é a primeira coisa a fazer. */}
      {noFriends && add}

      {fr.incoming.length > 0 && (
        <GroupPanel label={`Pedidos de amizade (${fr.incoming.length})`}>
          {fr.incoming.map((u) => (
            <div key={u.id} className="sq-request">
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
                  <button type="button" className="text-btn" onClick={() => act(() => removeFriend(u.id), "Pedido recusado.")}>
                    Recusar
                  </button>
                </span>
              </div>
              <UserModeration user={u} onDone={refresh} />
            </div>
          ))}
        </GroupPanel>
      )}

      {ranking.length > 1 && (
        <section data-augmented-ui="tl-clip br-clip border" className="card sq-rank" aria-label="Ranking da semana">
          <div className="sq-rank-head">
            <span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M12 22c4.4 0 7-3 7-7.2 0-3.3-2-6.4-5.8-9.7.2 3-1.4 4.7-2.4 5.4.1-3.8-2-6-2-6C6.2 7.6 5 10.7 5 14.3 5 18.6 7.7 22 12 22Z" />
              </svg>
              Ranking semanal
            </span>
            <small>VOLUME · 7 DIAS</small>
          </div>
          <ol>
            {ranking.map((r, i) => (
              <li key={r.id} className={r.me ? "you" : undefined}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <Sigil name={r.name} />
                <span>
                  {r.name}
                  {r.me && <em>Você</em>}
                </span>
                <strong>{tonnes(r.kg)}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="stack">
        <h2 className="list-label group-label">Transmissões do esquadrão</h2>
        {items.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat no-signal">
            <span className="radar" aria-hidden="true" />
            <strong>SEM SINAL</strong>
            <span className="small muted">
              {fr.friends.length
                ? "Nenhum treino dos seus amigos nos últimos 30 dias."
                : "Quando você tiver amigos, os treinos deles aparecem aqui."}
            </span>
          </div>
        ) : (
          <>
            <ul className="feed-posts">
              {items.slice(0, shown).map((it) => (
                <li key={`${it.user.id}-${it.id}`} data-augmented-ui="tl-clip br-clip border" className="card feed-post">
                  <div className="feed-post-head">
                    <Sigil name={it.user.displayName} />
                    <span className="friend-name">
                      <strong>{it.user.displayName}</strong>
                      <span className="tiny faint mono">
                        {it.title} · {shortDate(it.date)}
                      </span>
                    </span>
                    {it.prs > 0 && (
                      <span className="post-pr feed-pr-tag">
                        ★ {it.prs} recorde{it.prs > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <dl className="workout-data">
                    <div>
                      <dt>Séries</dt>
                      <dd>{it.sets}</dd>
                    </div>
                    <div>
                      <dt>Volume</dt>
                      <dd>{formatWeight(Math.round(it.volumeKg / 100) / 10)} t</dd>
                    </div>
                    {it.minutes > 0 && (
                      <div>
                        <dt>Tempo</dt>
                        <dd>{it.minutes} min</dd>
                      </div>
                    )}
                  </dl>
                </li>
              ))}
            </ul>
            {items.length > shown && (
              <button
                type="button"
                className="btn btn-ghost-line"
                data-augmented-ui="tl-clip br-clip border"
                onClick={() => setShown((n) => n + 5)}
              >
                Mostrar mais ({items.length - shown})
              </button>
            )}
          </>
        )}
      </section>

      {!noFriends && add}

      <GroupPanel label={`Seus amigos (${fr.friends.length})`}>
        {fr.friends.length === 0 ? (
          <p className="small muted sq-empty">Ninguém ainda. Adicione pelo nome de usuário.</p>
        ) : (
          fr.friends.map((f) => (
            <FriendRow key={f.id} friend={f} onRemove={() => act(() => removeFriend(f.id), "Amizade desfeita.")} onChange={refresh} />
          ))
        )}
        {fr.outgoing.length > 0 && (
          <FoldRow title="Pedidos enviados" value={`${fr.outgoing.length} esperando resposta`}>
            <ul className="friend-list">
              {fr.outgoing.map((u) => (
                <li key={u.id} className="friend-row">
                  <Name u={u} />
                  <button type="button" className="text-btn" onClick={() => act(() => removeFriend(u.id), "Pedido cancelado.")}>
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </FoldRow>
        )}
        {blocked.length > 0 && (
          <FoldRow title="Bloqueados" value={`${blocked.length} ${blocked.length === 1 ? "pessoa" : "pessoas"}`}>
            <ul className="friend-list">
              {blocked.map((u) => (
                <li key={u.id} className="friend-row">
                  <Name u={u} />
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => act(() => unblockUser(u.id), `${u.displayName} foi desbloqueado.`)}
                  >
                    Desbloquear
                  </button>
                </li>
              ))}
            </ul>
          </FoldRow>
        )}
        <LinkRow to="/privacidade" title="Privacidade e regras de convivência" />
      </GroupPanel>
    </div>
  );
}

/** Sigla do operador (iniciais) num hexágono, com a cor tirada do nome: cada amigo tem a sua. */
function Sigil({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="sigil" style={{ "--sig": `hsl(${h} 80% 60%)` } as CSSProperties} aria-hidden="true">
      {initials}
    </span>
  );
}

function Name({ u }: { u: PublicUser }) {
  return (
    <span className="friend-who">
      <Sigil name={u.displayName} />
      <span className="friend-name">
        <strong>{u.displayName}</strong>
        <span className="tiny faint mono">@{u.username}</span>
      </span>
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

  const term = q.trim().toLowerCase();
  const exact = found.some((u) => u.username === term);
  return (
    <section className="stack sq-add" aria-labelledby="fr-q-label">
      <h2 className="list-label group-label" id="fr-q-label">
        Adicionar amigo
      </h2>
      <form
        className="search-box"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (term) void send(term.replace(/^@/, ""));
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="fr-q"
          aria-labelledby="fr-q-label"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          value={q}
          onChange={(e) => setQ(e.target.value.replace(/\s/g, "").replace(/^@/, ""))}
          placeholder="Nome de usuário"
        />
      </form>
      {(found.length > 0 || (term.length >= 3 && !exact)) && (
        <ul className="suggest-list group-box" data-augmented-ui="tl-clip br-clip border" aria-label="Usuários encontrados">
          {found.map((u) => (
            <li key={u.id} className="sq-user">
              <Name u={u} />
              <button type="button" className="btn btn-sm btn-ghost-line" disabled={busy} onClick={() => send(u.username)}>
                Adicionar
              </button>
            </li>
          ))}
          {term.length >= 3 && !exact && (
            <li className="sq-user">
              <span className="friend-name">
                <strong>@{term}</strong>
                <span className="tiny faint mono">mandar pedido para este nome</span>
              </span>
              <button type="button" className="btn btn-sm btn-ghost-line" disabled={busy} onClick={() => send(term)}>
                Adicionar
              </button>
            </li>
          )}
        </ul>
      )}
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
    <div className={`sq-friend${open ? " open" : ""}`}>
      <button type="button" className="friend-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Name u={friend} />
        <span className="fold-chev" aria-hidden="true" />
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
    </div>
  );
}
