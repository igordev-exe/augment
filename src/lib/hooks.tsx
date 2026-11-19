import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { activeProgram, programVersion, subscribeProgram } from "../data/program";
import type { BodyEntry, Program, Session, Settings } from "../data/types";
import { EMPTY_OPERATOR_MEMORY, type OperatorMemory, type OperatorState } from "./core/operator";
import { operatorStateOf } from "./derived";
import type { ChatAlias } from "./core/learned";
import {
  aliasesCell,
  bodyLogCell,
  db,
  DEFAULT_SETTINGS,
  memoryCell,
  programsCell,
  rememberSessionsSnap,
  saveOperatorMemory,
  saveSettings,
  sessionsCell,
  settingsCell,
} from "./db";
import { restorePointsCell, type RestorePoint } from "./restore";
import type { Cell } from "./store";
import { todayISO } from "./dates";
import { isNative, keepAwake, vibrate } from "./native";
import { enqueue, isRepeat, makeBubble, remainingWithQueue, toastDuration, type BubbleItem, type ToastFn } from "./bubble";
import { CoreBubble, CoreTyping } from "../components/CoreBubble";

// Leitura síncrona do estoque em memória (lib/store.ts): o 1º quadro já tem o dado e a tela não consulta o banco ao
// montar. As assinaturas ao banco são ligadas uma vez no App (startLocalData).
const EMPTY_ALIASES: ChatAlias[] = [];
const NO_BODY: BodyEntry[] = [];
function useCell<T>(c: Cell<T>): T | undefined {
  return useSyncExternalStore(c.subscribe, c.get);
}

export function useSessions(): Session[] | undefined {
  return useCell(sessionsCell);
}

/** Todos os programas salvos (lista em Programas). */
export function usePrograms(): Program[] | undefined {
  return useCell(programsCell);
}

/** Programa ativo; a tela renderiza de novo quando ele muda (import de backup, edição do programa). */
export function useProgram(): Program {
  useSyncExternalStore(subscribeProgram, programVersion);
  return activeProgram();
}

/** Um treino pelo id (undefined = carregando, null = não existe). */
export function useSession(id: string | undefined): Session | null | undefined {
  const list = useCell(sessionsCell);
  const found = useMemo(() => (id ? list?.find((s) => s.id === id) : undefined), [list, id]);
  // Treino recém-criado (gravou e já navegou): a assinatura ainda não trouxe. Busca direto e põe no estoque, em vez
  // de dizer "não existe" por um quadro.
  const [missing, setMissing] = useState<string | null>(null);
  useEffect(() => {
    if (!list || !id || found) return;
    let alive = true;
    void db.sessions.get(id).then((s) => {
      if (!alive) return;
      if (s) rememberSessionsSnap([...(sessionsCell.get() ?? []).filter((x) => x.id !== s.id), s]);
      else setMissing(id);
    });
    return () => {
      alive = false;
    };
  }, [list, id, found]);
  if (list === undefined) return undefined;
  if (!id) return null;
  return found ?? (missing === id ? null : undefined);
}

const updateSettings = async (patch: Partial<Settings>) => {
  await saveSettings(patch);
};
export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>, boolean] {
  const s = useCell(settingsCell);
  return [s ?? DEFAULT_SETTINGS, updateSettings, s !== undefined];
}

export function useBodyLog(): BodyEntry[] | undefined {
  return useCell(bodyLogCell);
}

const updateMemory = async (patch: Partial<OperatorMemory>) => {
  await saveOperatorMemory(patch);
};
export function useOperatorMemory(): [OperatorMemory, (patch: Partial<OperatorMemory>) => Promise<void>] {
  const m = useCell(memoryCell);
  return [m ?? EMPTY_OPERATOR_MEMORY, updateMemory];
}

/** Frases que o chat aprendeu (apelidos). */
export function useChatAliases(): ChatAlias[] {
  return useCell(aliasesCell) ?? EMPTY_ALIASES;
}

/** Pontos de restauração (Ajustes → Backup). */
export function useRestorePoints(): RestorePoint[] | undefined {
  return useCell(restorePointsCell);
}

export function useOperatorState(
  sessions: Session[] | undefined,
  bodyLog: BodyEntry[] | undefined,
  settings: Settings,
  today: string,
): OperatorState | undefined {
  const [memory] = useOperatorMemory();
  return useMemo(
    () => (sessions ? operatorStateOf(sessions, bodyLog ?? NO_BODY, settings, memory, today) : undefined),
    [sessions, bodyLog, settings, memory, today],
  );
}

