import { useState } from "react";
import type { Achievement } from "../lib/achievements";
import { Hex, SegBar } from "./Pieces";

// Conquistas em grade de hexágonos (MC2). Travada = hexágono com hachura e traço; conquistada = aceso na cor do setor
// com ✓. Tocar abre o painel de detalhe: o que é e quanto falta, em texto simples. Os números vêm de
// computeAchievements (lib/achievements.ts): `unlocked`, `progress` e `pct`.

export function AchievementGrid({ items }: { items: Achievement[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const cur = items.find((a) => a.id === sel) ?? null;
  return (
    <div className="ach">
      <div className="ach-grid" role="group" aria-label="Conquistas">
        {items.map((a) => (
          <Hex
            key={a.id}
            state={a.id === sel ? "sel" : a.unlocked ? "on" : "off"}
            label={a.title}
            onClick={() => setSel(a.id === sel ? null : a.id)}
          />
        ))}
      </div>
      {cur && (
        <div className="ach-detail" aria-live="polite">
          <span className="list-label">{cur.unlocked ? "Conquistado" : "Travado"}</span>
          <strong>{cur.title}</strong>
          <p className="small">{cur.detail}</p>
          {cur.unlocked ? (
            <span className="tiny mono ach-ok">Feito</span>
          ) : (
            <>
              <SegBar value={cur.pct} max={100} segs={10} size="s" label={`${cur.title}: ${cur.progress}`} />
              <span className="tiny mono">Falta: {cur.progress}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
