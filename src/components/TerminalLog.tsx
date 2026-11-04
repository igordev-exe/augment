// Log de fim de treino no formato de terminal: as linhas aparecem uma a uma (sem animação se o sistema pedir menos movimento).

function tone(line: string): string {
  if (/COMPLETO|NOVO|SOBE|↑|\bOK\b/.test(line)) return " ok";
  if (/PARCIAL|PENDENTE|ÚLTIMO/.test(line)) return " warn";
  return "";
}

export function TerminalLog({ title, lines }: { title: string; lines: string[] }) {
  return (
    <section data-augmented-ui="tl-clip br-clip border" className="term" aria-label={title}>
      <h2 className="term-title glitch" data-text={title}>
        {title}
      </h2>
      <div className="term-lines">
        {lines.map((l, i) => (
          <span key={i} className={`term-line${tone(l)}`} style={{ animationDelay: `${i * 110}ms` }}>
            {l}
          </span>
        ))}
      </div>
    </section>
  );
}
