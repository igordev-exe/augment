// Efeito de toque do app inteiro: uma retícula que expande no ponto tocado e um flash curto no controle.
// Um único ouvinte no documento; respeita "reduzir movimento" do sistema.

const INTERACTIVE = 'button, a[href], [role="button"], [role="tab"], summary, select, input[type="checkbox"], input[type="radio"]';

export function installTapFx(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  function onDown(e: PointerEvent) {
    if (reduce?.matches || e.button > 0) return;
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

  document.addEventListener("pointerdown", onDown, { passive: true });
  return () => document.removeEventListener("pointerdown", onDown);
}
