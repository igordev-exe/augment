// Fila do balão do núcleo (puro, sem React). O balão só MOSTRA: quem decide o que falar no treino é o diretor
// (`core/director.ts`); aqui ficam a ordem (prioridade), a repetição (mesma frase não volta em 10 min) e o tempo de
// leitura. Ver docs/prompt-balao-nucleo.md, seção 1.4.

/** Tom do balão: info = sistema (ciano), ok = feito (verde), warn = atenção (âmbar), danger = perigo (vermelho),
 *  reward = recorde, meta, posto novo, meso fechado (violeta, com recompensa e RECORD_BUZZ). */
export type ToastTone = "info" | "ok" | "warn" | "danger" | "reward";

/** `fx: "glitch"`: recompensa (vira o tom `reward`). */
export type ToastFx = "glitch";

/** Botão no próprio balão (ex.: "Desfazer"). Formato antigo, ainda aceito no 4º argumento. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface BubbleAction {
  label: string;
  onPress: () => void;
  primary?: boolean;
}

export interface ToastOpts {
  /** Faixa de título depois de "AUG.CORE // ". Sem ela, vem do tom. */
  title?: string;
  /** Até 2 botões. */
  actions?: BubbleAction[];
  /** Rota do app (`/relatorio`): vira o botão "Abrir". */
  route?: string;
  /** Fica até a pessoa tocar. */
  sticky?: boolean;
}

export type ToastFn = (msg: string, tone?: ToastTone, fx?: ToastFx, opts?: ToastAction | ToastOpts) => void;

export interface BubbleItem {
  id: number;
  text: string;
  tone: ToastTone;
  title: string;
  actions: BubbleAction[];
  sticky: boolean;
  at: number;
}

export const BUBBLE_SENDER = "AUG.CORE";
export const BUBBLE_REPEAT_MS = 10 * 60_000;
export const BUBBLE_MAX_ACTIONS = 2;

const TITLE: Record<ToastTone, string> = {
  info: "AVISO",
  ok: "FEITO",
  warn: "ATENÇÃO",
  danger: "ALERTA",
  reward: "RECORDE",
};

/** Ordem da fila: perigo primeiro, confirmação por último. */
export const TONE_RANK: Record<ToastTone, number> = { danger: 0, reward: 1, warn: 2, info: 3, ok: 4 };

/** Tempo de leitura: ~55 ms por caractere, entre 4 e 10 s; com botão, pelo menos 8 s. */
export function toastDuration(msg: string, hasAction: boolean): number {
  const t = Math.min(10_000, Math.max(4_000, msg.length * 55));
  return hasAction ? Math.max(8_000, t) : t;
}

/** Junta os argumentos de `toast(...)` (formato antigo e novo) num item da fila. */
export function makeBubble(
  id: number,
  text: string,
  tone: ToastTone = "info",
  fx?: ToastFx,
  opts?: ToastAction | ToastOpts,
  now = Date.now(),
  go: (route: string) => void = () => {},
): BubbleItem {
  const t: ToastTone = fx === "glitch" ? "reward" : tone;
  const o: ToastOpts = opts && "run" in opts ? { actions: [{ label: opts.label, onPress: opts.run, primary: true }] } : (opts ?? {});
  const actions = [...(o.actions ?? [])];
  if (o.route && actions.length < BUBBLE_MAX_ACTIONS)
    actions.push({ label: "Abrir", onPress: () => go(o.route!), primary: actions.length === 0 });
  return {
    id,
    text,
    tone: t,
    title: `${BUBBLE_SENDER} // ${(o.title ?? TITLE[t]).toUpperCase()}`,
    actions: actions.slice(0, BUBBLE_MAX_ACTIONS),
    sticky: !!o.sticky,
    at: now,
  };
}

/** Repetição: a voz do núcleo (info, warn, reward) não diz a mesma frase em 10 min. Confirmação (ok), perigo e
 *  aviso com botão sempre aparecem: são resposta a um toque da pessoa. */
export function isRepeat(item: BubbleItem, recent: Map<string, number>, now: number): boolean {
  if (item.tone === "ok" || item.tone === "danger" || item.actions.length) return false;
  const last = recent.get(item.text);
  return last != null && now - last < BUBBLE_REPEAT_MS;
}

/** Entra na fila na posição da prioridade (estável: mesmo tom, ordem de chegada). */
export function enqueue(queue: BubbleItem[], item: BubbleItem): BubbleItem[] {
  const i = queue.findIndex((q) => TONE_RANK[q.tone] > TONE_RANK[item.tone]);
  return i < 0 ? [...queue, item] : [...queue.slice(0, i), item, ...queue.slice(i)];
}

/** Quanto tempo o balão atual ainda fica quando há outro esperando: sem botão, no máximo 1,5 s a mais (já foi lido
 *  ao menos 1,5 s). Com botão ou fixo, espera a pessoa. */
export function remainingWithQueue(cur: BubbleItem, left: number, now: number): number {
  if (cur.sticky || cur.actions.length) return left;
  const shown = now - cur.at;
  return Math.min(left, Math.max(1_500 - shown, 0) + 1_500);
}
