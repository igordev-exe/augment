import type Anthropic from "@anthropic-ai/sdk";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import { avatarSrc } from "../data/personas";
import { BrandMark } from "../components/Brand";
import {
  archiveChat,
  chatTitle,
  coachTurn,
  DEFAULT_CONFIG,
  EMPTY_CHAT,
  errorText,
  loadCoachArchive,
  loadCoachChat,
  loadCoachConfig,
  modelPrice,
  MODELS,
  saveCoachArchive,
  saveCoachChat,
  saveCoachConfig,
  stampTimes,
  type CoachArchiveItem,
  type CoachChat,
  type CoachConfig,
  type Effort,
} from "../lib/coach/chat";
import { describeProposal, parseProposal, proposalPatch, turnContext, type CoachData } from "../lib/coach/context";
import { TOOL_LABEL } from "../lib/coach/tools";
import { handleIntent, type IntentProposal } from "../lib/core/intents";
import type { DataCard, DataContext } from "../lib/core/data-answers";
import { isUrgent, localReply, STARTERS, type LocalMeta } from "../lib/core/localchat";
import { LEVEL_LABEL, type EvidenceLevel } from "../data/science";
import { addAbsence, upsertConstraint } from "../lib/db";
import { useBodyLog, useOperatorMemory, useSessions, useSettings, useToast, useToday } from "../lib/hooks";
import { coachHandoffText } from "../lib/coach/handoff";
import { shareOrDownload } from "../lib/files";
import { addDays, shortDate } from "../lib/dates";
import { rankProgress } from "../lib/profile";

const QUICK = [
  "Analise minha semana passada",
  "Me prepare para o treino de hoje",
  "Resumo do meu mesociclo e quais acessórios trocar",
  "Quais exercícios estão travando?",
];

const EFFORTS: { id: Effort; label: string }[] = [
  { id: "low", label: "Rápido" },
  { id: "medium", label: "Normal" },
  { id: "high", label: "Profundo" },
];

/** Negrito com **texto**. */
function inline(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}

/** Markdown mínimo (parágrafos, listas, títulos, negrito), montado como elementos: nada vira HTML cru. */
function Md({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const head = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      head ? (
        <p key={blocks.length} className="md-h">
          {inline(head[1])}
        </p>
      ) : (
        <p key={blocks.length}>{inline(line)}</p>
      ),
    );
  }
  flush();
  return <div className="prose md">{blocks}</div>;
}

const LEVEL_TONE: Record<EvidenceLevel, string> = { evidencia: "go", consenso: "int", campo: "warn", hipotese: "changed" };

// ---------- Peças do chat (layout do mockup "Chat IA Cyberpunk", adaptado ao app) ----------

type CxIconName = "plus" | "chat" | "settings" | "panel" | "send" | "copy" | "terminal" | "shield" | "close" | "stop" | "link";

/** Ícones de traço reto do mockup (cantos vivos, traço 1,7). */
function CxIcon({ name, size = 18 }: { name: CxIconName; size?: number }) {
  const paths: Record<CxIconName, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    panel: <path d="M4 5h16v14H4zM9 5v14" />,
    send: <path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" />,
    copy: <path d="M8 8h11v11H8zM5 16H4V5h11v1" />,
    terminal: <path d="m5 7 4 5-4 5m7 0h7" />,
    shield: <path d="M12 3 4.5 6v5.5c0 4.7 3.2 8.1 7.5 9.5 4.3-1.4 7.5-4.8 7.5-9.5V6L12 3Zm-3 9 2 2 4-5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    stop: <path d="M7 7h10v10H7z" />,
    link: <path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" />,
  };
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="1.7"
    >
      {paths[name]}
    </svg>
  );
}

/** Avatar das respostas: a marca do AUGMENT (anel, A e barra). Na trava de saúde, monocromática em âmbar. */
function NeuralCore({ mono = false }: { mono?: boolean }) {
  return (
    <div className="cx-avatar" aria-hidden="true">
      <BrandMark className="cx-avatar-mark" mono={mono} />
    </div>
  );
}

/**
 * Leitura de sistema no topo: onda do núcleo (barras que oscilam), sincronia (avanço real até o próximo posto) e o
 * relógio do núcleo correndo. Componente próprio para o relógio não redesenhar a conversa a cada segundo.
 */
