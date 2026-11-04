import type { MuscleId } from "./types";

// Base científica do app: uma fonte só para o motor de regras, o Guia e o prompt do treinador (IA).
// Sintetizada de dois relatórios (nov/2026): "Pesquisa Profunda: Ciências do Exercício" (revisão com
// separação epistêmica e auditoria CoVe) e "Treino Hipertrofia Cinco Dias" (prescrição PPLUL para o perfil dele).
// Quando os dois discordam, vale o nível de evidência mais alto. Texto fixo: entra no prefixo em cache do prompt.

/** evidencia = meta-análises/ECRs; consenso = posicionamentos e revisões; campo = prática sem teste formal; hipotese = mecanismo proposto. */
export type EvidenceLevel = "evidencia" | "consenso" | "campo" | "hipotese";

export const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  evidencia: "Evidência",
  consenso: "Consenso",
  campo: "Prática de campo",
  hipotese: "Hipótese",
};

export interface Principle {
  id: string;
  tema: string;
  nivel: EvidenceLevel;
  /** O que se sabe, em uma ou duas frases. */
  texto: string;
  /** Como o app (ou o treinador) usa isso. */
  app?: string;
  fontes: string[];
}

/** Números que o motor de regras usa. */
export const SCIENCE = {
  /** Peso de uma série indireta (sinergista) no volume fracionado (Pelland 2026). */
  indirectSetWeight: 0.5,
  /** Séries fracionadas/semana por músculo. */
  volume: {
    /** Dose mínima que já supera o menor efeito detectável de hipertrofia. */
    minEffective: 4,
    /** Faixa de melhor relação estímulo-fadiga para intermediários/avançados. */
    efficient: [10, 20] as [number, number],
    /** Acima disso ainda há ganho, com retorno cada vez menor; acima de 42 não há dados. */
    upperData: 42,
  },
  /** Descanso mínimo recomendado (s) para preservar o volume-carga. */
  rest: { isolation: 90, compound: 120 },
} as const;

/**
 * Músculos que recebem séries indiretas (0,5) por exercício da biblioteca.
 * Só multiarticulares; o músculo que já é direto no exercício não conta de novo.
 */
export const SYNERGISTS: Record<string, MuscleId[]> = {
  "supino-inclinado-halteres": ["triceps", "deltAnterior"],
  "supino-reto-maquina": ["triceps", "deltAnterior"],
  "supino-inclinado-smith": ["triceps", "deltAnterior"],
  "desenvolvimento-maquina": ["triceps", "deltLateral"],
  "desenvolvimento-halteres": ["triceps", "deltLateral"],
  "puxada-aberta": ["biceps", "deltPosterior"],
  "puxada-unilateral": ["biceps", "deltPosterior"],
  "remada-apoio-peito": ["biceps", "deltPosterior", "trapezio"],
  "remada-baixa-neutra": ["biceps", "deltPosterior", "trapezio"],
  "face-pull": ["trapezio"],
  hack: ["gluteo"],
  "leg-press-profundo": ["gluteo"],
  "terra-romeno": ["gluteo"],
};

