import type Anthropic from "@anthropic-ai/sdk";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHead } from "../components/bits";
import {
  coachTurn,
  DEFAULT_CONFIG,
  EMPTY_CHAT,
  errorText,
  loadCoachChat,
  loadCoachConfig,
  MODELS,
  saveCoachChat,
  saveCoachConfig,
  type CoachChat,
  type CoachConfig,
  type Effort,
} from "../lib/coach/chat";
import { describeProposal, parseProposal, proposalPatch, turnContext, type CoachData } from "../lib/coach/context";
import { TOOL_LABEL } from "../lib/coach/tools";
import { useSessions, useSettings, useToday } from "../lib/hooks";

const QUICK = [
  "Analise minha semana passada",
  "Me prepare para o treino de hoje",
  "Perdi treinos. Como reorganizo a semana?",
  "Quais exercícios estão travando?",
];

const EFFORTS: { id: Effort; label: string }[] = [
  { id: "low", label: "Rápido" },
  { id: "medium", label: "Normal" },
  { id: "high", label: "Profundo" },
];

/** US$ por milhão de tokens: entrada, leitura de cache, saída. Aproximado (gravação de cache conta como entrada). */
const PRICE: Record<string, [number, number, number]> = {
  "claude-opus-5-5": [4, 0.2, 20],
  "claude-sonnet-5-5": [2, 0.2, 10],
  "claude-haiku-5-5": [0.1, 0.01, 0.5],
};

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

/** Texto que ele digitou, sem a linha de contexto que o app põe na frente. */
function userText(m: Anthropic.Beta.BetaMessageParam): string | null {
  const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content ?? []);
  const t = blocks.find((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text");
  return t ? t.text.replace(/^\[[^\]]*\]\n+/, "").replace(/^\[[^\]]*\]\n+/, "") : null;
}

export function Coach() {
  const sessions = useSessions();
  const [settings, updateSettings] = useSettings();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [config, setConfig] = useState<CoachConfig | null>(null);
  const [chat, setChat] = useState<CoachChat>(EMPTY_CHAT);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState("");
  const [tool, setTool] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCoachConfig().then((c) => {
      setConfig(c);
      if (!c.apiKey || params.get("config")) setEditing(true);
    });
    loadCoachChat().then(setChat);
    const q = params.get("q");
    if (q) setDraft(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages.length, live, tool]);

  if (!sessions || !config) return null;
  const data: CoachData = { sessions, settings, today };

  function updateChat(next: CoachChat) {
    setChat(next);
    saveCoachChat(next);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy || !config?.apiKey) return;
    setError(null);
    setDraft("");
    if (params.get("q")) setParams({}, { replace: true });
    const notes = chat.notes?.length ? `\n[${chat.notes.join(" ")}]` : "";
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

  const [pin, pcache, pout] = PRICE[config.model] ?? PRICE["claude-opus-5-5"];
  const cost = (chat.usage.input * pin + chat.usage.cacheRead * pcache + chat.usage.output * pout) / 1e6;
  const tokens = chat.usage.input + chat.usage.cacheRead + chat.usage.output;

  if (editing) {
    return (
      <CoachSetup
        config={config}
        onSave={async (c) => {
          await saveCoachConfig(c);
          setConfig(c);
          setEditing(!c.apiKey);
          if (params.get("config")) setParams({}, { replace: true });
        }}
        onCancel={config.apiKey ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <div className="stack-lg coach">
      <PageHead
        back="/"
        code="AUG.OS // TREINADOR"
        title="Treinador"
        sub={`${MODELS.find((m) => m.id === config.model)?.label.split(" · ")[0] ?? config.model}. Lê seus treinos; as cargas continuam vindo do app.`}
        right={
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>
            Configurar
          </button>
        }
      />

      {chat.messages.length === 0 && (
        <section className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            Pergunte qualquer coisa sobre seus treinos. O treinador consulta o histórico, os relatórios e a agenda antes de responder.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                data-augmented-ui="tl-clip br-clip border"
                className="btn btn-ghost quick"
                onClick={() => send(q)}
              >
                {q} <span className="arrow">&gt;</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="chat">
        {chat.messages.map((m, i) => {
          if (m.role === "user") {
            const t = userText(m);
            return t ? (
              <div key={i} className="bubble me">
                {t}
              </div>
            ) : null;
          }
          const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : (m.content ?? []);
          return (
            <Fragment key={i}>
              {blocks.map((b, j) => {
                if (b.type === "text" && b.text.trim()) {
                  return (
                    <div key={j} className="bubble coach-msg">
                      <Md text={b.text} />
                    </div>
                  );
                }
                if (b.type === "tool_use" && b.name === "propor_ajuste") {
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
                    <div key={j} data-augmented-ui="tl-clip br-clip border" className="card stack proposal" style={{ gap: 8 }}>
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
                }
                return null;
              })}
            </Fragment>
          );
        })}
        {busy && live && (
          <div className="bubble coach-msg">
            <Md text={live} />
          </div>
        )}
        {busy && !live && (
          <div className="thinking small">
            <span className="status-dot ok" /> {tool ? `${TOOL_LABEL[tool] ?? tool}…` : "Pensando…"}
          </div>
        )}
        {error && <div className="callout warn">{error}</div>}
        <div ref={endRef} />
      </div>

      <form
        className="composer stack"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          className="note"
          rows={2}
          placeholder="Pergunte ao treinador…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        <div className="row">
          {busy ? (
            <button type="button" data-augmented-ui="tl-clip br-clip border" className="btn grow" onClick={() => abort.current?.abort()}>
              Parar
            </button>
          ) : (
            <button type="submit" data-augmented-ui="tl-clip br-clip border" className="btn btn-primary grow" disabled={!draft.trim()}>
              Enviar <span className="arrow">&gt;</span>
            </button>
          )}
          {chat.messages.length > 0 && !busy && (
            <button
              type="button"
              data-augmented-ui="tl-clip br-clip border"
              className="btn btn-ghost"
              onClick={() => updateChat(EMPTY_CHAT)}
            >
              Nova conversa
            </button>
          )}
        </div>
        {tokens > 0 && (
          <span className="tiny faint">
            Nesta conversa: {Math.round(tokens / 1000)} mil tokens, ≈ US$ {cost.toFixed(cost < 0.1 ? 3 : 2).replace(".", ",")}.
          </span>
        )}
      </form>
    </div>
  );
}

function CoachSetup({ config, onSave, onCancel }: { config: CoachConfig; onSave: (c: CoachConfig) => void; onCancel?: () => void }) {
  const [c, setC] = useState<CoachConfig>(config.apiKey ? config : { ...DEFAULT_CONFIG, ...config });
  return (
    <div className="stack-lg">
      <PageHead back="/" code="AUG.OS // TREINADOR" title="Configurar treinador" />
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
          className="btn btn-primary grow"
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
