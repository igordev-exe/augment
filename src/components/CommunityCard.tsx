import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Percentile, RankRow } from "../../server/src/protocol";
import { LIMITS } from "../../server/src/protocol";
import { libraryName } from "../data/library-extended";
import { SysModule } from "./SysModule";
import { friendsRanking } from "../lib/online/account";
import { apiUrl } from "../lib/online/client";
import { useOnline } from "../lib/online/sync";
import { formatWeight } from "../lib/progression";

/** Frase da comparação: "mais carga que 72% dos usuários". */
export function pctPhrase(pct: number): string {
  if (pct >= 99) return "mais que praticamente todos";
  if (pct <= 1) return "menos que a maioria, por enquanto";
  return `mais que ${pct}% dos usuários`;
}

/** "mulheres com peso parecido com o seu", "homens", "pessoas com peso parecido com o seu". */
export function groupLabel(g: NonNullable<Percentile["group"]>): string {
  const who = g.sex === "f" ? "mulheres" : g.sex === "m" ? "homens" : "pessoas";
  return g.weight ? `${who} com peso parecido com o seu` : who;
}

/** As duas comparações mais justas (faixa e força relativa), ou o convite para informar sexo e peso. */
function FairLines({ p }: { p: Percentile }) {
  if (!p.group && !p.rel) {
    return (
      <Link to="/online" className="tap small">
        Comparação mais justa: informe sexo e peso (opcional) &gt;
      </Link>
    );
  }
  const few = (n: number) => `ainda há pouca gente para comparar (${n} de ${LIMITS.minOthers})`;
  return (
    <ul className="fair-list small">
      {p.group && (
        <li>
          <span className="label">Na sua faixa</span>
          Entre {groupLabel(p.group)}:{" "}
          {p.group.pct == null ? few(p.group.others) : <strong>{pctPhrase(p.group.pct).replace(" dos usuários", "")}</strong>}.
        </li>
      )}
      {p.rel && (
        <li>
          <span className="label">Força relativa</span>
          Seu 1RM estimado é {p.rel.ratio.toFixed(2).replace(".", ",")}× o seu peso corporal:{" "}
          {p.rel.pct == null ? few(p.rel.others) : <strong>{pctPhrase(p.rel.pct)}</strong>}.
        </li>
      )}
    </ul>
  );
}

/** Na página do exercício: sua posição entre todos os usuários e o ranking entre amigos. */
export function CommunityCard({ libId }: { libId: string }) {
  const online = useOnline();
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const user = online?.user;

  useEffect(() => {
    if (!user || libId.startsWith("custom-")) return;
    friendsRanking(libId)
      .then(setRanking)
      .catch(() => setRanking(null));
  }, [user, libId]);

  if (!apiUrl() || online === undefined || libId.startsWith("custom-")) return null;

  if (!user) {
    return (
      <section className="stack">
        <h2 className="h-sec">Comparação</h2>
        <div data-augmented-ui="tl-clip br-clip border" className="card flat stack small">
          <span>Quer saber quanto você pega em relação aos outros usuários e aos seus amigos?</span>
          <Link to="/online" className="tap">
            Criar conta online (opcional) &gt;
          </Link>
        </div>
      </section>
    );
  }

  const p = online.percentiles?.[libId];
  const others = ranking ? ranking.filter((r) => !r.me) : [];

  return (
    <section className="stack">
      <h2 className="h-sec">Comparação</h2>
      <div data-augmented-ui="tl-clip br-clip border" className="card stack">
        {!p ? (
          <p className="small muted" style={{ margin: 0 }}>
            Faça este exercício (sem alternativa) e sincronize para entrar na comparação.
          </p>
        ) : p.pctLoad == null || p.pctE1rm == null ? (
          <p className="small muted" style={{ margin: 0 }}>
            Ainda {p.others === 0 ? "ninguém além de você tem" : p.others === 1 ? "só 1 pessoa tem" : `só ${p.others} pessoas têm`} marca
            neste exercício. A comparação aparece a partir de {LIMITS.minOthers}.
          </p>
        ) : (
          <>
            <div className="pct-hero">
              <span className="label">Carga máxima ({formatWeight(p.loadKg)} kg)</span>
              <span className="pct-num">{p.pctLoad}%</span>
              <span className="small">Você pega {pctPhrase(p.pctLoad)} neste exercício.</span>
              <span className="pct-bar" role="img" aria-label={`${p.pctLoad}% dos usuários abaixo de você`}>
                <i style={{ width: `${p.pctLoad}%` }} />
              </span>
            </div>
            <p className="small" style={{ margin: 0 }}>
              1RM estimado ({formatWeight(Math.round(p.e1rmKg))} kg): {pctPhrase(p.pctE1rm)}.
            </p>
            <FairLines p={p} />
            <p className="tiny faint" style={{ margin: 0 }}>
              Comparado com {p.others} pessoas. Máquinas de marcas diferentes podem pesar diferente: use como referência.
            </p>
          </>
        )}

        {ranking && others.length > 0 && (
          <>
            <div className="divider" />
            <span className="label">Entre amigos (1RM estimado)</span>
            <ol className="rank-list">
              {ranking.map((r) => (
                <li key={r.user.id} className={`rank-row${r.me ? " me" : ""}`}>
                  <span className="who small">{r.me ? "Você" : r.user.displayName}</span>
                  <span className="mono small">
                    {formatWeight(Math.round(r.e1rmKg))} kg <span className="faint">· máx {formatWeight(r.loadKg)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        {ranking && others.length === 0 && (
          <Link to="/amigos" className="tap small">
            Adicione amigos para ver o ranking deste exercício &gt;
          </Link>
        )}
      </div>
    </section>
  );
}

/** No Progresso: seus exercícios com melhor posição entre todos os usuários. */
export function CommunityModule() {
  const online = useOnline();
  if (!apiUrl() || online === undefined) return null;
  const list = Object.values(online.percentiles ?? {})
    .filter((p) => p.pctLoad != null)
    .sort((a, b) => b.pctLoad! - a.pctLoad!);
  const waiting = Object.values(online.percentiles ?? {}).filter((p) => p.pctLoad == null).length;

  return (
    <SysModule
      id="comunidade"
      code="NET.06"
      title="Você vs. comunidade"
      hint="Carga máxima comparada a outros usuários"
      meta={online.user ? list.length || "—" : "off"}
    >
      {!online.user ? (
        <div data-augmented-ui="tl-clip br-clip border" className="card flat stack small">
          <span>Com uma conta online, cada exercício mostra quanto você pega em relação aos outros usuários.</span>
          <Link to="/online" className="tap">
            Criar conta (opcional) &gt;
          </Link>
        </div>
      ) : list.length === 0 ? (
        <div data-augmented-ui="tl-clip br-clip border" className="card flat empty small">
          {waiting
            ? `Seus ${waiting} exercícios ainda têm poucos usuários para comparar (mínimo ${LIMITS.minOthers}). Conforme mais gente treina, aparecem aqui.`
            : "Termine um treino com internet para entrar na comparação."}
        </div>
      ) : (
        <div data-augmented-ui="tl-clip br-clip border" className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Exercício</th>
                <th className="r">Acima de</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 12).map((p) => (
                <tr key={p.lib}>
                  <td>
                    <Link className="tap" to={`/exercicios/${p.lib}`}>
                      {libraryName(p.lib) ?? p.lib}
                    </Link>
                  </td>
                  <td className="r">
                    <span className="pct-chip">{p.pctLoad}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SysModule>
  );
}