function CoreReadout({ sync, cloud }: { sync: number; cloud: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="cx-hud" aria-hidden="true">
      <div className="cx-wave">
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${(i % 5) * -0.21 - Math.floor(i / 3) * 0.09}s` }} />
        ))}
      </div>
      <div className="cx-hud-read">
        <span>
          SINC <b>{sync}%</b>
        </span>
        <span>
          {cloud ? "NUVEM" : "LOCAL"} <b>{now.toLocaleTimeString("pt-BR")}</b>
        </span>
      </div>
      <div className="cx-hud-grid">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

const hhmm = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

/** Texto sem as marcas de negrito, para copiar. */
const plain = (t: string) => t.replace(/\*\*/g, "");

/** Cartão de "protocolo": números da pessoa em 2 ou 4 células. */
function ProtocolCard({ card }: { card: DataCard }) {
  return (
    <div className="cx-protocol">
      <div className="cx-protocol-head">
        <span>
          <CxIcon name="terminal" size={15} /> {card.title}
        </span>
        <b>{card.tag}</b>
      </div>
      <div className="cx-protocol-grid">
        {card.cells.map((c) => (
          <div key={c.k}>
            <small>{c.k}</small>
            <strong>{c.v}</strong>
            {c.s && <span>{c.s}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bloco de "análise do núcleo": a conta feita com os dados da pessoa. */
function Insight({ label, text }: { label: string; text: string }) {
  return (
    <div className="cx-insight">
      <i aria-hidden="true" />
      <div>
        <small>{label}</small>
        <p>{inline(text)}</p>
      </div>
    </div>
  );
}

/**
 * O que vem junto de uma resposta pronta: nível de evidência, "Ler mais" no Guia, atalho para a tela e perguntas
 * tocáveis (relacionadas, "você quis dizer" ou sugestões do "não sei").
 */
function LocalExtras({
  meta,
  onAsk,
  onHandoff,
  disabled,
}: {
  meta: LocalMeta;
  onAsk?: (q: string) => void;
  onHandoff?: () => void;
  disabled?: boolean;
}) {
  const links = meta.level || meta.principle || meta.route;
  const chips = onAsk ? (meta.chips ?? []) : [];
  if (!links && !chips.length && !onHandoff) return null;
  return (
    <div className="local-extras">
      {links && (
        <div className="local-links">
          {meta.level && (
            <span data-augmented-ui="br-clip border" className={`chip ${LEVEL_TONE[meta.level]}`}>
              {LEVEL_LABEL[meta.level]}
            </span>
          )}
          {meta.principle && (
            <Link className="link-btn" to={`/guia?p=${meta.principle}`}>
              Ler mais no Guia
            </Link>
          )}
          {meta.route && (
            <Link className="link-btn" to={meta.route}>
              Abrir no app
            </Link>
          )}
        </div>
      )}
      {chips.length > 0 && (
        <div className="local-chips" role="group" aria-label={meta.kind === "maybe" ? "Você quis dizer" : "Perguntas relacionadas"}>
          {chips.map((q) => (
            <button key={q} type="button" className="ask-chip" disabled={disabled} onClick={() => onAsk!(q)}>
              {q}
            </button>
          ))}
        </div>
      )}
      {onHandoff && (
        <button type="button" className="link-btn" onClick={onHandoff}>
          Levar a pergunta para outro chat
        </button>
      )}
    </div>
  );
}

/** Rótulo de hora no histórico: hoje mostra a hora; ontem, "ONTEM"; antes, "12 NOV". */
function whenLabel(ms: number, today: string): string {
  const d = new Date(ms);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (iso === today) return hhmm(ms);
  if (iso === addDays(today, -1)) return "ONTEM";
  return shortDate(iso).toUpperCase();
}

/** Texto que ele digitou, sem a linha de contexto que o app põe na frente. */
function userText(m: Anthropic.Beta.BetaMessageParam): string | null {
  const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content ?? []);
  const t = blocks.find((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text");
  return t ? t.text.replace(/^\[[^\]]*\]\n+/, "").replace(/^\[[^\]]*\]\n+/, "") : null;
}

export function Coach() {
  const sessions = useSessions();
  const bodyLog = useBodyLog();
  const [settings, updateSettings] = useSettings();
  const [operatorMemory] = useOperatorMemory();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [config, setConfig] = useState<CoachConfig | null>(null);
  const [chat, setChat] = useState<CoachChat>(EMPTY_CHAT);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState("");
  const [tool, setTool] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<IntentProposal | null>(null);
  /** Última pergunta respondida pelo núcleo na hora: a pessoa pode mandar para o treinador mesmo assim. */
  const [answeredLocally, setAnsweredLocally] = useState<string | null>(null);
  /** Última entidade das respostas prontas, para continuações ("e no agachamento?"). */
  const [localCtx, setLocalCtx] = useState<DataContext>({});
  const toast = useToast();
  /** Gaveta de conversas (a barra lateral do mockup). */
  const [sideOpen, setSideOpen] = useState(false);
  const [archive, setArchive] = useState<CoachArchiveItem[]>([]);
  const sideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    loadCoachConfig().then((c) => {
      setConfig(c);
      // Sem chave, o chat de respostas prontas é a tela principal; a configuração só abre quando pedida.
      if (params.get("config")) setEditing(true);
    });
    loadCoachChat().then((ch) => {
      setChat(ch);
      setChatLoaded(true);
    });
    loadCoachArchive().then(setArchive);
    const q = params.get("q");
    if (q) setDraft(q);
  }, [params]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages.length, live, tool]);

  // Gaveta fechada sai da ordem de foco (inert); aberta, o foco vai para o botão de fechar e Esc fecha.
  useEffect(() => {
    if (sideRef.current) sideRef.current.inert = !sideOpen;
    if (!sideOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSideOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideOpen]);

  // Disparo automático quando vem de "Debrief do treinador" (?auto=1&q=...)
  useEffect(() => {
    if (autoSent.current || !chatLoaded || !sessions || !config || editing || busy) return;
    const q = params.get("q");
    const auto = params.get("auto");
    if (q && auto === "1") {
      autoSent.current = true;
      void send(q);
    }
    // send é acionado uma única vez quando os dados iniciais carregam
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLoaded, sessions, config, editing, busy, params]);

  if (!sessions || !config) return null;
  const data: CoachData = { sessions, settings, today, bodyLog, memory: operatorMemory };

  function updateChat(next: CoachChat) {
    const stamped = stampTimes(next);
    setChat(stamped);
    saveCoachChat(stamped);
  }

  /** Guarda a conversa atual no histórico e começa outra. */
  function newChat() {
    const list = archiveChat(archive, chat);
    setArchive(list);
    void saveCoachArchive(list);
    setLocalCtx({});
    setPendingIntent(null);
    setAnsweredLocally(null);
    updateChat(EMPTY_CHAT);
    setSideOpen(false);
  }

  /** Abre uma conversa do histórico (a atual vai para o histórico no lugar dela). */
  function openArchived(id: string) {
    const item = archive.find((a) => a.id === id);
    if (!item) return;
    const list = archiveChat(
      archive.filter((a) => a.id !== id),
      chat,
    );
    setArchive(list);
    void saveCoachArchive(list);
    setLocalCtx({});
    setPendingIntent(null);
    setAnsweredLocally(null);
    updateChat(item.chat);
    setSideOpen(false);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(plain(text));
      toast("Resposta copiada.", "ok");
    } catch {
      toast("O navegador bloqueou a cópia.", "warn");
    }
  }

  async function send(text: string, skipLocal = false) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    setDraft("");
    setAnsweredLocally(null);
    if (params.get("q") || params.get("auto")) setParams({}, { replace: true });
    const notes = chat.notes?.length ? `\n[${chat.notes.join(" ")}]` : "";
    // Urgência (dor no peito, falta de ar, desmaio) vem antes das intenções: "dor no peito" não pode virar
    // proposta de proteger o peitoral. Cai na trava do `localReply` logo abaixo.
    const localIntent =
      skipLocal || isUrgent(t)
        ? { matched: false as const, reply: "" }
        : handleIntent(t, { sessions: sessions!, settings, today, memory: operatorMemory });
    if (localIntent.matched) {
      setPendingIntent(localIntent.proposal ?? null);
      if (config?.apiKey) setAnsweredLocally(t);
      const nextChat: CoachChat = {
        ...chat,
        notes: [],
        messages: [
          ...chat.messages,
          { role: "user", content: [{ type: "text", text: `${turnContext(data)}${notes}\n\n${t}` }] },
          { role: "assistant", content: [{ type: "text", text: localIntent.reply }] },
        ],
      };
      updateChat(nextChat);
      return;
    }
    // Respostas prontas: sem chave, sempre; com chave, só as certeiras (o resto vai para o treinador completo).
    const hasKey = !!config?.apiKey;
    const local = skipLocal ? null : localReply(t, { ...data, bodyLog: bodyLog ?? [] }, localCtx);
    if (local && (!hasKey || local.meta.kind === "answer" || local.meta.kind === "data" || local.meta.kind === "guard")) {
      setLocalCtx(local.ctx);
      setPendingIntent(null);
      if (hasKey && local.meta.kind !== "guard") setAnsweredLocally(t);
      updateChat({
        ...chat,
        notes: [],
        messages: [
          ...chat.messages,
          { role: "user", content: [{ type: "text", text: `${turnContext(data)}${notes}\n\n${t}` }] },
          { role: "assistant", content: [{ type: "text", text: local.text }] },
        ],
        local: { ...chat.local, [chat.messages.length + 1]: local.meta },
      });
      return;
    }
    if (!hasKey) return;
    let cur: CoachChat = {
      ...chat,
      notes: [],
      messages: [...chat.messages, { role: "user", content: [{ type: "text", text: `${turnContext(data)}${notes}\n\n${t}` }] }],
    };
    updateChat(cur);
    setBusy(true);
    setLive("");
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const end = await coachTurn(
        config,
        cur,
        data,
        {
          onText: (d) => setLive((s) => s + d),
          onTool: (n) => setTool(n),
          onChat: (c) => {
            cur = c;
            updateChat(c);
            setLive("");
            setTool(null);
          },
        },
        ctrl.signal,
      );
      if (end === "recusa") setError("O modelo recusou responder essa mensagem. Reformule a pergunta.");
      if (end === "limite") setError("O treinador fez consultas demais nessa resposta. Pergunte de novo, mais específico.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setLive("");
      setTool(null);
      abort.current = null;
    }
  }

  /** "Não sei": leva o documento do treinador, com a pergunta no fim, para outro chat. */
  async function handoff(question: string) {
    const text = `${coachHandoffText({ ...data, bodyLog: bodyLog ?? [] })}\n\n## Minha pergunta\n\n${question}\n`;
    try {
      const how = await shareOrDownload(`augment-pergunta-${today}.md`, text, "Pergunta ao treinador", "text/markdown");
      toast(
        how === "shared" ? "Escolha o app de chat para continuar a conversa." : "Arquivo salvo: anexe numa conversa do seu chat.",
        "ok",
      );
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast("Copiado. Cole numa conversa nova do seu chat.", "ok");
      } catch {
        toast("Não deu para compartilhar nem copiar.", "warn");
      }
    }
  }

  async function answer(id: string, input: Record<string, unknown>, apply: boolean) {
    const p = parseProposal(input);
    const what = describeProposal(p, settings, today);
    if (apply) await updateSettings(proposalPatch(p, settings, today));
    updateChat({
      ...chat,
      proposals: { ...chat.proposals, [id]: apply ? "aplicada" : "recusada" },
      notes: [...(chat.notes ?? []), `${apply ? "Aplicou" : "Recusou"} a proposta: ${what}.`],
    });
  }

  const [pin, pcache, pout] = modelPrice(config.model);
  const cost = (chat.usage.input * pin + chat.usage.cacheRead * pcache + chat.usage.output * pout) / 1e6;
  const tokens = chat.usage.input + chat.usage.cacheRead + chat.usage.output;

  if (editing) {
    return (
      <CoachSetup
        config={config}
        onSave={async (c) => {
          await saveCoachConfig(c);
          setConfig(c);
          setEditing(false);
          if (params.get("config")) setParams({}, { replace: true });
        }}
        onCancel={() => {
          setEditing(false);
          if (params.get("config")) setParams({}, { replace: true });
        }}
      />
    );
  }

  const hasKey = !!config.apiKey;
  const doneCount = sessions.filter((s) => s.status === "done").length;
  const rank = rankProgress(doneCount);
  const sync = rank.next ? Math.round((rank.into / Math.max(1, rank.span)) * 100) : 100;
  const operatorName = (settings.operator || "Operador").toUpperCase();
  const firstAt = chat.times?.[0];
  const sessionStamp = firstAt ? new Date(firstAt) : new Date();
  const lastIdx = chat.messages.length - 1;

  return (
    <div className="cx coach">
      <div className="cx-scan" aria-hidden="true" />
      {sideOpen && <button type="button" className="cx-scrim" aria-label="Fechar menu" onClick={() => setSideOpen(false)} />}

      <aside ref={sideRef} className={`cx-side${sideOpen ? " open" : ""}`} aria-label="Conversas">
        <div className="cx-brand">
          <BrandMark className="cx-brand-logo" />
          <div>
            <div className="cx-brand-name">
              AUGMENT<span>.</span>CORE
            </div>
            <div className="cx-brand-sub">NÚCLEO DE TREINO</div>
          </div>
          <button ref={closeRef} type="button" className="cx-icon-btn cx-close" aria-label="Fechar menu" onClick={() => setSideOpen(false)}>
            <CxIcon name="close" />
          </button>
        </div>

        <button type="button" className="cx-new" onClick={newChat} disabled={busy}>
          <CxIcon name="plus" size={16} />
          <span>NOVA CONVERSA</span>
          <kbd>{archive.length + (chat.messages.length ? 1 : 0)}</kbd>
        </button>

        <div className="cx-history-label">
          <span>HISTÓRICO</span>
          <span>{archive.length}/20</span>
        </div>

        <nav className="cx-convs" aria-label="Histórico de conversas">
          {chat.messages.length > 0 && (
            <button type="button" className="cx-conv active" aria-current="true" onClick={() => setSideOpen(false)}>
              <span className="cx-conv-icon">
                <CxIcon name="chat" size={15} />
              </span>
              <span className="cx-conv-copy">
                <strong>{chatTitle(chat)}</strong>
                <small>AGORA</small>
              </span>
            </button>
          )}
          {archive.map((a) => (
            <button key={a.id} type="button" className="cx-conv" disabled={busy} onClick={() => openArchived(a.id)}>
              <span className="cx-conv-icon">
                <CxIcon name="chat" size={15} />
              </span>
              <span className="cx-conv-copy">
                <strong>{a.title}</strong>
                <small>{whenLabel(a.at, today)}</small>
              </span>
            </button>
          ))}
          {!archive.length && !chat.messages.length && <p className="cx-empty">As conversas aparecem aqui.</p>}
        </nav>

        <div className="cx-side-foot">
          <div className="cx-usage">
            <div>
              <span>SINCRONIA NEURAL</span>
              <b>{sync}%</b>
            </div>
            <div className="cx-usage-track">
              <i style={{ width: `${sync}%` }} />
            </div>
            <small>
              {doneCount} TREINOS{rank.next ? ` // PRÓXIMO: ${rank.next}` : " // NÍVEL MÁXIMO"}
            </small>
          </div>
          <button
            type="button"
            className="cx-profile"
            onClick={() => {
              setSideOpen(false);
              setEditing(true);
            }}
          >
            <img className="cx-avatar-img" src={avatarSrc(settings.persona)} alt="" />
            <span>
              <strong>{operatorName}</strong>
              <small>{hasKey ? "TREINADOR COMPLETO LIGADO" : "LIGAR O TREINADOR COMPLETO"}</small>
            </span>
            <CxIcon name="settings" size={17} />
          </button>
        </div>
      </aside>

      <header className="cx-top">
        <div className="cx-top-left">
          <button type="button" className="cx-icon-btn cx-panel" aria-label="Abrir conversas" onClick={() => setSideOpen(true)}>
            <CxIcon name="panel" />
          </button>
          <BrandMark className="cx-model-logo" />
          <div>
            <h1 className="cx-model-name">
              AUG.CORE <span>v5.0</span>
            </h1>
            <div className="cx-model-state">
              <i /> {hasKey ? "NÚCLEO + CLAUDE ONLINE" : "NÚCLEO LOCAL ONLINE"}
            </div>
          </div>
        </div>
        <CoreReadout sync={sync} cloud={hasKey} />
      </header>

      <div className="cx-stage">
        <div className="cx-divider">
          <span>
            SESSÃO // {sessionStamp.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, ".")}
          </span>
          <i />
          <b>{sessionStamp.toLocaleTimeString("pt-BR")}</b>
        </div>

        {chat.messages.length === 0 && (
          <article className="cx-row cx-ai">
            <NeuralCore />
            <div className="cx-ai-content">
              <div className="cx-label cx-ai-label">AUG.CORE</div>
              <div className="cx-ai-msg">
                <p>
                  {hasKey
                    ? "Núcleo e treinador completo prontos. Eu consulto o seu histórico, os relatórios e a agenda antes de responder."
                    : "Núcleo pronto. Pergunte sobre treino, alimentação, recuperação, o app ou os seus números. Respostas conferidas, sem internet; quando não souber, eu digo."}
                </p>
              </div>
              <div className="local-chips" role="group" aria-label="Perguntas de exemplo">
                {(hasKey ? QUICK : STARTERS).map((q) => (
                  <button key={q} type="button" className="ask-chip" onClick={() => void send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </article>
        )}

        {chat.messages.map((m, i) => {
          const isNew = i >= lastIdx - 1;
          if (m.role === "user") {
            const t = userText(m);
            return t ? (
              <article key={i} className={`cx-row cx-user${isNew ? " cx-fresh" : ""}`}>
                <div className="cx-label">
                  {operatorName} <span>{hhmm(chat.times?.[i])}</span>
                </div>
                <div className="cx-user-msg cx-cut">{t}</div>
              </article>
            ) : null;
          }
          const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : (m.content ?? []);
          const texts = blocks.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text" && !!b.text.trim());
          const tools = blocks.filter((b) => b.type === "tool_use" && b.name === "propor_ajuste");
          if (!texts.length && !tools.length) return null;
          const meta = chat.local?.[i];
          const last = i === lastIdx;
          const asked = meta?.handoff && last ? userText(chat.messages[i - 1]) : null;
          const allText = texts.map((b) => b.text).join("\n\n");
          return (
            <article key={i} className={`cx-row cx-ai${meta ? ` local-${meta.kind}` : ""}${isNew ? " cx-fresh" : ""}`}>
              <NeuralCore mono={meta?.kind === "guard"} />
              <div className="cx-ai-content">
                <div className="cx-label cx-ai-label">
                  AUG.CORE <span>{hhmm(chat.times?.[i])}</span>
                </div>
                {texts.length > 0 && (
                  <div className="cx-ai-msg">
                    <Md text={allText} />
                  </div>
                )}
                {meta?.card && <ProtocolCard card={meta.card} />}
                {meta?.insight && <Insight label="Análise do núcleo" text={meta.insight.text} />}
                {tools.map((b) => {
                  if (b.type !== "tool_use") return null;
                  let what = "";
                  let why = "";
                  try {
                    const p = parseProposal(b.input as Record<string, unknown>);
                    what = describeProposal(p, settings, today);
                    why = p.motivo;
                  } catch {
                    return null;
                  }
                  const state = chat.proposals[b.id];
                  return (
                    <div key={b.id} data-augmented-ui="tl-clip br-clip border" className="card stack proposal" style={{ gap: 8 }}>
                      <span className="label">Proposta do treinador</span>
                      <strong>{what}</strong>
                      <span className="small muted">{why}</span>
                      {state ? (
                        <span className={`small ${state === "aplicada" ? "ok" : "muted"}`}>
                          {state === "aplicada" ? "Aplicada." : "Recusada."}
                        </span>
                      ) : (
                        <div className="row">
                          <button
                            type="button"
                            data-augmented-ui="tl-clip br-clip border"
                            className="btn btn-sm btn-primary grow"
                            disabled={busy}
                            onClick={() => answer(b.id, b.input as Record<string, unknown>, true)}
                          >
                            Aplicar
                          </button>
                          <button
                            type="button"
                            data-augmented-ui="tl-clip br-clip border"
                            className="btn btn-sm btn-ghost"
                            disabled={busy}
                            onClick={() => answer(b.id, b.input as Record<string, unknown>, false)}
                          >
                            Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {meta && (
                  // Perguntas tocáveis só na última resposta; nível e atalhos ficam em todas.
                  <LocalExtras
                    meta={meta}
                    disabled={busy}
                    onAsk={last ? (q) => void send(q) : undefined}
                    onHandoff={asked ? () => void handoff(asked) : undefined}
                  />
                )}
                {texts.length > 0 && (
                  <div className="cx-actions">
                    <button type="button" onClick={() => void copy(allText)}>
                      <CxIcon name="copy" size={14} /> COPIAR
                    </button>
                    <span>{meta ? `NÚCLEO LOCAL // ${meta.kind === "data" ? "SEUS DADOS" : "OFFLINE"}` : "CLAUDE // NUVEM"}</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {busy && (
          <article className="cx-row cx-ai">
            <NeuralCore />
            <div className="cx-ai-content">
              <div className="cx-label cx-ai-label">AUG.CORE</div>
              {live ? (
                <div className="cx-ai-msg">
                  <Md text={live} />
                </div>
              ) : (
                <div className="cx-thinking">
                  <i /> {tool ? `${(TOOL_LABEL[tool] ?? tool).toUpperCase()}…` : "PROCESSANDO…"}
                </div>
              )}
            </div>
          </article>
        )}

        {answeredLocally && !pendingIntent && (
          <button type="button" className="ob-link cx-aside-link" onClick={() => void send(answeredLocally, true)}>
            Perguntar ao treinador mesmo assim
          </button>
        )}
        {pendingIntent && (
          <div data-augmented-ui="tl-clip br-clip border" className="card stack proposal cx-aside-card" style={{ gap: 8 }}>
            <span className="label">Proposta do núcleo</span>
            <strong>{pendingIntent.confirmLabel}</strong>
            <div className="row">
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm btn-primary grow"
                onClick={async () => {
                  const p = pendingIntent;
                  setPendingIntent(null);
                  if (p.constraint) await upsertConstraint(p.constraint);
                  if (p.absence) await addAbsence(p.absence);
                  updateChat({
                    ...chat,
                    notes: [...(chat.notes ?? []), `Aplicou proposta do núcleo: ${p.confirmLabel}.`],
                  });
                }}
              >
                Aplicar
              </button>
              <button
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  const p = pendingIntent;
                  setPendingIntent(null);
                  updateChat({
                    ...chat,
                    notes: [...(chat.notes ?? []), `Recusou proposta do núcleo: ${p.confirmLabel}.`],
                  });
                }}
              >
                Recusar
              </button>
            </div>
          </div>
        )}
        {error && <div className="callout warn">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="cx-compose-wrap">
        <form
          className="cx-composer cx-cut"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            aria-label="Mensagem para o treinador"
            rows={1}
            placeholder={hasKey ? "TRANSMITA SUA CONSULTA…" : "PERGUNTE SOBRE TREINO, COMIDA OU SEUS NÚMEROS…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <div className="cx-controls">
            <button
              type="button"
              className="cx-icon-btn"
              aria-label="Nova conversa"
              onClick={newChat}
              disabled={busy || !chat.messages.length}
            >
              <CxIcon name="plus" />
            </button>
            <div className="cx-mode">
              <i /> {hasKey ? "NÚCLEO + CLAUDE" : "NÚCLEO LOCAL ATIVO"}
            </div>
            <span className="cx-key-hint">SHIFT + ENTER</span>
            {busy ? (
              <button type="button" className="cx-send" aria-label="Parar resposta" onClick={() => abort.current?.abort()}>
                <CxIcon name="stop" size={18} />
              </button>
            ) : (
              <button type="submit" className="cx-send" aria-label="Enviar mensagem" disabled={!draft.trim()}>
                <CxIcon name="send" size={18} />
              </button>
            )}
          </div>
        </form>
        <div className="cx-compose-foot">
          <span>
            {tokens > 0
              ? `Nesta conversa: ${Math.round(tokens / 1000)} mil tokens, ≈ US$ ${cost.toFixed(cost < 0.1 ? 3 : 2).replace(".", ",")}.`
              : "Respostas conferidas. Na dúvida, procure um profissional."}
          </span>
          <b>{hasKey ? "CONEXÃO SEGURA // ANTHROPIC" : "CONEXÃO LOCAL // SEM REDE"}</b>
        </div>
      </div>
    </div>
  );
}

/**
 * Treinador sem chave: monta o documento com instruções + dados e entrega pela folha de compartilhar (no celular dá
 * para escolher o app do Claude ou do Gemini) ou copia o texto. Usa a conta de IA que a pessoa já tem, sem API.
 */
function CoachHandoff() {
  const sessions = useSessions();
  const bodyLog = useBodyLog();
  const [settings] = useSettings();
  const today = useToday();
  const toast = useToast();
  const text = () => coachHandoffText({ sessions: sessions ?? [], settings, today, bodyLog: bodyLog ?? [] });
  async function share() {
    try {
      const how = await shareOrDownload(`augment-treinador-${today}.md`, text(), "Treinador AUGMENT", "text/markdown");
      toast(
        how === "shared"
          ? "Escolha o app do Claude ou do Gemini para abrir a conversa."
          : "Arquivo salvo: anexe numa conversa do Claude ou do Gemini.",
        "ok",
      );
    } catch {
      toast("Não deu para compartilhar. Use “Copiar texto”.", "warn");
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      toast("Copiado. Cole numa conversa nova do Claude ou do Gemini.", "ok");
    } catch {
      toast("O navegador bloqueou a cópia. Use “Enviar”.", "warn");
    }
  }
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="card stack">
      <h2 className="h-sec">Sem chave: use sua conta do Claude ou do Gemini</h2>
      <p className="small muted" style={{ margin: 0 }}>
        O app monta um documento com as instruções do treinador, a base científica e os seus treinos. Envie para o app do Claude ou do
        Gemini (ou qualquer chat de IA) e converse por lá, na conta que você já tem. Não precisa de chave nem paga nada a mais. A diferença:
        por lá a IA não aplica mudanças no app; ela diz o que ajustar e você aplica.
      </p>
      <div className="row-wrap">
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary" disabled={!sessions} onClick={share}>
          Enviar para Claude / Gemini
        </button>
        <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" disabled={!sessions} onClick={copy}>
          Copiar texto
        </button>
      </div>
    </section>
  );
}

function CoachSetup({ config, onSave, onCancel }: { config: CoachConfig; onSave: (c: CoachConfig) => void; onCancel?: () => void }) {
  const [c, setC] = useState<CoachConfig>(config.apiKey ? config : { ...DEFAULT_CONFIG, ...config });
  return (
    <div className="stack-lg mode-terminal">
      <PageHead back="/" code="AUG.OS // TREINADOR" title="Configurar treinador" />
      <CoachHandoff />
      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Chave da API</h2>
        <p className="small muted" style={{ margin: 0 }}>
          O treinador usa o Claude pela sua chave da API da Anthropic (crie em console.anthropic.com → API Keys). A chave fica só neste
          aparelho: não vai no backup nem para nenhum outro lugar além da Anthropic.
        </p>
        <input
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          aria-label="Chave da API da Anthropic"
          value={c.apiKey}
          onChange={(e) => setC({ ...c, apiKey: e.target.value.trim() })}
        />
      </section>

      <section data-augmented-ui="tl-clip br-clip border" className="card stack">
        <h2 className="h-sec">Modelo</h2>
        <div className="stack" style={{ gap: 8 }}>
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="toggle-chip"
              aria-pressed={c.model === m.id}
              onClick={() => setC({ ...c, model: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <h2 className="h-sec" style={{ marginTop: 6 }}>
          Profundidade
        </h2>
        <div className="row-wrap">
          {EFFORTS.map((e) => (
            <button
              key={e.id}
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="toggle-chip"
              aria-pressed={c.effort === e.id}
              onClick={() => setC({ ...c, effort: e.id })}
            >
              {e.label}
            </button>
          ))}
        </div>
        <p className="tiny faint" style={{ margin: 0 }}>
          Mais profundo pensa mais antes de responder: demora mais e custa mais. "Normal" serve para quase tudo.
        </p>
      </section>

      <div className="callout">
        Quando você pergunta, o app envia à Anthropic a ficha e os registros que o treinador consultar (cargas, reps, anotações, check-in).
        Nada é enviado sem você mandar uma mensagem.
      </div>

      <div className="row">
        <button
          type="button"
          data-augmented-ui="tl-clip br-clip border"
          className="btn btn-ghost-line grow"
          disabled={!c.apiKey}
          onClick={() => onSave(c)}
        >
          Salvar
        </button>
        {onCancel && (
          <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {config.apiKey && (
        <button type="button" className="link-btn" onClick={() => onSave({ ...c, apiKey: "" })}>
          Apagar a chave deste aparelho
        </button>
      )}
    </div>
  );
}
