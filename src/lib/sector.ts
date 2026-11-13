// Setores do app (docs/plano-refino-visual.md, seção 3A): cada área tem um tom, que pinta o marcador do título, a faixa
// do painel principal e as cantoneiras. O Shell põe a classe `sector-<id>` no <html> conforme a rota; o CSS
// (styles/15-pecas.css) troca `--sector`. As cores de estado (ciano = seleção, âmbar = recorde, verde = ok) não mudam.

export type Sector = "op" | "tel" | "net" | "coach";

export const SECTORS: Sector[] = ["op", "tel", "net", "coach"];

export const SECTOR_LABEL: Record<Sector, string> = {
  op: "Operação",
  tel: "Telemetria",
  net: "Rede",
  coach: "Treinador",
};

const TEL = /^\/(historico|progresso|relatorio|exercicios|guia)(\/|$)/;
const NET = /^\/(online|amigos|privacidade)(\/|$)/;
const COACH = /^\/treinador(\/|$)/;

/** Setor de uma rota (o `pathname` do HashRouter). O que não for dos outros três é Operação. */
export function sectorFor(pathname: string): Sector {
  if (TEL.test(pathname)) return "tel";
  if (NET.test(pathname)) return "net";
  if (COACH.test(pathname)) return "coach";
  return "op";
}

/** Põe a classe do setor no <html> e tira as outras. */
export function applySector(sector: Sector) {
  const cl = document.documentElement.classList;
  for (const s of SECTORS) cl.toggle(`sector-${s}`, s === sector);
}