export function useToday(): string {
  const [t, setT] = useState(todayISO());
  useEffect(() => {
    const id = window.setInterval(() => setT(todayISO()), 60_000);
    const onVis = () => setT(todayISO());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return t;
}

// ---------- Balão do núcleo (antigo toast) ----------
// Mesma API de sempre: toast(texto, tom, fx?, ação | opções?). A fila e as regras ficam em lib/bubble.ts; o desenho,
// em components/CoreBubble.tsx.

export type { BubbleAction, ToastAction, ToastFx, ToastOpts, ToastTone } from "./bubble";
export { toastDuration } from "./bubble";

const ToastCtx = createContext<ToastFn>(() => {});
const TypingCtx = createContext<(on: boolean) => void>(() => {});

/** Vibrar nos avisos de atenção/perigo (o Shell liga conforme Ajustes → vibrar). */
let vibrateOnWarn = true;
/** Persona do operador (avatar do balão); o Shell atualiza. */
let bubblePersona: string | undefined;
/** Vibração do recorde: dois toques curtos e um longo (o fim do descanso é longo-longo-longo). */
export const RECORD_BUZZ = [30, 50, 30, 50, 160];
export function setToastVibrate(on: boolean) {
  vibrateOnWarn = on;
}
export function setBubblePersona(id: string | undefined) {
  bubblePersona = id;
}

const LEAVE_MS = 120;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [cur, setCur] = useState<BubbleItem | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [typing, setTyping] = useState(false);
  const queue = useRef<BubbleItem[]>([]);
  const curRef = useRef<BubbleItem | null>(null);
  const recent = useRef(new Map<string, number>());
  const nextId = useRef(1);
  const timer = useRef<number>();
  const deadline = useRef(0);
  const left = useRef(0);

  const present = useCallback((item: BubbleItem | null) => {
    window.clearTimeout(timer.current);
    curRef.current = item;
    setLeaving(false);
    setPaused(false);
    setCur(item);
    if (!item) return;
    recent.current.set(item.text, Date.now());
    if (vibrateOnWarn && (item.tone === "warn" || item.tone === "danger")) vibrate([40, 60, 40]);
    // Recorde e meta batida: pulso próprio, curto-curto-longo, diferente do fim do descanso.
    else if (vibrateOnWarn && item.tone === "reward") vibrate(RECORD_BUZZ);
    if (!item.sticky) arm(toastDuration(item.text, item.actions.length > 0));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    if (!curRef.current) return;
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      const [next, ...rest] = queue.current;
      queue.current = rest;
      present(next ?? null);
    }, LEAVE_MS);
  }, [present]);

  const arm = useCallback(
    (ms: number) => {
      window.clearTimeout(timer.current);
      deadline.current = Date.now() + ms;
      timer.current = window.setTimeout(close, ms);
    },
    [close],
  );

  const show = useCallback<ToastFn>(
    (msg, tone = "info", fx, opts) => {
      const now = Date.now();
      const item = makeBubble(nextId.current++, msg, tone, fx, opts, now, (route) => {
        location.hash = `#${route}`;
      });
      if (isRepeat(item, recent.current, now)) return;
      const c = curRef.current;
      if (!c) return present(item);
      queue.current = enqueue(queue.current, item);
      // Já tem balão na tela: o atual encurta (sem botão) para o próximo entrar logo.
      if (!c.sticky && !c.actions.length) arm(remainingWithQueue(c, Math.max(0, deadline.current - now), now));
    },
    [arm, present],
  );

  const pause = () => {
    if (!curRef.current || curRef.current.sticky) return;
    window.clearTimeout(timer.current);
    left.current = Math.max(0, deadline.current - Date.now());
    setPaused(true);
  };
  const resume = () => {
    if (!curRef.current || curRef.current.sticky) return;
    setPaused(false);
    arm(Math.max(1_500, left.current));
  };

  return (
    <ToastCtx.Provider value={show}>
      <TypingCtx.Provider value={setTyping}>
        {children}
        {cur ? (
          <CoreBubble
            key={cur.id}
            item={cur}
            persona={bubblePersona}
            leaving={leaving}
            paused={paused}
            duration={toastDuration(cur.text, cur.actions.length > 0)}
            onClose={close}
            onPause={pause}
            onResume={resume}
          />
        ) : (
          typing && <CoreTyping persona={bubblePersona} />
        )}
      </TypingCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/** "Digitando…" no balão enquanto `on` (o treinador com chave respondendo). */
export function useCoreTyping(on: boolean) {
  const set = useContext(TypingCtx);
  useEffect(() => {
    set(on);
    return () => set(false);
  }, [on, set]);
}

// ---------- Wake lock (tela acesa durante o treino) ----------

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (isNative) {
      keepAwake(true).catch(() => {});
      return () => {
        keepAwake(false).catch(() => {});
      };
    }
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* sem permissão: segue sem */
      }
      if (cancelled) lock?.release().catch(() => {});
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
