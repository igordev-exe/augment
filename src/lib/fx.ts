// Camada de efeitos do app:
// - toque: retícula que expande no ponto tocado e flash curto no controle;
// - pausa: animações de painéis fora da tela ficam paradas (bateria) e voltam ao aparecer;
// - nível: "max" | "gym" | "min" vira uma classe no <html> (fx-gym / fx-min) que o CSS usa para cortar loops;
// - boot: o feixe de varredura só passa ao abrir o app e ao iniciar um protocolo.
// Tudo respeita "reduzir movimento" do sistema.

import type { FxLevel } from "../data/types";

const INTERACTIVE = 'button, a[href], [role="button"], [role="tab"], summary, select, input[type="checkbox"], input[type="radio"]';
/** Painéis com animação contínua: pausam fora da tela. */
const PAUSABLE = ".fm, .aw, .chart.holo, .hm-holo, .sysmod, .term, .bm-sweep, .scan-beam, .scan-line, .ob-hero";

const root = () => document.documentElement;
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Aplica o nível efetivo: no modo automático, o treino ativo fica em "academia" (sem loops decorativos). */
export function applyFxLevel(level: FxLevel | undefined, onWorkout: boolean) {
  const eff = level === "min" ? "min" : level === "max" ? "max" : onWorkout ? "gym" : "max";
  root().classList.toggle("fx-gym", eff === "gym");
  root().classList.toggle("fx-min", eff === "min");
}

/** Passa o feixe de varredura uma vez (abertura do app, início de protocolo). */
export function bootBeam() {
  if (reduced() || root().classList.contains("fx-min")) return;
  root().classList.remove("fx-boot");
  void root().offsetWidth;
  root().classList.add("fx-boot");
  window.setTimeout(() => root().classList.remove("fx-boot"), 700);
}

export function installTapFx(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  function onDown(e: PointerEvent) {
    if (reduced() || root().classList.contains("fx-min") || e.button > 0) return;
    const target = (e.target as Element | null)?.closest?.(INTERACTIVE) as HTMLElement | null;
    if (!target || target.matches(":disabled, [aria-disabled='true']")) return;

    const fx = document.createElement("i");
    fx.className = target.closest(".btn-primary, .btn-danger, .nav") ? "tapfx red" : "tapfx";
    fx.style.left = `${e.clientX}px`;
    fx.style.top = `${e.clientY}px`;
    document.body.appendChild(fx);
    const drop = () => fx.remove();
    fx.addEventListener("animationend", drop, { once: true });
    window.setTimeout(drop, 900);

    target.classList.remove("zap");
    void target.offsetWidth; // reinicia a animação se tocar de novo logo em seguida
    target.classList.add("zap");
    window.setTimeout(() => target.classList.remove("zap"), 450);
  }

  // Pausa fora da tela: observa os painéis animados que vão aparecendo (troca de tela, módulo aberto).
  const seen = new WeakSet<Element>();
  const io =
    "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => entries.forEach((en) => en.target.classList.toggle("fx-paused", !en.isIntersecting)), {
          rootMargin: "80px 0px",
        })
      : null;
  let scan = 0;
  const rescan = () => {
    window.clearTimeout(scan);
    scan = window.setTimeout(() => {
      document.querySelectorAll(PAUSABLE).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io?.observe(el);
      });
    }, 200);
  };
  const mo = io ? new MutationObserver(rescan) : null;
  mo?.observe(document.body, { childList: true, subtree: true });
  rescan();

  document.addEventListener("pointerdown", onDown, { passive: true });
  return () => {
    document.removeEventListener("pointerdown", onDown);
    mo?.disconnect();
    io?.disconnect();
    window.clearTimeout(scan);
  };
}
