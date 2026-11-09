// Geometria da marca AUGMENT (símbolo "Núcleo" e logotipo). Uma fonte só para o cabeçalho, a animação de boot,
// o card de compartilhar (canvas) e os ícones (public/icon.svg). Estudo da marca: docs/brand/augment-logo.html.

export const BRAND_RED = "#ef302c";
export const BRAND_CYAN = "#3fd8e0";

/** Símbolo em viewBox 0 0 120 120: anilha de 8 segmentos (módulos do sistema), traço 8. O primeiro é o "ativo" (ciano). */
export const RING_SEGMENTS = [
  "M108 44V76",
  "M105.2 82.7 82.7 105.2",
  "M76 108H44",
  "M37.3 105.2 14.8 82.7",
  "M12 76V44",
  "M14.8 37.3 37.3 14.8",
  "M44 12H76",
  "M82.7 14.8 105.2 37.3",
];
export const RING_STROKE = 8;

/** O "A" de topo reto. */
export const CORE_A = "M55 24h10l23 68H77L60 42 43 92H32z";

/** Travessão do A: barra com anilhas e presilhas ([x, y, largura, altura]). */
export const BARBELL: [number, number, number, number][] = [
  [26, 63, 68, 6],
  [24, 55, 6, 22],
  [90, 55, 6, 22],
  [31, 59, 3, 14],
  [86, 59, 3, 14],
];

/** Logotipo em viewBox -3 -3 252 46: uma letra por traço, espessura 6, cantos a 45°. */
export const WORDMARK_VIEWBOX = "-3 -3 252 46";
export const WORDMARK_STROKE = 6;
export const WORDMARK_LETTERS = [
  "M3 37 12 3h6l9 34M8.5 26h13",
  "M39 3v28l6 6h12l6-6V3",
  "M99 3H81l-6 6v22l6 6h18V21H89",
  "M111 37V3l12 14 12-14v34",
  "M171 3h-24v34h24M147 19h17",
  "M183 37V3l24 34V3",
  "M216 3h30M231 3v34",
];

/** Desenha o símbolo num canvas (card de compartilhar). (x, y) é o canto superior esquerdo; size, o lado. */
export function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 120, size / 120);
  ctx.lineWidth = RING_STROKE;
  ctx.lineCap = "butt";
  RING_SEGMENTS.forEach((d, i) => {
    ctx.strokeStyle = i === 0 ? BRAND_CYAN : BRAND_RED;
    ctx.stroke(new Path2D(d));
  });
  ctx.fillStyle = BRAND_RED;
  ctx.fill(new Path2D(CORE_A));
  for (const [rx, ry, rw, rh] of BARBELL) ctx.fillRect(rx, ry, rw, rh);
  ctx.restore();
}

/** Desenha o logotipo num canvas. height é a altura da caixa (as letras ocupam 40/46 dela). Devolve a largura. */
export function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, height: number, color: string): number {
  const k = height / 46;
  ctx.save();
  ctx.translate(x + 3 * k, y + 3 * k);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = WORDMARK_STROKE;
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  for (const d of WORDMARK_LETTERS) ctx.stroke(new Path2D(d));
  ctx.restore();
  return 252 * k;
}

/** Os 8 módulos que acendem no boot, um por segmento da anilha: os sistemas reais do app. */
export const BOOT_MODULES = [
  "Biocore",
  "Motor de carga",
  "Progressão",
  "Mesociclo",
  "Recuperação",
  "Treinador IA",
  "Cofre local",
  "HUD de treino",
];

const BOOT_DAY_KEY = "augment-boot-day";

export type BootMode = "full" | "short" | "none";

/**
 * Boot completo na primeira abertura do dia; curto nas outras; nenhum com "reduzir movimento".
 * Pura (sem DOM) para dar para testar.
 */
export function bootModeFor(lastFullDay: string | null, today: string, reducedMotion: boolean): BootMode {
  if (reducedMotion) return "none";
  return lastFullDay === today ? "short" : "full";
}

export function readBootMode(today: string): BootMode {
  let last: string | null = null;
  try {
    last = localStorage.getItem(BOOT_DAY_KEY);
  } catch {
    /* sem storage: trata como primeira abertura */
  }
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return bootModeFor(last, today, reduced);
}

export function markBootDone(today: string): void {
  try {
    localStorage.setItem(BOOT_DAY_KEY, today);
  } catch {
    /* sem storage */
  }
}
