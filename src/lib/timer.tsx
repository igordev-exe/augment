import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Timer de descanso global. Sobrevive a recarregar a página (localStorage).

interface TimerState {
  endAt: number;
  total: number;
  label: string;
  fired: boolean;
}

interface TimerApi {
  state: TimerState | null;
  start: (seconds: number, label: string) => void;
  add: (seconds: number) => void;
  stop: () => void;
  /** Liga som/vibração (vem dos ajustes). */
  configure: (opts: { sound: boolean; vibrate: boolean }) => void;
}

const KEY = "augment-timer";
const Ctx = createContext<TimerApi | null>(null);

function read(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}
function write(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* sem storage */
  }
}

let audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx ?? new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch {
    audioCtx = null;
  }
}
function beep() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.22, 0.44].forEach((d, i) => {
    const o = audioCtx!.createOscillator();
    const g = audioCtx!.createGain();
    o.type = "sine";
    o.frequency.value = i === 2 ? 1175 : 880;
    g.gain.setValueAtTime(0.0001, t0 + d);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
    o.connect(g).connect(audioCtx!.destination);
    o.start(t0 + d);
    o.stop(t0 + d + 0.2);
  });
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(() => read());
  const opts = useRef({ sound: true, vibrate: true });

  const commit = useCallback((s: TimerState | null) => {
    write(s);
    setState(s);
  }, []);

  const start = useCallback(
    (seconds: number, label: string) => {
      unlockAudio();
      commit({ endAt: Date.now() + seconds * 1000, total: seconds, label, fired: false });
    },
    [commit],
  );
  const add = useCallback(
    (seconds: number) => {
      const s = read();
      if (!s) return;
      const base = Math.max(s.endAt, Date.now());
      commit({ ...s, endAt: base + seconds * 1000, total: s.total + seconds, fired: false });
    },
    [commit],
  );
  const stop = useCallback(() => commit(null), [commit]);
  const configure = useCallback((o: { sound: boolean; vibrate: boolean }) => {
    opts.current = o;
  }, []);

  // Dispara o alarme uma vez quando o tempo acaba.
  useEffect(() => {
    if (!state || state.fired) return;
    const ms = state.endAt - Date.now();
    const fire = () => {
      const cur = read();
      if (!cur || cur.fired) return;
      if (opts.current.vibrate && "vibrate" in navigator) navigator.vibrate?.([220, 120, 220, 120, 400]);
      if (opts.current.sound) beep();
      commit({ ...cur, fired: true });
    };
    if (ms <= 0) {
      fire();
      return;
    }
    const id = window.setTimeout(fire, ms);
    return () => window.clearTimeout(id);
  }, [state, commit]);

  const api = useMemo(() => ({ state, start, add, stop, configure }), [state, start, add, stop, configure]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTimer(): TimerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("TimerProvider ausente");
  return c;
}
