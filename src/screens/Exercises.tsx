import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "../components/bits";
import { Icon } from "../components/Icon";
import { LIB_BY_ID } from "../data/library";
import { PROGRAM } from "../data/program";

export function Exercises() {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const query = norm(q.trim());

  return (
    <div className="stack-lg">
      <PageHead code="AUG.OS // BANCO DE MÓDULOS" title="Exercícios" sub="Execução, erros comuns, vídeo e progresso de cada exercício da ficha." />
      <input
        className="input"
        type="search"
        placeholder="Buscar exercício ou músculo"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar exercício"
      />
      {PROGRAM.map((d) => {
        const items = d.exercises.filter((ex) => {
          if (!query) return true;
          const lib = LIB_BY_ID[ex.lib];
          return norm(`${ex.name} ${ex.muscleLabel} ${lib?.primary ?? ""} ${lib?.secondary ?? ""}`).includes(query);
        });
        if (!items.length) return null;
        return (
          <section key={d.id} className="stack" style={{ gap: 6 }}>
            <div className="spread">
              <h2 className="h-sec">{d.name}</h2>
              <span className="small faint">{d.focus}</span>
            </div>
            <ul data-augmented-ui="tl-clip br-clip border" className="list">
              {items.map((ex) => (
                <li key={ex.id}>
                  <Link to={`/exercicios/${ex.lib}`} className="list-item">
                    <span className="grow">
                      <span className="h-card" style={{ fontSize: 15 }}>
                        {ex.name.replace(/^A[12] · /, "")}
                      </span>
                      <span className="small muted" style={{ display: "block" }}>
                        {LIB_BY_ID[ex.lib]?.primary}
                      </span>
                    </span>
                    <span className="chev">
                      <Icon name="chev" size={18} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
