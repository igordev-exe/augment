import { useRef, type CSSProperties } from "react";

// Log de fim de treino como um terminal: um comando digitado, depois cada linha "datilografada" caractere a caractere
// (uma depois da outra), barra de envio e cursor piscando. Glitch no título e varredura passando pela tela.
// Com "reduzir movimento" no sistema, tudo aparece pronto (as larguras finais são o estado de repouso).

const MS_PER_CHAR = 14;
const GAP = 70;

function tone(value: string): string {
  if (/COMPLETO|NOVO|SOBE|↑|^OK$/.test(value)) return " ok";
  if (/PARCIAL|PENDENTE|ÚLTIMO/.test(value)) return " warn";
  return "";
}

/** Separa "//RÓTULO........ valor" em rótulo (com os pontos) e valor, para colorir só o valor. */
function split(line: string): [string, string] {
  const m = line.match(/^(\/\/[^.]+\.{2,}\s)(.*)$/);
  if (m) return [m[1], m[2]];
  if (line.startsWith("//  ↑")) return ["//  ", line.slice(4)];
  return [line, ""];
}

export function TerminalLog({ title, lines, command }: { title: string; lines: string[]; command: string }) {
  let t = 300;
  const typed = (text: string) => {
    const n = text.length;
    const style = { "--w": `${n}ch`, "--n": n, animationDelay: `${t}ms`, animationDuration: `${n * MS_PER_CHAR}ms` } as CSSProperties;
    t += n * MS_PER_CHAR + GAP;
    return style;
  };
  const cmdStyle = typed(`> ${command}`);
  const lineStyles = lines.map((l) => typed(l));
  const barDelay = t;
  const caretDelay = t + 900;
  const ref = useRef<HTMLElement>(null);

  // Toque no terminal: termina a digitação na hora (para quem só quer ver o resultado e ir embora).
  function skip() {
    ref.current?.getAnimations({ subtree: true }).forEach((a) => {
      try {
        if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish();
      } catch {
        /* animação sem fim definido */
      }
    });
  }

  return (
    <section ref={ref} data-augmented-ui="tl-clip br-clip border" className="term" aria-label={title} onClick={skip}>
      <div className="term-bar" aria-hidden="true">
        <span>AUG.SHELL // v2.6</span>
        <span className="term-skip">toque para pular</span>
        <span className="term-leds">
          <i />
          <i />
          <i />
        </span>
      </div>
      <h2 className="term-title glitch" data-text={title} style={{ ["--late" as string]: `${caretDelay}ms` }}>
        {title}
      </h2>
      <div className="term-lines">
        <span className="term-line cmd" style={cmdStyle}>
          {`> ${command}`}
        </span>
        {lines.map((l, i) => {
          const [lbl, val] = split(l);
          return (
            <span key={i} className="term-line" style={lineStyles[i]}>
              <span className="lbl">{lbl}</span>
              {val && <span className={`val${tone(val)}`}>{val}</span>}
            </span>
          );
        })}
        <span className="term-upload" style={{ animationDelay: `${barDelay}ms` }} aria-hidden="true">
          <span>UPLOAD</span>
          <i>
            <u style={{ animationDelay: `${barDelay}ms` }} />
          </i>
          <span>100%</span>
        </span>
        <span className="term-caret" style={{ animationDelay: `${caretDelay}ms` }} aria-hidden="true">
          &gt;
        </span>
      </div>
      <span className="term-sweep" aria-hidden="true" />
    </section>
  );
}
