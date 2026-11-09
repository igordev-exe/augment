import type { MuscleId } from "./types";

// Base científica do app: uma fonte só para o motor de regras, o Guia e o prompt do treinador (IA).
// Sintetizada de três documentos (nov/2026): "Pesquisa Profunda: Ciências do Exercício" (revisão com
// separação epistêmica e auditoria CoVe), "Treino Hipertrofia Cinco Dias" (prescrição PPLUL) e "Treino de força e
// hipertrofia baseado em evidências — banco de fontes" (ACSM 2026, divisões, diferenças entre os sexos, programas modelo).
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
  /** Teto prático por sessão: acima de ~11 séries fracionadas de um músculo no mesmo treino o ganho extra some (Remmert 2025). */
  perSessionCeiling: 11,
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
    id: "acsm-2026",
    tema: "Volume",
    nivel: "consenso",
    texto:
      "O posicionamento do ACSM de 2026 (o primeiro desde 2009; 137 revisões sistemáticas, mais de 30 mil participantes, GRADE) recomenda ~10 séries por músculo por semana para hipertrofia e ~80% de 1RM em 2–3 séries para força. Treinar até a falha, o tipo de equipamento e periodização complexa não mudaram o resultado de forma consistente no adulto médio. São mínimos eficazes para a população geral; quem busca hipertrofia máxima usa 10–20 séries.",
    app: "O piso dos modelos prontos fica perto de 10 séries fracionadas por músculo; os de mais volume chegam a 12–16.",
    fontes: ["Currier et al., ACSM Position Stand, MSSE 2026"],
  },
  {
    id: "volume-marcos",
    tema: "Volume",
    nivel: "campo",
    texto:
      "Marcos de volume (manutenção ~4–6, mínimo efetivo ~8–10, adaptativo ~12–18, máximo recuperável ~20–22 séries) são heurísticas de treinadores para planejar o mesociclo, não limites medidos. Blocos de choque >30 séries num músculo atrasado também não foram testados formalmente.",
    fontes: ["Israetel, Scientific Principles of Hypertrophy Training"],
  },
  {
    id: "teto-sessao",
    tema: "Volume",
    nivel: "evidencia",
    texto:
      "Por sessão, o benefício extra quase some perto de ~11 séries fracionadas de um músculo (hipertrofia) e ~2 séries diretas (força). É um preprint, ainda sem revisão por pares, com poucos estudos de volume alto: use como regra prática (até ~10 séries de um músculo por treino; para mais volume, aumente a frequência).",
    app: "O montador de programas avisa quando um dia passa de ~11 séries fracionadas para o mesmo músculo.",
    fontes: ["Remmert et al., SportRxiv 2025 (meta-regressão, preprint)"],
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
  {
    id: "divisao",
    tema: "Frequência",
    nivel: "evidencia",
    texto:
      "Com volume igualado, Fullbody, Upper/Lower e PPL dão hipertrofia e força equivalentes (14 estudos, 4–12 semanas). Estudos isolados apontam para lados opostos (Bartolomei 2021: fullbody mais força, divisão mais hipertrofia; Schoenfeld 2015: o contrário no bíceps), e a meta-análise dilui essas diferenças. Escolha pela agenda e pela aderência: fullbody perdoa faltas melhor; evite treinar um músculo só 1×/semana se isso passar de ~10 séries numa sessão.",
    app: "Os modelos prontos cobrem Fullbody 3×, Upper/Lower 4× e PPL 6× com o mesmo volume-alvo; o que muda é a agenda.",
    fontes: [
      "Ramos-Campo et al., JSCR 2024 (14 estudos)",
      "Bartolomei et al., JSCR 2021 (21 treinados)",
      "Schoenfeld et al., JSCR 2015",
      "Currier et al., ACSM 2026",
    ],
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
  {
    id: "inicio-bloco",
    tema: "Falha e RIR",
    nivel: "campo",
    texto:
      "Nas 2 primeiras semanas de um bloco (ou depois de uma pausa), fique 1 repetição mais longe da falha do que o planejado: a técnica e as cargas se acertam sem acumular fadiga logo no começo.",
    app: "Na semana 1 do mesociclo ninguém vai à falha e os isolados têm 1 série a menos.",
    fontes: ["Banco de fontes (nov/2026), regras comuns aos programas"],
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
    id: "parciais-pos-falha",
    tema: "Comprimento muscular",
    nivel: "campo",
    texto:
      "Parciais depois da falha (continuar com meia amplitude quando a completa não sai mais) são técnica comum de intensificação. Num ensaio em treinados, séries dedicadas de parciais alongadas na panturrilha deram +9,5% contra +6,7% de amplitude completa seguida de parciais pós-falha, com suporte estatístico incerto. Não há prova de vantagem sobre séries normais.",
    fontes: ["Larsen, Falch, Wolf et al. 2025 (PMC12375417)"],
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
  {
    id: "equipamento",
    tema: "Seleção de exercícios",
    nivel: "consenso",
    texto:
      "Máquinas e pesos livres não deram diferença consistente de hipertrofia ou força no adulto médio. Qualquer exercício pode ser trocado por outro do mesmo padrão de movimento (agachamento livre → hack ou leg press; supino com barra → halteres ou máquina).",
    app: "As trocas sugeridas pelo app são as alternativas da biblioteca, do mesmo padrão de movimento.",
    fontes: ["Currier et al., ACSM Position Stand, MSSE 2026"],
  },
  {
    id: "bfr",
    tema: "Seleção de exercícios",
    nivel: "evidencia",
    texto:
      "Restrição do fluxo sanguíneo (oclusão parcial com manguito) com cargas de 20–40% de 1RM gera hipertrofia parecida com cargas altas e menos edema nas primeiras semanas. É opção para quem não tolera carga pesada (dor articular, volta de lesão), com equipamento e orientação adequados.",
    fontes: ["Lixandrão et al., Sports Med 2018", "Shiromaru et al. 2019"],
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
      "Deload fixo a cada 4–6 semanas é convenção prática. Num ensaio com treinados, uma semana sem treino no meio de 9 semanas não mudou a hipertrofia e reduziu um pouco o ganho de força: o deload é opcional, uma ferramenta para quando a fadiga acumulada derruba o desempenho. Pausas curtas (≤3 semanas) não prejudicam ganhos, mas a supercompensação não é automática. Deload típico: mesma carga, menos séries, 3–4 RIR.",
    app: "O app combina deload fixo na semana 7 com antecipação por fadiga (check-in e queda de desempenho).",
    fontes: [
      "Coleman et al., PeerJ 2024 (39 treinados)",
      "Pesquisa Profunda: Ciências do Exercício, seção 7",
      "Israetel, Scientific Principles of Hypertrophy Training",
    ],
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
  // ---------- Autorregulação (motor de decisões) ----------
  {
    id: "autorregulacao",
    tema: "Autorregulação",
    nivel: "consenso",
    texto:
      "O desempenho oscila de um dia para o outro (sono, estresse, déficit). Ajustar a sessão pelo que a primeira série e o RIR mostram, em vez de forçar o número planejado, mantém o esforço na faixa certa sem acumular fadiga à toa.",
    app: "O motor compara a 1ª série com a última vez e o RIR marcado com a meta da semana, e ajusta o recado da série seguinte.",
    fontes: ["Helms, Cronin, Storey e Zourdos, Strength Cond J 2016 (RIR)", "Zourdos et al., JSCR 2016", "Refalo et al. 2024"],
  },
  {
    id: "ancora",
    tema: "Autorregulação",
    nivel: "campo",
    texto:
      "Quem varia a carga entre séries usa série-âncora (a mais pesada, na faixa e no RIR, segue a dupla progressão) + séries de volume ~10–15% mais leves. Alternar cargas sem critério (40/60/40) impede comparar semanas.",
    app: "O motor reconhece o formato âncora e progride pela série 1, não pela carga das séries leves.",
    fontes: ["Programa de Hipertrofia v2, Parte 2"],
  },
  {
    id: "volume-cego",
    tema: "Autorregulação",
    nivel: "campo",
    texto:
      "Cargas ou reps caindo de forma sistemática, semana a semana, com a mesma carga, indicam que o volume passou do recuperável: corte séries, não adicione. Em déficit esse limite chega antes (atenção a partir da semana 4). Antecipe o deload quando dois sinais aparecem juntos: queda de reps com a mesma carga em 2 sessões seguidas, sono ruim, articulação reclamando.",
    app: "O alerta de fadiga conta exercícios com reps caindo na mesma carga e cruza com check-in e articulação.",
    fontes: ["Programa de Hipertrofia v2, Parte 2", "Rogerson et al., Sports Med Open 2024 (deload na prática)"],
  },
  {
    id: "feedback-volume",
    tema: "Autorregulação",
    nivel: "campo",
    texto:
      "Ajustar séries por músculo a partir do retorno (pump, sensação de volume, articulação) e do desempenho é heurística de treinadores (estilo RP). O que tem evidência é que individualizar o volume rende mais que um volume fixo em treinados.",
    app: "No fim do mesociclo o relatório sugere +1 ou −1 série por músculo para o próximo, nunca passando de 4 séries por exercício.",
    fontes: ["Israetel, Scientific Principles of Hypertrophy Training", "Scarpelli et al. 2022"],
  },
  // ---------- Sexo e populações ----------
  {
    id: "sexos-hipertrofia",
    tema: "Sexo e populações",
    nivel: "evidencia",
    texto:
      "Mulheres e homens ganham músculo na mesma proporção (29 estudos); em valor absoluto há leve vantagem masculina pelo ponto de partida. Mulheres iniciantes ganham proporcionalmente mais força no tronco superior. As mesmas variáveis (volume, esforço, carga, frequência) valem para os dois: não há motivo para treinar menos membros superiores.",
    app: "Os modelos com ênfase em pernas e glúteos usam o mesmo volume e RIR dos demais; a ênfase é escolha de objetivo, não necessidade fisiológica.",
    fontes: ["Refalo et al., PeerJ 2025 (meta-análise bayesiana, 29 estudos)", "Roberts, Nuckols e Krieger, JSCR 2020"],
  },
  {
    id: "sexos-fadiga",
    tema: "Sexo e populações",
    nivel: "evidencia",
    texto:
      "Mulheres cansam mais devagar dentro do treino e recuperam no mesmo ritmo entre sessões: com a mesma % de 1RM costumam fazer mais repetições. Prescreva por RIR, não por %. Descanso de 1,5–2,5 min nos compostos e 60–90 s nos isoladores costuma bastar.",
    app: "O app prescreve por faixa de reps e RIR, que já se ajusta a isso; os modelos com ênfase em glúteos usam descanso um pouco menor nos compostos.",
    fontes: ["Nuckols et al., PeerJ 2026 (42 treinados)", "Hunter, Exerc Sport Sci Rev 2009"],
  },
  {
    id: "ciclo-menstrual",
    tema: "Sexo e populações",
    nivel: "evidencia",
    texto:
      "A evidência atual não mostra influência da fase do ciclo menstrual no desempenho nem nos ganhos, e a pílula anticoncepcional não afeta hipertrofia, força ou potência (8 estudos, 325 participantes). Não é preciso periodizar pelo ciclo: ajuste pelo bem-estar do dia.",
    app: "O check-in (sono, energia, dor) é o ajuste do dia, para qualquer pessoa.",
    fontes: ["Colenso-Semple et al., Front Sports Act Living 2023 (revisão guarda-chuva)", "Nolan et al., Sports Med 2023"],
  },
  {
    id: "mulheres-volume",
    tema: "Sexo e populações",
    nivel: "evidencia",
    texto:
      "Na meta-análise só com mulheres (24 estudos), frequência e volume moderaram os ganhos de força: treinar cada músculo 2–3×/semana. Em 50 iniciantes, fullbody 2× e upper/lower 4× deram a mesma força, massa e potência. Cuidado: a maioria dos estudos ainda é masculina (79% em Pelland 2026), então as faixas de volume para mulheres são extrapolação razoável, não dado direto.",
    fontes: ["Hagstrom et al., Sports Med 2020 (24 estudos)", "Pedersen et al., BMC Sports Sci Med Rehabil 2022", "Pelland et al. 2026"],
  },
  {
    id: "idosos",
    tema: "Sexo e populações",
    nivel: "evidencia",
    texto:
      "Em idosos (151 ECRs), volumes baixos já melhoram função física e saúde; o volume alto serve a quem busca hipertrofia máxima, não é pré-requisito para os benefícios do treino.",
    fontes: ["Radaelli et al. 2025 (151 ECRs)"],
  },
  {
    id: "dor-femoropatelar",
    tema: "Sexo e populações",
    nivel: "evidencia",
    texto:
      "Com dor femoropatelar, ajuste a amplitude da cadeira extensora aos sintomas: 70°–25° de flexão provocou mais dor, e 45°–0° gerou menor torque na articulação. Amplitude sem dor vem antes de amplitude máxima.",
    fontes: ["PMID 42852459 (2026)"],
  },
  // ---------- Recomposição e recuperação ----------
  {
    id: "ritmo-perda",
    tema: "Recomposição",
    nivel: "evidencia",
    texto:
      "Em treinados, perder ~0,7% do peso por semana preservou e ganhou mais massa magra que 1,4% (Garthe 2011). Déficits ~500 kcal/dia tendem a zerar o ganho de massa magra do treino (Murphy e Koehler 2022). Alvo da fase: 0,4–0,6 kg por semana pela média semanal do peso.",
    app: "Com 2 semanas seguidas fora da faixa, o motor sugere ±130 kcal (4 colheres de arroz), nunca abaixo do piso de 2.100 kcal.",
    fontes: ["Garthe et al., IJSNEM 2011", "Murphy e Koehler, Scand J Med Sci Sports 2022", "Plano Alimentar v2"],
  },
  {
    id: "recomposicao",
    tema: "Recomposição",
    nivel: "evidencia",
    texto:
      "Em treinados com ~25% de gordura, déficit de ~250 kcal com 2,5 g/kg de proteína reduziu ~2,9 kg de gordura e aumentou ~1 kg de massa magra em 10 semanas. Estudo pequeno (10 por grupo): indício, não garantia. Peso parado com cintura caindo e cargas subindo = recomposição acontecendo.",
    fontes: ["Vargas-Molina et al., Eur J Appl Physiol 2026"],
  },
  {
    id: "proteina",
    tema: "Recomposição",
    nivel: "consenso",
    texto:
      "Em déficit, ~2,0–2,3 g/kg de proteína (ou ~2,8–3 g/kg de massa magra), em 4 refeições de 30–55 g. Acima disso sem benefício claro.",
    fontes: ["Refalo, Trexler e Helms, Strength Cond J 2025", "Helms et al., IJSNEM 2014", "Mamerow et al., J Nutr 2014"],
  },
  {
    id: "sono",
    tema: "Recomposição",
    nivel: "evidencia",
    texto:
      "Com o mesmo déficit, dormir ~5,5 h em vez de ~8,5 h reduziu em 55% a perda de gordura e aumentou em 60% a perda de massa magra. Sono ruim repetido é o primeiro suspeito quando as cargas caem.",
    fontes: ["Nedeltcheva et al., Ann Intern Med 2010"],
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
    crenca: "Mulher precisa treinar diferente: mais leve, mais repetições e menos tronco.",
    veredito:
      "Falso: a hipertrofia relativa é igual entre os sexos e as mesmas variáveis valem (Refalo 2025; Roberts 2020). Muda o ponto de partida, não o método.",
  },
  {
    crenca: "É preciso periodizar o treino pelas fases do ciclo menstrual.",
    veredito: "A evidência atual não mostra efeito da fase nos ganhos (Colenso-Semple 2023). Ajuste pelo bem-estar do dia.",
  },
  {
    crenca: "Fullbody (ou PPL) é a divisão que mais faz crescer.",
    veredito: "Com volume igual, as divisões empatam (Ramos-Campo 2024). A melhor é a que cabe na agenda e você cumpre.",
  },
  {
    crenca: "Máquina não constrói músculo como peso livre.",
    veredito: "Sem diferença consistente no adulto médio (ACSM 2026). Escolha pelo conforto, pela progressão e pelo que a academia tem.",
  },
  {
    crenca: "Deload a cada poucas semanas é obrigatório para crescer.",
    veredito: "Uma semana parada no meio de 9 não mudou a hipertrofia (Coleman 2024). Deload é ferramenta para fadiga, não regra.",
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

/** Etiqueta de evidência por exercício da biblioteca (aparece na oficina de exercícios). */
export const EXERCISE_EVIDENCE: Record<string, { tag: string; why: string }> = {
  "flexora-sentada": { tag: "Alongado", why: "biarticulares" },
  "triceps-overhead-cabo": { tag: "Alongado", why: "biarticulares" },
  "panturrilha-em-pe": { tag: "Alongado", why: "biarticulares" },
  "cadeira-extensora": { tag: "Reto femoral", why: "reto-femoral" },
  "leg-press-profundo": { tag: "Vastos + glúteo", why: "reto-femoral" },
  "rosca-scott-bayesian": { tag: "Parcial alongada", why: "parciais-alongadas" },
  "elevacao-pelvica": { tag: "EMG ≠ crescimento", why: "semg" },
  "remada-apoio-peito": { tag: "Estável", why: "estabilidade" },
};
