import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { activeProgram, programVersion, rememberSessions, subscribeProgram } from "../data/program";
import type { BodyEntry, Program, Session, Settings } from "../data/types";
import { EMPTY_OPERATOR_MEMORY, operatorState, type OperatorMemory, type OperatorState } from "./core/operator";
import { db, DEFAULT_SETTINGS, loadBodyLog, loadOperatorMemory, loadSettings, saveOperatorMemory, saveSettings } from "./db";
import { todayISO } from "./dates";
import { isNative, keepAwake, vibrate } from "./native";

export function useSessions(): Session[] | undefined {
  return useLiveQuery(async () => {
    const list = await db.sessions.toArray();
    // Exercícios que já saíram do programa continuam resolvendo pelo retrato salvo na sessão.
    rememberSessions(list);
    return list;
  }, []);
}

/** Todos os programas salvos (lista em Programas). */
export function usePrograms(): Program[] | undefined {
  return useLiveQuery(() => db.programs.toArray(), []);
}

/** Programa ativo; a tela renderiza de novo quando ele muda (import de backup, edição do programa). */
export function useProgram(): Program {
  useSyncExternalStore(subscribeProgram, programVersion);
  return activeProgram();
}

export function useSession(id: string | undefined): Session | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.sessions.get(id)) ?? null) : null), [id]);
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>, boolean] {
  const s = useLiveQuery(() => loadSettings(), []);
  const update = useCallback(async (patch: Partial<Settings>) => {
    await saveSettings(patch);
  }, []);
  return [s ?? DEFAULT_SETTINGS, update, s !== undefined];
}

export function useBodyLog(): BodyEntry[] | undefined {
  return useLiveQuery(() => loadBodyLog(), []);
}

export function useOperatorMemory(): [OperatorMemory, (patch: Partial<OperatorMemory>) => Promise<void>] {
  const m = useLiveQuery(() => loadOperatorMemory(), []);
  const update = useCallback(async (patch: Partial<OperatorMemory>) => {
    await saveOperatorMemory(patch);
  }, []);
  return [m ?? EMPTY_OPERATOR_MEMORY, update];
}

export function useOperatorState(
  sessions: Session[] | undefined,
  bodyLog: BodyEntry[] | undefined,
  settings: Settings,
  today: string,
): OperatorState | undefined {
  const [memory] = useOperatorMemory();
  return useMemo(
    () => (sessions ? operatorState(sessions, bodyLog ?? [], settings, memory, today) : undefined),
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

// ---------- Toast ----------

/** Tom do aviso: info = sistema (ciano), ok = feito/recorde (verde), warn = atenção (âmbar), danger = perigo (vermelho). */
export type ToastTone = "info" | "ok" | "warn" | "danger";

const TOAST_LABEL: Record<ToastTone, string> = {
  info: "SYS // INFO",
  ok: "SYS // OK",
  warn: "SYS // ATENÇÃO",
  danger: "SYS // ALERTA",
};

/** `fx: "glitch"`: recompensa visual (recorde, teto batido). */
export type ToastFx = "glitch";

/** Botão no próprio aviso (ex.: "Desfazer"). Com ação, o aviso fica pelo menos 8 s. */
export interface ToastAction {
  label: string;
  run: () => void;
}

type ToastFn = (msg: string, tone?: ToastTone, fx?: ToastFx, action?: ToastAction) => void;

const ToastCtx = createContext<ToastFn>(() => {});

/** Vibrar nos avisos de atenção/perigo (o Shell liga conforme Ajustes → vibrar). */
let vibrateOnWarn = true;
export function setToastVibrate(on: boolean) {
  vibrateOnWarn = on;
}

/** Tempo de leitura: ~55 ms por caractere, entre 4 e 10 s. */
export function toastDuration(msg: string, hasAction: boolean): number {
  const t = Math.min(10_000, Math.max(4_000, msg.length * 55));
  return hasAction ? Math.max(8_000, t) : t;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone; fx?: ToastFx; action?: ToastAction; at: number } | null>(null);
  const timer = useRef<number>();
  /** Quando o aviso some (para pausar e retomar com o tempo que faltava). */
  const deadline = useRef(0);
  const left = useRef(0);
  const [paused, setPaused] = useState(false);
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);
  const arm = useCallback((ms: number) => {
    window.clearTimeout(timer.current);
    deadline.current = Date.now() + ms;
    timer.current = window.setTimeout(() => setToast(null), ms);
  }, []);
  const pause = () => {
    window.clearTimeout(timer.current);
    left.current = Math.max(0, deadline.current - Date.now());
    setPaused(true);
  };
  const resume = () => {
    setPaused(false);
    arm(Math.max(1_500, left.current));
  };
  const show = useCallback<ToastFn>(
    (msg, tone = "info", fx, action) => {
      setToast({ msg, tone, fx, action, at: Date.now() });
      arm(toastDuration(msg, !!action));
      if (vibrateOnWarn && (tone === "warn" || tone === "danger")) vibrate([40, 60, 40]);
    },
    [arm],
  );
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.at}
          className={`toast-wrap tone-${toast.tone}`}
          role="status"
          // Dedo em cima pausa; ao soltar, sobra tempo para terminar de ler.
          onPointerDown={pause}
          onPointerUp={resume}
          onPointerCancel={resume}
          onClick={() => !toast.action && close()}
        >
          <div data-augmented-ui="tl-clip br-clip border" className="toast">
            <b className={toast.fx === "glitch" ? "glitch" : undefined} data-text={TOAST_LABEL[toast.tone]}>
              {TOAST_LABEL[toast.tone]}
            </b>
            {toast.msg}
            {toast.action && (
              <span className="toast-actions">
                <button
                  type="button"
                  className="toast-act"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.action!.run();
                    close();
                  }}
                >
                  {toast.action.label}
                </button>
                <button
                  type="button"
                  className="toast-close"
                  aria-label="Fechar aviso"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                >
                  OK
                </button>
              </span>
            )}
            <i
              className="toast-life"
              style={{
                animationDuration: `${toastDuration(toast.msg, !!toast.action)}ms`,
                animationPlayState: paused ? "paused" : "running",
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
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
