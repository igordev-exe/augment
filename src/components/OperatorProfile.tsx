import { useMemo, useState, type ReactNode } from "react";
import type { Session } from "../data/types";
import { avatarSrc } from "../data/personas";
import { dayOf } from "../data/program";
import { shortDate } from "../lib/dates";
import { operatorSerial, profileTelemetry, rankOf, sessionTopKg, tonnes } from "../lib/profile";
import { formatWeight, prsBySession } from "../lib/progression";
import { sessionStats } from "../lib/sessions";
import { weekStreaks } from "../lib/visual";
import { useOperatorMemory } from "../lib/hooks";

// Perfil do operador (design "Perfil e Amigos Cyberpunk"): capa com grade e varredura, avatar sobre a capa, etiquetas,
// quatro números e duas abas: Atividade (os últimos treinos como transmissões) e Telemetria (volume de 8 semanas).
// Tudo vem do histórico do aparelho; o que o servidor não tem (seguidores, curtidas) não aparece.

export function OperatorProfile({
  user,
  persona,
  sessions,
  friends,
  today,
  tags,
  weeklyTarget,
  children,
}: {
  user: { id: string; displayName: string; username: string };
  persona?: string;
  sessions: Session[];
  friends: number;
  today: string;
  /** Etiquetas do operador (programa, semana do meso…). */
  tags: string[];
  /** Treinos por semana que contam para a sequência. */
  weeklyTarget: number;
  /** Rodapé do cartão (sincronização, ações). */
  children?: ReactNode;
}) {
  const [tab, setTab] = useState<"atividade" | "telemetria">("atividade");
  const done = useMemo(() => sessions.filter((s) => s.status === "done"), [sessions]);
  const prs = useMemo(() => prsBySession(done), [done]);
  const recordExercises = useMemo(() => new Set([...prs.values()].flat().map((p) => p.exId)).size, [prs]);
  const [memory] = useOperatorMemory();
  const streak = weekStreaks(done, today, weeklyTarget, memory.absences).streak;
  const tele = useMemo(() => profileTelemetry(done, today), [done, today]);
  const recent = useMemo(() => [...done].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, 3), [done]);
  const maxWeek = Math.max(1, ...tele.weeks.map((w) => w.volumeKg));

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
            <img src={avatarSrc(persona)} alt="" width={96} height={96} />
          </span>
          <div className="op-identity">
            <span className="op-rank">{rankOf(done.length)}</span>
            <h2>{user.displayName}</h2>
            <span className="op-handle">@{user.username}</span>
            {tags.length > 0 && (
              <ul className="op-tags">
                {tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <dl className="op-stats">
          <div>
            <dd>{done.length}</dd>
            <dt>Sessões</dt>
          </div>
          <div>
            <dd>{recordExercises}</dd>
            <dt>Recordes</dt>
          </div>
          <div>
            <dd>{friends}</dd>
            <dt>Amigos</dt>
          </div>
          <div>
            <dd>
              {streak}
              <small>sem</small>
            </dd>
            <dt>Sequência</dt>
          </div>
        </dl>
        {children && <div className="op-foot">{children}</div>}
      </section>

      <div className="op-tabs" role="tablist" aria-label="Perfil">
        <button type="button" role="tab" aria-selected={tab === "atividade"} onClick={() => setTab("atividade")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
          </svg>
          Atividade
        </button>
        <button type="button" role="tab" aria-selected={tab === "telemetria"} onClick={() => setTab("telemetria")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" />
          </svg>
          Telemetria
        </button>
      </div>

      {tab === "atividade" ? (
        recent.length === 0 ? (
          <div data-augmented-ui="tl-clip br-clip border" className="card flat no-signal">
            <span className="radar" aria-hidden="true" />
            <strong>SEM TRANSMISSÕES</strong>
            <span className="small muted">Seus treinos concluídos aparecem aqui.</span>
          </div>
        ) : (
          <ul className="feed-posts">
            {recent.map((s) => {
              const st = sessionStats(s);
              const n = prs.get(s.id)?.length ?? 0;
              return (
                <li key={s.id} data-augmented-ui="tl-clip br-clip border" className={`card feed-post${n ? " pr" : ""}`}>
                  <PostLabel pr={n} />
                  <p className="feed-post-title">{dayOf(s)?.name ?? s.day?.name ?? "Treino"}</p>
                  <span className="tiny faint mono">{shortDate(s.date)}</span>
                  <dl className="feed-post-stats">
                    <div>
                      <dt>Carga máx.</dt>
                      <dd>{formatWeight(sessionTopKg(s))} kg</dd>
                    </div>
                    <div>
                      <dt>Séries</dt>
                      <dd>{st.sets}</dd>
                    </div>
                    <div>
                      <dt>Volume</dt>
                      <dd>{tonnes(st.volumeKg)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
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
              <dd>{tele.consistencyPct}%</dd>
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

/** Faixa de cima de cada transmissão: "SESSÃO CONCLUÍDA" e, com recorde, quantos. */
export function PostLabel({ pr }: { pr: number }) {
  return (
    <div className="post-label">
      <span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="m13 2-9 12h8l-1 8 9-12h-8Z" />
        </svg>
        Sessão concluída
      </span>
      {pr > 0 ? (
        <span className="post-pr">
          ★ {pr} recorde{pr > 1 ? "s" : ""}
        </span>
      ) : (
        <span>SYNC_OK</span>
      )}
    </div>
  );
}
