import { useEffect, useRef } from "react";
import { playReward } from "../lib/fx";
import { RECORD_BUZZ } from "../lib/hooks";
import { vibrate } from "../lib/native";
import { rankProgress } from "../lib/profile";
import { Hex, SegBar } from "./Pieces";

// Posto com progresso (MC2): hexágono aceso com o nível, barra segmentada até o próximo posto e "faltam N sessões".
// Tudo de rankProgress() (lib/profile.ts), que usa os mesmos cortes de rankOf(). Ao subir de posto, a família
// "recompensa" dispara uma vez: o último posto visto fica no aparelho (localStorage, só uma conveniência visual).

const SEEN_KEY = "augment-rank-seen";
const ROMAN = ["I", "II", "III", "IV", "V"];

export function RankRow({ done }: { done: number }) {
  const p = rankProgress(done);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let seen = -1;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY) ?? -1);
    } catch {
      /* sem armazenamento: nada a lembrar */
    }
    if (seen >= 0 && p.index > seen) {
      vibrate(RECORD_BUZZ);
      playReward(ref.current);
    }
    try {
      localStorage.setItem(SEEN_KEY, String(p.index));
    } catch {
      /* idem */
    }
  }, [p.index]);

  return (
    <div className="rank-row" ref={ref}>
      <Hex state="on" label={`Posto ${p.index + 1}`} value={ROMAN[p.index]} />
      <div className="rank-text">
        <strong>{p.rank}</strong>
        {p.next ? (
          <>
            <SegBar value={p.into} max={p.span} segs={10} size="m" label={`Progresso até ${p.next}: ${p.into} de ${p.span} sessões`} read />
            <span className="rank-need">
              Faltam {p.need} {p.need === 1 ? "sessão" : "sessões"} para {p.next}
            </span>
          </>
        ) : (
          <span className="rank-need">Último posto alcançado</span>
        )}
      </div>
    </div>
  );
}
