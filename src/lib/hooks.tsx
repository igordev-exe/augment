import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, Settings } from "../data/types";
import { db, DEFAULT_SETTINGS, loadSettings, saveSettings } from "./db";
import { todayISO } from "./dates";
import { weekFor } from "./mesocycle";

export function useSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.toArray(), []);
}

export function useSession(id: string | undefined): Session | null | undefined {
  return useLiveQuery(async () => (id ? (await db.sessions.get(id)) ?? null : null), [id]);
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>, boolean] {
  const s = useLiveQuery(() => loadSettings(), []);
  const update = useCallback(async (patch: Partial<Settings>) => {
    await saveSettings(patch);
  }, []);
  return [s ?? DEFAULT_SETTINGS, update, s !== undefined];
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

export function useWeek(date?: string): number {
  const [settings] = useSettings();
  const today = useToday();
  return weekFor(settings.mesoStart, date ?? today);
}

// ---------- Toast ----------

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div data-augmented-ui="tl-clip br-clip border" className="toast" role="status" onClick={() => setMsg(null)}>
          <b>SYS // AVISO</b>
          {msg}
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
