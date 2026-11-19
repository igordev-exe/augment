import { useEffect, useRef, useState } from "react";

// Indicador de "carregando" só para rede (regra F3 de docs/prompt-fluidez.md): aparece se a espera passar de
// `delay` (200 ms) e, se apareceu, fica pelo menos `min` (300 ms). Assim não pisca por 2 quadros.

export const FLAG_DELAY = 200;
export const FLAG_MIN = 300;

/**
 * Lógica pura: dado quando a espera começou e quando acabou (ou null, se ainda espera) e o relógio, diz se o
 * indicador aparece e até quando ele precisa ficar.
 */
export function delayedFlagVisible(start: number | null, end: number | null, now: number, delay = FLAG_DELAY, min = FLAG_MIN): boolean {
  if (start == null) return false;
  const showAt = start + delay;
  if (end != null && end <= showAt) return false; // terminou antes de precisar mostrar
  if (now < showAt) return false;
  if (end == null) return true;
  return now < Math.max(end, showAt + min);
}

export function useDelayedFlag(on: boolean, delay = FLAG_DELAY, min = FLAG_MIN): boolean {
  const span = useRef<{ start: number | null; end: number | null }>({ start: null, end: null });
  const [, tick] = useState(0);
  const now = performance.now();
  if (on && (span.current.start == null || span.current.end != null)) span.current = { start: now, end: null };
  if (!on && span.current.start != null && span.current.end == null) span.current.end = now;
  const { start, end } = span.current;
  const visible = delayedFlagVisible(start, end, now, delay, min);
  useEffect(() => {
    if (start == null) return;
    const showAt = start + delay;
    const until = end == null ? showAt : Math.max(end, showAt + min);
    const wait = until - performance.now();
    if (wait <= 0 || (end != null && end <= showAt)) return;
    const id = window.setTimeout(() => tick((n) => n + 1), wait + 1);
    return () => window.clearTimeout(id);
  }, [start, end, delay, min]);
  return visible;
}
