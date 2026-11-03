import { useEffect, useRef, useState } from "react";
import IMAGES from "../data/exercise-images.json";

// Fotos de execução (início e fim do movimento) do free-exercise-db, domínio público.
// Alterna as duas como uma animação enquanto está na tela; com "reduzir movimento", troca só no toque.

const MAP = IMAGES as Record<string, string>;

export function exerciseImages(libId: string): string[] {
  if (!MAP[libId]) return [];
  return [0, 1].map((i) => `${import.meta.env.BASE_URL}exercises/${libId}-${i}.webp`);
}

export function ExerciseDemo({ libId, variant = "full" }: { libId: string; variant?: "full" | "thumb" }) {
  const imgs = exerciseImages(libId);
  const ref = useRef<HTMLButtonElement>(null);
  const [frame, setFrame] = useState(0);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const el = ref.current;
    if (!el || variant === "thumb") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [variant]);

  useEffect(() => {
    if (!visible || paused) return;
    const id = window.setInterval(() => setFrame((f) => 1 - f), 1100);
    return () => window.clearInterval(id);
  }, [visible, paused]);

  if (!imgs.length) return null;
  if (variant === "thumb") return <img className="ex-thumb" src={imgs[0]} alt="" loading="lazy" width={48} height={48} />;

  return (
    <figure className="ex-demo">
      <button
        ref={ref}
        type="button"
        aria-label={paused ? "Mostrar a outra posição" : "Pausar a demonstração"}
        onClick={() => (paused ? setFrame((f) => 1 - f) : setPaused(true))}
      >
        {imgs.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={i === 0 ? "Posição inicial" : "Posição final"}
            loading="lazy"
            style={{ opacity: frame === i ? 1 : 0 }}
          />
        ))}
        <span className="ex-demo-tag">{frame === 0 ? "INÍCIO" : "FIM"}</span>
      </button>
      <figcaption className="tiny faint">
        {paused ? "Toque para alternar." : "Toque para pausar."} Foto: free-exercise-db (domínio público), pode variar do aparelho da ficha.
      </figcaption>
    </figure>
  );
}
