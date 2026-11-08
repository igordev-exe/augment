import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cancelRestAlarm, isNative, scheduleRestAlarm, vibrate } from "./native";

// Timer de descanso global. Sobrevive a recarregar a página (localStorage).

interface TimerState {
  endAt: number;
  total: number;
  label: string;
  fired: boolean;
}

interface TimerOpts {
  sound: boolean;
  vibrate: boolean;
  notify?: boolean;
}

interface TimerApi {
  state: TimerState | null;
  start: (seconds: number, label: string) => void;
  add: (seconds: number) => void;
  stop: () => void;
  /** Liga som/vibração/notificação (vem dos ajustes). */
  configure: (opts: TimerOpts) => void;
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

function notifyDone(label: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const title = "Descanso acabou";
  const options: NotificationOptions = {
    body: label.replace(/\n/g, " · "),
    tag: "augment-timer",
    icon: "icon-192.png",
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, options))
      .catch(() => {
        try {
          new Notification(title, options);
        } catch {
          /* navegador bloqueou construtor direto */
        }
      });
  } else {
    try {
      new Notification(title, options);
    } catch {
      /* sem suporte */
    }
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState | null>(() => read());
  const opts = useRef<TimerOpts>({ sound: true, vibrate: true, notify: false });

  const commit = useCallback((s: TimerState | null) => {
    write(s);
    setState(s);
  }, []);

  // No APK o Android agenda o aviso de fim do descanso: toca com a tela bloqueada e o app em segundo plano.
  const alarm = useCallback((s: TimerState | null) => {
    if (s && !s.fired && opts.current.notify !== false) scheduleRestAlarm(s.endAt, s.label);
    else cancelRestAlarm();
  }, []);

  const start = useCallback(
    (seconds: number, label: string) => {
      unlockAudio();
      const s = { endAt: Date.now() + seconds * 1000, total: seconds, label, fired: false };
      commit(s);
      alarm(s);
    },
    [commit, alarm],
  );
  const add = useCallback(
    (seconds: number) => {
      const s = read();
      if (!s) return;
      if (seconds < 0) {
        const nextEnd = Math.max(Date.now(), s.endAt + seconds * 1000);
        const next = { ...s, endAt: nextEnd, total: Math.max(15, s.total + seconds) };
        commit(next);
        alarm(next);
        return;
      }
      const base = Math.max(s.endAt, Date.now());
      const next = { ...s, endAt: base + seconds * 1000, total: s.total + seconds, fired: false };
      commit(next);
      alarm(next);
    },
    [commit, alarm],
  );
  const stop = useCallback(() => {
    commit(null);
    alarm(null);
  }, [commit, alarm]);
  const configure = useCallback((o: TimerOpts) => {
    opts.current = o;
  }, []);

  // Dispara o alarme uma vez quando o tempo acaba (ou ao retornar à aba se o SO congelou o timer).
  useEffect(() => {
    if (!state || state.fired) return;
    const fire = () => {
      const cur = read();
      if (!cur || cur.fired || cur.endAt > Date.now() + 50) return;
      if (opts.current.vibrate) vibrate([220, 120, 220, 120, 400]);
      if (opts.current.sound) beep();
      if (isNative) {
        // App aberto: o alarme já tocou aqui, a notificação agendada sairia repetida.
        if (document.visibilityState === "visible") cancelRestAlarm();
      } else if (opts.current.notify && document.visibilityState === "hidden") notifyDone(cur.label);
      commit({ ...cur, fired: true });
    };
    const ms = state.endAt - Date.now();
    if (ms <= 0) {
      fire();
      return;
    }
    const id = window.setTimeout(fire, ms);
    const onVis = () => {
      if (document.visibilityState === "visible" && state.endAt <= Date.now()) fire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state, commit]);

  const api = useMemo(() => ({ state, start, add, stop, configure }), [state, start, add, stop, configure]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTimer(): TimerApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("TimerProvider ausente");
  return c;
}
