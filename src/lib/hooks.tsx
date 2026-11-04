import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { BodyEntry, Session, Settings } from "../data/types";
import { db, DEFAULT_SETTINGS, loadBodyLog, loadSettings, saveSettings } from "./db";
import { todayISO } from "./dates";

export function useSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.toArray(), []);
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

const ToastCtx = createContext<(msg: string, tone?: ToastTone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: ToastTone } | null>(null);
  const timer = useRef<number>();
  const show = useCallback((msg: string, tone: ToastTone = "info") => {
    setToast({ msg, tone });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast-wrap tone-${toast.tone}`} role="status" onClick={() => setToast(null)}>
          <div data-augmented-ui="tl-clip br-clip border" className="toast">
            <b>{TOAST_LABEL[toast.tone]}</b>
            {toast.msg}
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
    if (!active || !("wakeLock" in navigator)) return;
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
