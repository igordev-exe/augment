import { avatarSrc, heroSrc } from "../data/personas";

// Imagens críticas já decodificadas antes de aparecer (regra F6 de docs/prompt-fluidez.md): avatar e herói da persona.
// As referências ficam presas aqui para o navegador não descartar a decodificação.
const keepAlive = new Map<string, HTMLImageElement>();

export function decodeImage(src: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  let img = keepAlive.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    keepAlive.set(src, img);
  }
  return typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve();
}

/** Avatar e herói de uma persona, com teto (nunca segura a tela mais que `capMs`). */
export function decodePersona(id: string | undefined, capMs = 300): Promise<void> {
  const both = Promise.allSettled([decodeImage(avatarSrc(id)), decodeImage(heroSrc(id))]).then(() => {});
  return Promise.race([both, new Promise<void>((r) => setTimeout(r, capMs))]);
}
