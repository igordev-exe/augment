import { Link } from "react-router-dom";

// Fecho de um painel do Progresso: o próximo passo depois de ler (relatório, treinador).

export function PanelActions({ links }: { links: { to: string; label: string }[] }) {
  return (
    <nav className="panel-acts" aria-label="Próximo passo">
      {links.map((l) => (
        <Link key={l.to} to={l.to} className="panel-act">
          {l.label} <span aria-hidden="true">▸</span>
        </Link>
      ))}
    </nav>
  );
}