export const PRINCIPLES: Principle[] = [
  // ---------- Volume ----------
  {
    id: "volume-dose",
    tema: "Volume",
    nivel: "evidencia",
    texto:
      "Hipertrofia sobe com as séries semanais por músculo, com retornos decrescentes: 4 séries fracionadas já superam o menor efeito detectável; de 11–18 são ~8,5 séries extras para o mesmo ganho marginal, de 30–42 ~12,5. Acima de 42 não há dados. Força estabiliza cedo (5+ séries fracionadas/semana por padrão).",
    app: "O relatório conta o volume fracionado e avisa quando um músculo fica abaixo de 4 séries fracionadas numa semana fechada.",
    fontes: ["Pelland et al., Sports Med 2026 (67 estudos, n = 2.058; PMID 41343037)", "Schoenfeld, Ogborn e Krieger, J Sports Sci 2017"],
  },
  {
    id: "volume-fracionado",
    tema: "Volume",
    nivel: "evidencia",
    texto:
      "Contar 1,0 série para o músculo-alvo e 0,5 para sinergistas (ex.: supino → tríceps) prevê melhor os ganhos do que contar tudo ou só o direto. Explica por que >20 séries só superou 12–20 no tríceps (muito volume indireto de supinos).",
    fontes: ["Pelland et al., Sports Med 2026", "Baz-Valle et al., J Hum Kinet 2022"],
  },
  {
    id: "volume-faixa",
    tema: "Volume",
    nivel: "consenso",
    texto:
      "10–20 séries semanais por músculo é a faixa padrão de melhor estímulo-fadiga para intermediários e avançados. Em treinados, individualizar (~+20% sobre o volume habitual) rendeu mais que um volume fixo.",
    fontes: ["IUSCA Position Stand, Schoenfeld et al. 2021", "Scarpelli et al. 2022 (intra-sujeito, 16 homens treinados)"],
  },
  {
    id: "volume-marcos",
    tema: "Volume",
    nivel: "campo",
    texto:
      "Marcos de volume (manutenção ~4–6, mínimo efetivo ~8–10, adaptativo ~12–18, máximo recuperável ~20–22 séries) são heurísticas de treinadores para planejar o mesociclo, não limites medidos. Blocos de choque >30 séries num músculo atrasado também não foram testados formalmente.",
    fontes: ["Israetel, Scientific Principles of Hypertrophy Training"],
  },
  // ---------- Frequência ----------
  {
    id: "frequencia",
    tema: "Frequência",
    nivel: "evidencia",
    texto:
      "Com o volume semanal igualado, a frequência tem efeito desprezível na hipertrofia; ela importa como veículo para encaixar mais séries de qualidade. Para força máxima, mais frequência ajuda.",
    app: "Cada músculo cai 2× por semana para dividir o volume (5–8 séries por músculo por sessão).",
    fontes: ["Schoenfeld, Grgic e Krieger, J Sports Sci 2019", "Pelland et al. 2026", "Currier et al., Br J Sports Med 2023 (n = 5.097)"],
  },
  // ---------- Carga ----------
  {
    id: "carga-faixa",
    tema: "Carga e reps",
    nivel: "evidencia",
    texto:
      "Hipertrofia é parecida entre cargas baixas (~30–60% 1RM), moderadas e altas quando as séries vão perto da falha; ~20% 1RM é pouco. Força máxima pede cargas ≥80% 1RM.",
    fontes: ["Lopez et al., MSSE 2021 (28 estudos)", "Schoenfeld et al., JSCR 2017", "Lasevicius et al., Eur J Sport Sci 2018"],
  },
  {
    id: "carga-pratica",
    tema: "Carga e reps",
    nivel: "consenso",
    texto:
      "~6–15 reps é a faixa mais eficiente para a maior parte do volume: menos desconforto que 20–30+ até a falha e menos estresse articular que 5 reps. Escolher reps pela 'tipagem de fibra' do músculo (ex.: só 20–30 em panturrilha) não tem suporte.",
    fontes: ["Schoenfeld, Grgic, Van Every e Plotkin, Sports 2021", "Grgic, 2020 (hipertrofia de fibras tipo I e II)"],
  },
  {
    id: "progressao",
    tema: "Progressão",
    nivel: "evidencia",
    texto:
      "Progredir reps com carga fixa ou progredir carga dá adaptações parecidas; a resposta individual varia (~1/3 cresce mais progredindo reps, ~1/5 progredindo carga). Prescrever por zona de RM progride o volume-carga ~2× mais rápido que %1RM fixo.",
    app: "Base da dupla progressão do app: carga fixa, sobe quando todas as séries batem o topo da faixa.",
    fontes: ["Plotkin et al., PeerJ 2022", "Nóbrega, Scarpelli et al. 2022/2023", "Scarpelli et al. 2025"],
  },
  // ---------- Falha / RIR ----------
  {
    id: "rir-hipertrofia",
    tema: "Falha e RIR",
    nivel: "evidencia",
    texto:
      "Hipertrofia aumenta, de forma não linear, quanto mais perto da falha (0–3 RIR); a força quase não depende disso. Ir à falha estrita não supera parar a 1–2 RIR em hipertrofia (Refalo 2024: espessura do quadríceps idêntica), mas custa mais fadiga, mais queda de reps e pior afeto.",
    app: "As metas de 'sobra' do mesociclo e os avisos de 'perto demais da falha' / 'sobrou demais' vêm daqui.",
    fontes: [
      "Robinson et al., Sports Med 2024 (55 ECRs; RIR estimado, exploratório)",
      "Refalo et al., Sports Med 2023; J Sports Sci 2024; 2025",
      "Grgic et al., J Sport Health Sci 2022",
    ],
  },
  {
    id: "rir-consenso",
    tema: "Falha e RIR",
    nivel: "consenso",
    texto:
      "Maioria das séries a 1–2 RIR; 0 RIR seletivo em isolados, máquinas, últimas séries ou cargas leves (<60% 1RM, onde a falha ajuda mais). Compostos pesados param na falha técnica. A estimativa de RIR melhora perto da falha e com reps baixas/moderadas.",
    fontes: ["Refalo et al. 2023/2024", "Lasevicius et al. 2022", "Zourdos et al. 2021", "Halperin et al., Sports Med 2022"],
  },
  // ---------- Comprimento muscular ----------
  {
    id: "biarticulares",
    tema: "Comprimento muscular",
    nivel: "evidencia",
    texto:
      "Alongar o músculo biarticular na outra articulação rende ~1,4–1,5× mais hipertrofia (RM): cadeira flexora sentada > deitada nos isquiotibiais (+14,1% vs +9,3%); tríceps overhead no cabo > pushdown (+28,5% vs +19,6% na cabeça longa, mesmo com 34–39% menos carga); panturrilha em pé > sentada no gastrocnêmio (+9–12% vs +1–2%; o sóleo cresce igual).",
    app: "Por isso a ficha tem flexora sentada, tríceps overhead e panturrilha em pé como titulares. Ao trocar acessórios, preserve essa posição alongada.",
    fontes: [
      "Maeo et al., MSSE 2021 (PMID 33009197)",
      "Maeo et al., Eur J Sport Sci 2023 (PMID 35819335)",
      "Kinoshita et al. 2023 (PMID 38156065)",
    ],
  },
  {
    id: "parciais-alongadas",
    tema: "Comprimento muscular",
    nivel: "evidencia",
    texto:
      "Parciais na porção alongada superam parciais encurtadas e, em destreinados, até a ROM completa. Em treinados empatam com a ROM completa (não são superiores). Parciais depois da falha têm suporte incerto frente a séries dedicadas na posição alongada.",
    app: "Parciais alongadas são opção equivalente, não obrigação. A alegação de '+5–15% sempre' não se sustenta em treinados.",
    fontes: [
      "Wolf et al., Int J Strength Cond 2023",
      "Wolf et al., PeerJ 2025 (PMID 39959841)",
      "Pedrosa et al. 2022/2023",
      "Kassiano et al., JSCR 2023",
      "Larsen et al. 2025",
    ],
  },
  {
    id: "pausa-alongamento",
    tema: "Comprimento muscular",
    nivel: "campo",
    texto:
      "Pausas de 1–2 s no ponto de estiramento são difundidas, mas os estudos que mostraram vantagem do comprimento longo usaram cadência dinâmica sem pausa prolongada. Pode ajudar o controle; não é o que gera o efeito.",
    fontes: ["Androulakis-Korakakis et al., Sports Med 2024 (PMID 38249086)"],
  },
  {
    id: "titina",
    tema: "Comprimento muscular",
    nivel: "hipotese",
    texto:
      "Mecanismo proposto: tensão passiva da titina somada à ativa amplifica a mecanotransdução (mTORC1), e o treino alongado adicionaria sarcômeros em série. Nenhum estudo em humanos mediu sarcômeros em série diretamente.",
    fontes: ["Wolf et al., Sports Med Health Sci 2025 (PMID 41646176)"],
  },
  // ---------- Seleção ----------
  {
    id: "reto-femoral",
    tema: "Seleção de exercícios",
    nivel: "evidencia",
    texto:
      "Leg press hipertrofia vastos (+4–6%), glúteo máximo (+15%) e adutor magno, mas não o reto femoral (+1,1%); a cadeira extensora sim (+13,2%). Multiarticulares e isolados se completam.",
    app: "Cadeira extensora fica na ficha mesmo com hack e leg press.",
    fontes: ["Kinoshita, Maeo et al., MSSE 2026 (PMID 41630124)"],
  },
  {
    id: "semg",
    tema: "Seleção de exercícios",
    nivel: "evidencia",
    texto:
      "Ativação aguda na eletromiografia não prevê hipertrofia: hip thrust tem o dobro de sEMG no glúteo, mas cresce o glúteo igual ao agachamento em 9 semanas (RM). Unilateral e bilateral dão hipertrofia igual; a força é específica ao gesto.",
    fontes: ["Plotkin et al., Front Physiol 2023 (PMID 37877099)", "Liao et al. 2022; meta-análise 2026 (PMID 42458613)"],
  },
  {
    id: "ordem",
    tema: "Seleção de exercícios",
    nivel: "evidencia",
    texto:
      "A ordem dos exercícios não muda a hipertrofia; a força de 1RM cresce mais no que vem primeiro. Pré-exaustão não aumenta a hipertrofia e reduz a ativação no composto seguinte.",
    app: "Ponha primeiro o músculo prioritário ou o exercício em que ele quer progredir carga.",
    fontes: ["Nunes et al., Eur J Sport Sci 2021 (PMID 32077380)", "Tomeleri et al. 2020"],
  },
  {
    id: "estabilidade",
    tema: "Seleção de exercícios",
    nivel: "campo",
    texto:
      "Para hipertrofia, máquinas, cabos e apoio de peito permitem chegar perto da falha com menos fadiga sistêmica e carga axial (útil num corpo pesado); barras livres pesadas valem mais para força.",
    fontes: ["Relatório 'Treino Hipertrofia Cinco Dias' (prescrição, sem ECR direto)"],
  },
  // ---------- Descanso e cadência ----------
  {
    id: "descanso",
    tema: "Descanso e cadência",
    nivel: "evidencia",
    texto:
      "Descansar >60 s tende a favorecer a hipertrofia porque preserva as reps das séries seguintes; com volume-carga igualado, descanso curto empata. Passar de 90 s não mostrou ganho extra apreciável.",
    app: "Se ele cortar o descanso e as reps caírem muito, o problema é volume-carga perdido, não o descanso em si.",
    fontes: ["Singer et al., Front Sports Act Living 2024 (PMID 39205815)", "Schoenfeld et al., JSCR 2016"],
  },
  {
    id: "descanso-consenso",
    tema: "Descanso e cadência",
    nivel: "consenso",
    texto:
      "Pelo menos 90–120 s em isolados e 2–3+ min em compostos pesados, ou autorregulado. Pausas curtas por 'pico hormonal' são diretriz desacreditada.",
    fontes: ["Singer et al. 2024", "Schoenfeld et al. 2016"],
  },
  {
    id: "cadencia",
    tema: "Descanso e cadência",
    nivel: "evidencia",
    texto:
      "Repetições de 0,5–8 s no total dão hipertrofia parecida perto da falha; superlentas (≥10 s) são piores. Impulso moderado em isolados de braço aumentou o volume-carga sem ganho nem perda de hipertrofia.",
    fontes: ["Schoenfeld, Ogborn e Krieger, Sports Med 2015", "Androulakis-Korakakis et al. 2024"],
  },
  // ---------- Periodização e sistemas ----------
  {
    id: "periodizacao",
    tema: "Periodização e técnicas",
    nivel: "evidencia",
    texto:
      "Periodizar (linear ou ondulatória) melhora a força de 1RM (ondulatória > linear em treinados), mas não muda a hipertrofia com volume igualado.",
    fontes: ["Moesgaard et al., Sports Med 2022 (PMID 35044672)", "Grgic et al. 2017"],
  },
  {
    id: "sistemas-avancados",
    tema: "Periodização e técnicas",
    nivel: "evidencia",
    texto:
      "Drop-set, rest-pause, myo-reps e cluster dão a mesma hipertrofia que séries tradicionais com volume e esforço igualados. São ferramentas de tempo (drop-set leva 1/2 a 1/3 do tempo) à custa de mais esforço percebido, lactato e fadiga.",
    app: "Intensificadores do app ficam na última série dos isolados a partir da semana 3: economia de tempo, não 'estímulo superior'.",
    fontes: [
      "Tsartsapakis et al., J Funct Morphol Kinesiol 2026 (23 estudos)",
      "Havers et al., Sports Med Open 2026; Sødal et al. 2023; Coleman et al. 2022",
      "Enes et al. 2021 (PMID 34260860)",
    ],
  },
  {
    id: "deload",
    tema: "Periodização e técnicas",
    nivel: "campo",
    texto:
      "Deload fixo a cada 4–6 semanas é convenção prática. Pausas curtas (≤3 semanas) não prejudicam ganhos, mas a supercompensação não é automática: o que importa é não acumular overreaching. Deload típico: mesma carga, menos séries, 3–4 RIR.",
    app: "O app combina deload fixo na semana 7 com antecipação por fadiga (check-in e queda de desempenho).",
    fontes: ["Pesquisa Profunda: Ciências do Exercício, seção 7", "Israetel, Scientific Principles of Hypertrophy Training"],
  },
  // ---------- Volume celular ----------
  {
    id: "sarcoplasmatica",
    tema: "Volume celular e pump",
    nivel: "evidencia",
    texto:
      "Em treinados, 6 semanas de volume muito alto aumentaram a área das fibras com diluição de actina/miosina: parte do crescimento é sarcoplasmático (fluido, glicogênio, enzimas). Estudos pequenos; a relevância de longo prazo é incerta.",
    fontes: ["Haun et al., PLoS One 2019", "Roberts et al., Front Physiol 2020 (PMID 32760293)"],
  },
  {
    id: "pump",
    tema: "Volume celular e pump",
    nivel: "hipotese",
    texto:
      "Que o inchaço celular do pump (estresse metabólico, séries longas, supersets) sinalize crescimento crônico é mecanismo proposto, não demonstrado. A tensão mecânica perto da falha é o motor principal.",
    fontes: ["Relatório 'Treino Hipertrofia Cinco Dias', seção 2"],
  },
  {
    id: "carboidrato",
    tema: "Volume celular e pump",
    nivel: "hipotese",
    texto:
      "Concentrar carboidrato perto do treino para encher glicogênio (cada g retém água) deixa o músculo mais 'cheio' visualmente; efeito estético agudo, não hipertrofia. Em composição corporal alta, manutenção ou leve déficit com proteína alta é o padrão.",
    fontes: ["Relatório 'Treino Hipertrofia Cinco Dias', seção 8", "Aragon e Schoenfeld, Strength Cond J"],
  },
];

