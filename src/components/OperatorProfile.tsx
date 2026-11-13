import { useMemo, useState, type ReactNode } from "react";
import { RankRow } from "./RankRow";
import { Ticker } from "./Ticker";
import { Link } from "react-router-dom";
import type { Session } from "../data/types";
import { avatarSrc } from "../data/personas";
import { dayOf } from "../data/program";
import { shortDate } from "../lib/dates";
import { operatorSerial, profileTelemetry, rankOf, sessionTopKg, tonnes } from "../lib/profile";
import { formatWeight, prsBySession } from "../lib/progression";
import { sessionStats } from "../lib/sessions";
import { weekStreaks } from "../lib/visual";
import { useOperatorMemory } from "../lib/hooks";

// Perfil do operador (design "Perfil e Amigos Cyberpunk"): capa com grade, avatar sobre a capa, nome com o posto ao
// lado, etiquetas, quatro números e abas: Atividade (os últimos treinos), Telemetria (volume de 8 semanas) e, quando a
// tela passa `account`, Conta (a administração da conta, fora da rolagem do perfil). Tudo vem do histórico do aparelho;
// o que o servidor não tem (seguidores, curtidas) não aparece.

export type ProfileTab = "atividade" | "telemetria" | "conta";

export function OperatorProfile({
  user,
  persona,
  sessions,
  friends,
  pendingFriends = 0,
  today,
  tags,
  weeklyTarget,
  children,
  account,
  notice,
  tab: tabProp,
  onTab,
}: {
  user: { id: string; displayName: string; username: string };
  persona?: string;
  sessions: Session[];
  friends: number;
  /** Pedidos de amizade esperando: aparecem na célula "Amigos", que leva a #/amigos. */
  pendingFriends?: number;
  today: string;
  /** Etiquetas do operador (programa, semana do meso…). */
  tags: string[];
  /** Treinos por semana que contam para a sequência. */
  weeklyTarget: number;
  /** Linha discreta embaixo do cartão (estado da nuvem). Sem botões grandes. */
  children?: ReactNode;
  /** Conteúdo da aba Conta. Sem ele, só as duas abas do perfil. */
  account?: ReactNode;
  /** Aviso curto logo depois do cartão (ex.: guardar o código de recuperação). */
  notice?: ReactNode;
  tab?: ProfileTab;
  onTab?: (t: ProfileTab) => void;
}) {
  const [own, setOwn] = useState<ProfileTab>("atividade");
  const tab = tabProp ?? own;
  const setTab = onTab ?? setOwn;
  const done = useMemo(() => sessions.filter((s) => s.status === "done"), [sessions]);
  const prs = useMemo(() => prsBySession(done), [done]);
  const recordExercises = useMemo(() => new Set([...prs.values()].flat().map((p) => p.exId)).size, [prs]);
  const [memory] = useOperatorMemory();
  const streak = weekStreaks(done, today, weeklyTarget, memory.absences).streak;
  const tele = useMemo(() => profileTelemetry(done, today), [done, today]);
  const recent = useMemo(() => [...done].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, 3), [done]);
  const maxWeek = Math.max(1, ...tele.weeks.map((w) => w.volumeKg));
  const tabs: [ProfileTab, string, string][] = [
    ["atividade", "Atividade", "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
    ["telemetria", "Telemetria", "M3 12h4l2.2-6 4.2 12 2.2-6H21"],
  ];
  if (account) tabs.push(["conta", "Conta", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"]);

  return (
    <>
      <section data-augmented-ui="tl-clip br-clip border" className="card op-card">
        <div className="op-cover" aria-hidden="true">
          <span className="op-cover-grid" />
          <span className="op-serial">ID // {operatorSerial(user.id)}</span>
          <span className="op-cover-scan" />
        </div>
        <div className="op-main">
          <span className="id-avatar op-avatar" aria-hidden="true">
            <img src={avatarSrc(persona)} alt="" width={86} height={86} />
          </span>
          <div className="op-identity">
            <h2>
              <span className="op-name">{user.displayName}</span>
              <span className="op-rank">{rankOf(done.length)}</span>
            </h2>
            <span className="op-handle">@{user.username}</span>
          </div>
        </div>
        <RankRow done={done.length} />
        {tags.length > 0 && (
          <ul className="op-tags">
            {tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <dl className="op-stats">
          <div>
            <dd>
              <Ticker value={done.length} />
            </dd>
            <dt>Sessões</dt>
          </div>
          <div>
            <dd>
              <Ticker value={recordExercises} />
            </dd>
            <dt>Recordes</dt>
          </div>
          <div className="op-stat-link">
            <Link to="/amigos" aria-label={`Amigos: ${friends}${pendingFriends ? `, ${pendingFriends} pedido(s) esperando` : ""}`}>
              <dd>
                {friends}
                {pendingFriends > 0 && <small className="op-pending">+{pendingFriends}</small>}
              </dd>
              <dt>Amigos ›</dt>
            </Link>
          </div>
          <div>
            <dd>
              <Ticker value={streak} />
              <small>sem</small>
            </dd>
            <dt>Sequência</dt>
          </div>
        </dl>
        {children && <div className="op-foot">{children}</div>}
      </section>
      {notice}

      <div className={`op-tabs${account ? " three" : ""}`} role="tablist" aria-label="Perfil">
        {tabs.map(([id, label, d]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="aim"
            id={`op-tab-${id}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d={d} />
            </svg>
            {label}
          </button>
        ))}
      </div>

      {tab === "conta" && account ? (
        <div role="tabpanel" aria-labelledby="op-tab-conta" className="stack-lg op-account">
          {account}
        </div>
      ) : tab === "atividade" ? (
        recent.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat no-signal">
            <span className="radar" aria-hidden="true" />
            <strong>SEM TRANSMISSÕES</strong>
            <span className="small muted">Seus treinos concluídos aparecem aqui.</span>
          </div>
        ) : (
          <ul className="feed-posts">
            {recent.map((s) => (
              <WorkoutPost key={s.id} session={s} pr={prs.get(s.id)?.length ?? 0} />
            ))}
          </ul>
        )
      ) : (
        <section data-augmented-ui="tl-clip br-clip border" className="card op-tele">
          <div className="op-tele-head">
            <div>
              <span>Volume // 8 semanas</span>
              <strong className={tele.volumeChangePct != null && tele.volumeChangePct < 0 ? "down" : undefined}>
                {tele.volumeChangePct == null
                  ? "—"
                  : `${tele.volumeChangePct > 0 ? "+" : ""}${tele.volumeChangePct.toLocaleString("pt-BR")}%`}
              </strong>
            </div>
            <small>últimas 4 × 4 anteriores</small>
          </div>
          <div className="op-chart" role="img" aria-label="Volume por semana nas últimas 8 semanas">
            {tele.weeks.map((w, i) => (
              <div key={w.monday} className={i === tele.weeks.length - 1 ? "current" : undefined}>
                <i style={{ height: `${Math.max(3, (w.volumeKg / maxWeek) * 100)}%` }} />
                <span>S{i + 1}</span>
              </div>
            ))}
          </div>
          <dl className="op-tele-grid">
            <div>
              <dt>Recordes no ciclo</dt>
              <dd>{String(tele.prsCycle).padStart(2, "0")}</dd>
              <span>últimas 7 semanas</span>
            </div>
            <div>
              <dt>Consistência</dt>
              <dd>
                <Ticker value={tele.consistencyPct} />%
              </dd>
              <span>semanas com treino</span>
            </div>
            <div>
              <dt>Volume total</dt>
              <dd>{tonnes(tele.volume90Kg)}</dd>
              <span>últimos 90 dias</span>
            </div>
          </dl>
        </section>
      )}
    </>
  );
}

/** Cartão de um treino concluído: etiqueta, nome, data e os três números numa caixa única com filetes. */
function WorkoutPost({ session: s, pr }: { session: Session; pr: number }) {
  const st = sessionStats(s);
  return (
    <li data-augmented-ui="tl-clip br-clip border" className="card feed-post">
      <PostLabel pr={pr} />
      <p className="feed-post-title">{dayOf(s)?.name ?? s.day?.name ?? "Treino"}</p>
      <span className="tiny faint mono">{shortDate(s.date)}</span>
      <WorkoutData top={`${formatWeight(sessionTopKg(s))} kg`} sets={st.sets} volume={tonnes(st.volumeKg)} />
    </li>
  );
}

/** Os três números de um treino numa caixa só, separados por filete (no lugar de três caixas com barra). */
export function WorkoutData({ top, sets, volume }: { top: ReactNode; sets: ReactNode; volume: ReactNode }) {
  return (
    <dl className="workout-data">
      <div>
        <dt>Carga máx.</dt>
        <dd>{top}</dd>
      </div>
      <div>
        <dt>Séries</dt>
        <dd>{sets}</dd>
      </div>
      <div>
        <dt>Volume</dt>
        <dd>{volume}</dd>
      </div>
    </dl>
  );
}

/** Faixa de cima de cada transmissão: "SESSÃO CONCLUÍDA" em ciano e, com recorde, quantos em âmbar (só a etiqueta). */
export function PostLabel({ pr }: { pr: number }) {
  return (
    <div className="post-label">
      <span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="m13 2-9 12h8l-1 8 9-12h-8Z" />
        </svg>
        Sessão concluída
      </span>
      {pr > 0 && (
        <span className="post-pr">
          ★ {pr} recorde{pr > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
