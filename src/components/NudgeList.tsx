import { LEVEL_LABEL, PRINCIPLES } from "../data/science";
import type { Nudge } from "../lib/engine";

// Recados do motor de decisões, cada um com o nível de evidência e a fonte principal do porquê.

const BY_ID = Object.fromEntries(PRINCIPLES.map((p) => [p.id, p]));
const COLOR = { warn: "var(--amber)", info: "var(--ink-2)", good: "var(--cyan)" } as const;

/** Nível + 1ª fonte do princípio, ex.: "Evidência · Singer et al. 2024". */
export function whyLabel(id: string): string | null {
  const p = BY_ID[id];
  if (!p) return null;
  const src = p.fontes[0]?.split(/[;(]/)[0].trim();
  return `${LEVEL_LABEL[p.nivel]}${src ? ` · ${src}` : ""}`;
}

export function NudgeList({ nudges }: { nudges: Nudge[] }) {
  if (!nudges.length) return null;
  return (
    <div className="stack" style={{ gap: 6 }} aria-live="polite">
      {nudges.map((n) => {
        const why = whyLabel(n.why);
        return (
          <div key={`${n.id}-${n.text}`} className="nudge" style={{ borderLeft: `2px solid ${COLOR[n.tone]}`, paddingLeft: 8 }}>
            <span className="small" style={{ color: n.tone === "info" ? undefined : COLOR[n.tone] }}>
              {n.text}
            </span>
            {why && (
              <span className="tiny faint" style={{ display: "block" }}>
                {why}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
