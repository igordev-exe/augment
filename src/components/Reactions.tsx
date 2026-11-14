import { useEffect, useRef, useState } from "react";
import { REACTIONS, type ReactionId } from "../../server/src/protocol";

// Emojis de reação do AUGMENT: desenho próprio em pixel 12×12, linguagem neon (ciano, vermelho, âmbar, violeta) no
// clima dos kits de referência do dono, sem copiar ícone de terceiros. Cada linha do desenho tem 12 caracteres:
// "." vazio, c ciano, m vermelho, y âmbar, w claro, v violeta. O teste confere o tamanho de cada linha.

export const REACTION_ART: Record<ReactionId, string[]> = {
  forca: [
    "............",
    "............",
    ".cc......cc.",
    "cccc....cccc",
    "cccc....cccc",
    "ccccwwwwcccc",
    "ccccwwwwcccc",
    "cccc....cccc",
    "cccc....cccc",
    ".cc......cc.",
    "............",
    "............",
  ],
  fogo: [
    ".....y......",
    "....yy......",
    "....yym.....",
    "...yymm..y..",
    "...ymmmm.yy.",
    "..yymmmmmyy.",
    "..ymmwwmmmy.",
    ".yymwwwwmmy.",
    ".ymmwwwwmmy.",
    ".ymmmwwmmmy.",
    "..ymmmmmmy..",
    "...yyyyyy...",
  ],
  raio: [
    "......cccc..",
    ".....cccc...",
    "....cccc....",
    "...cccc.....",
    "..cccccccc..",
    ".....cccc...",
    "....cccc....",
    "...cccc.....",
    "..cccc......",
    ".ccc........",
    ".cc.........",
    "............",
  ],
  cranio: [
    "...wwwwww...",
    "..wwwwwwww..",
    ".wwwwwwwwww.",
    ".wwccwwccww.",
    ".wwccwwccww.",
    ".wwwwwwwwww.",
    "..wwwmmwww..",
    "...wwwwww...",
    "...w.ww.w...",
    "...wwwwww...",
    "....w.w.....",
    "............",
  ],
  coracao: [
    "............",
    "..mmm..mmm..",
    ".mmwmmmmmmm.",
    ".mwmmmmmmmm.",
    ".mmmmmmmmmm.",
    ".mmmmmmmmmm.",
    "..mmmmmmmm..",
    "...mmmmmm...",
    "....mmmm....",
    ".....mm.....",
    "............",
    "............",
  ],
  alvo: [
    ".....cc.....",
    "...cccccc...",
    "..cc....cc..",
    ".cc..cc..cc.",
    ".c...cc...c.",
    "cccccmmccccc",
    "cccccmmccccc",
    ".c...cc...c.",
    ".cc..cc..cc.",
    "..cc....cc..",
    "...cccccc...",
    ".....cc.....",
  ],
  chip: [
    "...c.c..c.c.",
    "...c.c..c.c.",
    "..cccccccc..",
    "ccc......ccc",
    "..c.mmmm.c..",
    "ccc.mwwm.ccc",
    "..c.mwwm.c..",
    "ccc.mmmm.ccc",
    "..c......c..",
    "..cccccccc..",
    "...c.c..c.c.",
    "...c.c..c.c.",
  ],
  olho: [
    "mm........mm",
    "m..........m",
    "............",
    "...cccccc...",
    ".cc..ww..cc.",
    "cc..wvvw..cc",
    "cc..wvvw..cc",
    ".cc..ww..cc.",
    "...cccccc...",
    "............",
    "m..........m",
    "mm........mm",
  ],
};

export const REACTION_LABEL: Record<ReactionId, string> = {
  forca: "Força",
  fogo: "Em chamas",
  raio: "Energia",
  cranio: "Destruiu",
  coracao: "Amei",
  alvo: "No alvo",
  chip: "Ciborgue",
  olho: "De olho",
};

const PIXEL: Record<string, string> = {
  c: "var(--cyan)",
  m: "var(--red)",
  y: "var(--amber)",
  w: "var(--ink)",
  v: "var(--violet)",
};

/** Um emoji de reação: pixels em SVG (nítido em qualquer tamanho), sequências da mesma cor viram um retângulo só. */
export function ReactionEmoji({ id, size = 22 }: { id: ReactionId; size?: number }) {
  const rects: JSX.Element[] = [];
  REACTION_ART[id].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (ch !== ".") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={PIXEL[ch]} />);
      x += w;
    }
  });
  return (
    <svg className="rx-emoji" viewBox="0 0 12 12" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
      {rects}
    </svg>
  );
}

/**
 * Barra de reações de um treino do feed: os emojis que já têm reação (com a contagem; o seu fica marcado) e o botão
 * que abre o seletor holográfico. Tocar no seu emoji tira a reação; outro emoji troca (uma reação por pessoa).
 */
export function ReactionBar({
  reactions,
  mine,
  onReact,
  label,
}: {
  reactions?: Partial<Record<ReactionId, number>>;
  mine?: ReactionId;
  onReact: (emoji: ReactionId | "") => void;
  /** Para o leitor de tela: de quem é o treino. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const used = REACTIONS.filter((r) => (reactions?.[r] ?? 0) > 0);

  // Fecha o seletor ao tocar fora ou com Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (r: ReactionId) => {
    setOpen(false);
    onReact(mine === r ? "" : r);
  };

  return (
    <div className="rx-bar" ref={boxRef}>
      {used.map((r) => (
        <button
          key={r}
          type="button"
          className={`rx-chip${mine === r ? " mine" : ""}`}
          aria-pressed={mine === r}
          aria-label={`${REACTION_LABEL[r]}: ${reactions?.[r]}${mine === r ? ", sua reação. Tocar tira" : ""}`}
          onClick={() => pick(r)}
        >
          <ReactionEmoji id={r} size={18} />
          <span>{reactions?.[r]}</span>
        </button>
      ))}
      <button
        type="button"
        className={`rx-add${open ? " open" : ""}`}
        aria-expanded={open}
        aria-label={`Reagir ao treino de ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5s1.2 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01" />
        </svg>
        {used.length === 0 && <span>Reagir</span>}
      </button>
      {open && (
        <div className="rx-picker" role="group" aria-label="Escolha uma reação">
          {REACTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={mine === r ? "mine" : undefined}
              aria-pressed={mine === r}
              aria-label={REACTION_LABEL[r]}
              title={REACTION_LABEL[r]}
              onClick={() => pick(r)}
            >
              <ReactionEmoji id={r} size={28} />
              <span>{REACTION_LABEL[r]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
