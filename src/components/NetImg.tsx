import { useLayoutEffect, useRef, useState } from "react";

/**
 * Imagem que vem da rede (fotos do free-exercise-db), regras F4 e F5 de docs/prompt-fluidez.md. O contêiner já
 * reserva o espaço (fundo e proporção), então nada muda de lugar. Se a foto ainda não chegou no 1º quadro, ela
 * aparece por opacidade em --t-toque quando carregar; se já estava no cache, entra direto, sem efeito.
 * `data-net` marca a imagem como de rede para a medição (tools/verify/flicker.mjs).
 */
export function NetImg({ src, width, height, alt = "" }: { src: string; width: number; height: number; alt?: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [waiting, setWaiting] = useState(false);
  useLayoutEffect(() => {
    const img = ref.current;
    if (img && !img.complete) setWaiting(true);
  }, [src]);
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      data-net=""
      className={waiting ? "net-wait" : undefined}
      onLoad={() => setWaiting(false)}
      onError={() => setWaiting(false)}
    />
  );
}