/** Alegações comuns já auditadas (CoVe): crença → veredito. */
export const AUDITS: { crenca: string; veredito: string }[] = [
  {
    crenca: "Crescimento medido nas 2–4 primeiras semanas já é proteína contrátil.",
    veredito: "Em destreinados é boa parte edema; hipertrofia sem edema consolida após ~8–10 semanas (Damas et al. 2016/2018).",
  },
  {
    crenca: "Hip thrust cresce mais o glúteo porque ativa o dobro na EMG.",
    veredito: "Falso em RM após 9 semanas: hipertrofia igual ao agachamento (Plotkin 2023).",
  },
  {
    crenca: "Mais de 10 séries/semana causam overtraining e perda de massa (Barbalho).",
    veredito:
      "Esses estudos têm padrões estatísticos improváveis; a curva real segue positiva até 30–42 séries fracionadas (Pelland 2026).",
  },
  {
    crenca: "Parciais alongadas sempre dão 10–15% a mais que a ROM completa.",
    veredito: "Só em destreinados; em treinados empatam (Wolf 2025).",
  },
  {
    crenca: "A meta-regressão de RIR mediu o RIR de todo mundo.",
    veredito: "O RIR foi estimado das descrições dos estudos; é exploratória. Triangule com ECRs diretos (Refalo 2024).",
  },
];

/** Bloco de texto da base científica para o prompt do treinador. Determinístico. */
export function scienceText(): string {
  const temas = [...new Set(PRINCIPLES.map((p) => p.tema))];
  const out: string[] = [];
  for (const t of temas) {
    out.push(`### ${t}`);
    for (const p of PRINCIPLES.filter((x) => x.tema === t)) {
      out.push(`- [${LEVEL_LABEL[p.nivel]}] ${p.texto}` + (p.app ? ` No app: ${p.app}` : "") + ` (Fontes: ${p.fontes.join("; ")}.)`);
    }
    out.push("");
  }
  out.push("### Alegações auditadas");
  for (const a of AUDITS) out.push(`- "${a.crenca}" → ${a.veredito}`);
  return out.join("\n");
}
