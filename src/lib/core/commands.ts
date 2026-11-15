import { LIB_BY_ID } from "../../data/library";
import { libraryName } from "../../data/library-extended";
import { exOf, programDays, shortName } from "../../data/program";
import type { Session, Settings, Unit } from "../../data/types";
import { addDays, daysBetween, longDate, mondayOf, shortDate } from "../dates";
import { weekFor } from "../mesocycle";
import { barWeightIn, formatWeight, platesForBarbell, setE1rm, toKg, workSets } from "../progression";
import { suspiciousSet } from "../sanity";
import { applyTaste } from "./notes";
import { planAhead } from "../schedule";
import { detectExercise, type AnswerData, type DataCard, type ExerciseRef } from "./data-answers";
import { hasAny } from "./intents";
import { clean, readDuration, readLoad, readNumber, readUnit } from "./readers";
import { prepare, templateSet, type FieldReader } from "./templates";

// AUG.CORE — comandos do chat sem chave. Cada comando = frases-modelo + função + frase de retorno. Regra dura: nada
// grava sem confirmação. O que muda dado volta como `CommandProposal` (a tela mostra Aplicar/Recusar, como as
// propostas das intenções); o que não grava (timer, contas, atalhos) volta como resposta ou `CommandAction`.

export type CommandId =
  | "navegar"
  | "navegar-exercicio"
  | "timer-iniciar"
  | "timer-parar"
  | "timer-somar"
  | "timer-tirar"
  | "treino-comecar"
  | "treino-anotar"
  | "treino-trocar"
  | "corpo-peso"
  | "conta-porcento"
  | "conta-converter"
  | "conta-1rm"
  | "conta-anilhas"
  | "conta-aritmetica"
  | "treino-proxima"
  | "cal-hoje"
  | "cal-hora"
  | "cal-deload"
  | "cal-fim-ciclo"
  | "ajuste-unidade"
  | "som-liga"
  | "som-desliga"
  | "vibra-liga"
  | "vibra-desliga";

/** Comandos que mudam dado salvo: só saem como proposta. */
export const WRITE_COMMANDS: CommandId[] = [
  "treino-anotar",
  "treino-trocar",
  "corpo-peso",
  "ajuste-unidade",
  "som-liga",
  "som-desliga",
  "vibra-liga",
  "vibra-desliga",
];

/** Efeito na hora, sem gravar nada no banco (o timer vive no aparelho, como na tela do treino). */
export type CommandAction = { kind: "timer-start"; seconds: number } | { kind: "timer-stop" } | { kind: "timer-add"; seconds: number };

/** Mudança que só grava se a pessoa tocar em Aplicar. */
export type CommandProposal =
  | { kind: "body-weight"; date: string; weightKg: number; confirmLabel: string }
  | { kind: "settings"; patch: Partial<Settings>; confirmLabel: string }
  | { kind: "log-set"; sessionId: string; exId: string; setId: string; weight: number; reps: number; confirmLabel: string }
  | { kind: "swap"; sessionId: string; exId: string; alt: string; confirmLabel: string };

/** Pedido com campo faltando, esperando a próxima mensagem ("anota uma série" → "Quantas reps e com quanto?"). */
export interface PendingCommand {
  id: CommandId;
  values: Record<string, unknown>;
  /** Hora do pedido (expira em 5 min). */
  at: number;
}

export interface CommandReply {
  id: CommandId;
  text: string;
  route?: string;
  /** Texto do atalho ("Abrir o histórico"). */
  routeLabel?: string;
  action?: CommandAction;
  proposal?: CommandProposal;
  pending?: PendingCommand;
  card?: DataCard;
}

export interface CommandMatch {
  id: CommandId;
  values: Record<string, unknown>;
  /** Casou um modelo sem os campos (pedido incompleto). */
  partial?: boolean;
  /** Duas leituras próximas: a tela pergunta com estes botões em vez de executar. */
  ask?: string[];
}

/** O que o comando precisa saber da tela. */
export interface CommandEnv {
  timerActive?: boolean;
  now?: number;
}

// ---------- Telas ----------

const SCREENS: { words: string[]; route: string; label: string }[] = [
  { words: ["historico", "calendario", "treinos passados", "meus treinos"], route: "/historico", label: "o histórico" },
  {
    words: ["progresso", "evolucao", "graficos", "grafico", "mapa de fadiga", "fadiga", "biometria"],
    route: "/progresso",
    label: "o progresso",
  },
  { words: ["relatorio", "relatorio da semana", "relatorio semanal", "resumo da semana"], route: "/relatorio", label: "o relatório" },
  { words: ["exercicios", "biblioteca", "lista de exercicios"], route: "/exercicios", label: "os exercícios" },
  { words: ["guia", "guia cientifico", "principios", "ciencia"], route: "/guia", label: "o guia" },
  { words: ["ajustes", "configuracoes", "configuracao", "config", "opcoes", "preferencias"], route: "/ajustes", label: "os ajustes" },
  {
    words: ["programas", "programa", "ficha", "fichas", "montador", "meu programa", "minha ficha"],
    route: "/programas",
    label: "os programas",
  },
  { words: ["perfil", "meu perfil"], route: "/perfil", label: "o perfil" },
  { words: ["conta", "conta online", "minha conta", "login", "nuvem", "backup na nuvem"], route: "/online", label: "a conta online" },
  { words: ["amigos", "feed", "ranking", "esquadrao"], route: "/amigos", label: "os amigos" },
  { words: ["privacidade", "politica de privacidade", "termos"], route: "/privacidade", label: "a privacidade" },
  { words: ["treino", "treino de hoje", "hoje", "inicio", "tela inicial", "missao", "home"], route: "/", label: "o treino de hoje" },
];

function readScreen(raw: string) {
  const t = clean(raw)
    .replace(
      /^(o|a|os|as|meu|minha|meus|minhas|tela de|tela do|tela da|aba de|aba do|aba da|tela|aba|pagina de|pagina do|pagina da)\s+/,
      "",
    )
    .replace(/^(o|a|os|as|meu|minha|meus|minhas)\s+/, "")
    .trim();
  return SCREENS.find((s) => s.words.includes(t));
}

/** Tela citada em qualquer ponto da frase ("cade meus graficos"). "hoje" e "treino" sozinhos não contam. */
export function findScreenIn(text: string): (typeof SCREENS)[number] | undefined {
  const t = ` ${clean(text)} `;
  let best: { s: (typeof SCREENS)[number]; len: number } | undefined;
  for (const s of SCREENS)
    for (const w of s.words) {
      if (w === "hoje" || w === "treino" || w === "conta" || w === "programa") continue;
      if (t.includes(` ${w} `) && (!best || w.length > best.len)) best = { s, len: w.length };
    }
  return best?.s;
}

/** Pedaço que é só o nome de um exercício (sem palavra de pergunta: "meu recorde no supino" não é atalho). */
const QUERY_WORDS = [
  "recorde",
  "ultima",
  "ultimo",
  "evolucao",
  "quanto",
  "quantas",
  "quantos",
  "como",
  "qual",
  "historico",
  "pr",
  "1rm",
  "melhor",
  "que",
];
function readExercise(raw: string): ExerciseRef | undefined {
  const t = clean(raw).replace(/^(o|a|os|as|meu|minha|pagina do|pagina da|exercicio)\s+/, "");
  if (!t || hasAny(t, QUERY_WORDS)) return undefined;
  return detectExercise(t);
}

const READERS: Record<string, FieldReader> = {
  tela: readScreen,
  exercicio: readExercise,
  duracao: readDuration,
  numero: readNumber,
  reps: (s) => {
    const n = readNumber(s);
    return n != null && Number.isInteger(n) && n >= 1 && n <= 100 ? n : undefined;
  },
  carga: readLoad,
  unidade: readUnit,
};

const RULES: Record<string, string> = {
  abrir:
    "(abre|abra|abrir|abri|mostra|mostre|mostrar|me mostra|me mostre|vai (pro|pra|pros|pras|para|para o|para a|para os|no|na)|ir (pro|pra|pros|para)|leva (pro|pra|pros)|me leva (pro|pra|pros|para)|entra (no|na|em)|quero ver|ver|ve|exibe|acessa|acessar|volta (pro|pra|para))",
  quanto: "(quanto|qto|qnt|quanto que) (e|eh|da|sao|fica|vale)",
  timer: "(timer|cronometro|descanso|contador|relogio)",
  ligar: "(liga|ligar|ativa|ativar|habilita|habilitar|bota|coloca|poe|quero)",
  desligar: "(desliga|desligar|desativa|desativar|tira|tirar|silencia|muta|mutar|corta|cortar|sem)",
  anotar: "(anota|anotar|anote|registra|registrar|registre|marca|marcar|lanca|lancar|salva|salvar|bota|coloca|poe|fiz|fechei|terminei)",
  x: "(com|x|de|no|na|em|usando)",
};

interface Entry {
  id: { cmd: CommandId; partial?: boolean };
  templates: string[];
}

const DEFS: Entry[] = [
  // Treino primeiro: "anota 8 com 80" não pode virar conta.
  {
    id: { cmd: "treino-anotar" },
    templates: [
      "<anotar> [uma|a] [serie] [de] {reps} [reps|repeticoes|rep|vezes] <x> {carga}",
      "<anotar> [uma|a] [serie] [de|com] {carga} (por|x|vezes) {reps} [reps|repeticoes|rep|vezes]",
      "<anotar> [uma|a] [serie] [de|com] {carga} [kg] (por|x|vezes) {reps} [reps|repeticoes|rep|vezes]",
      "{reps} (reps|repeticoes) <x> {carga}",
    ],
  },
  {
    id: { cmd: "treino-anotar", partial: true },
    templates: [
      "<anotar> [uma|a|mais uma|essa|a minha] serie",
      "<anotar> [uma|a] [serie] [de] {reps} (reps|repeticoes|rep|vezes)",
      "<anotar> [uma|a] serie (com|de) {carga}",
    ],
  },
  {
    id: { cmd: "treino-comecar" },
    templates: [
      "(comeca|comecar|comece|inicia|iniciar|inicie|abre|abrir|bora|vamos|partiu|quero|vou) [comecar|iniciar|fazer] [o|meu] treino [de hoje|do dia|agora]",
      "(bora|vamos|partiu|hora de) (treinar|malhar|treino)",
      "(iniciar|inicia|comecar|comeca) [o] protocolo",
    ],
  },
  {
    id: { cmd: "treino-proxima" },
    templates: [
      "(qual|como) [e|eh|vai ser|fica] [a|minha] proxima serie",
      "[e a] proxima serie",
      "(o que|que) (vem|faco|falta) agora",
      "(quanto|quantas series|quantos exercicios) (falta|faltam) [no treino|pra acabar|para acabar|hoje]",
      "(qual|que) [e] [o] proximo exercicio",
    ],
  },
  {
    id: { cmd: "treino-trocar" },
    templates: [
      "(troca|trocar|troque|substitui|substituir|muda|mudar) [o|a] {exercicio} (hoje|agora|neste treino|nesse treino|so hoje|por hoje|pra hoje)",
      "(troca|trocar|troque|substitui|substituir) [o|a] {exercicio}",
      "(hoje|agora) (troca|trocar|troque|substitui) [o|a] {exercicio}",
    ],
  },
  {
    id: { cmd: "navegar-exercicio" },
    templates: ["<abrir> [o|a] [exercicio|pagina do|pagina da] {exercicio}"],
  },
  {
    id: { cmd: "navegar" },
    templates: ["<abrir> {tela}", "(onde fica|cade|onde esta|onde ta) [o|a|os|as] {tela}"],
  },
  {
    id: { cmd: "timer-parar" },
    templates: [
      "(para|pare|parar|cancela|cancelar|desliga|desligar|zera|zerar|encerra|encerrar|tira|acaba|finaliza|pula|pular) [o|a] <timer>",
      "(chega|acabou|chega de|deu) [de] descanso",
      "<timer> (para|pare|off|cancela)",
    ],
  },
  {
    id: { cmd: "timer-somar" },
    templates: [
      "[bota|poe|coloca|adiciona|aumenta|soma|da] mais {duracao} [no|ao|de] [<timer>]",
      "(adiciona|aumenta|soma|acrescenta|estende) {duracao} [no|ao] [<timer>]",
      "+ {duracao}",
    ],
  },
  {
    id: { cmd: "timer-tirar" },
    templates: ["[tira|diminui|reduz] menos {duracao} [no|do] [<timer>]", "(tira|diminui|reduz|corta) {duracao} [do|no] [<timer>]"],
  },
  {
    id: { cmd: "timer-iniciar" },
    templates: [
      "[(inicia|iniciar|comeca|comecar|liga|ligar|bota|poe|coloca|marca|marcar|aciona|dispara|abre|faz|quero|me da|da)] [um|o|uma] (descanso|timer|cronometro|contador|intervalo|pausa) (de|com|para|por) {duracao}",
      "[(inicia|iniciar|comeca|liga|bota|poe|coloca|marca|aciona|dispara)] [um|o] (descanso|timer|cronometro|contador|intervalo) {duracao}",
      "(descansar|descansa|descanso|descansando|vou descansar|cronometra|marca|conta) {duracao}",
      "[bota|poe|coloca|marca|da|faz|quero] [um|uns] {duracao} de (descanso|timer|intervalo|pausa)",
      "(timer|cronometro) [de] {duracao}",
    ],
  },
  {
    id: { cmd: "timer-iniciar", partial: true },
    templates: [
      "(inicia|iniciar|comeca|liga|bota|poe|coloca|marca|aciona|dispara) [o|um] (timer|cronometro|descanso)",
      "(descanso|timer|cronometro)",
    ],
  },
  {
    id: { cmd: "corpo-peso" },
    templates: [
      "(pesei|me pesei|to pesando|estou pesando|tô pesando|pesando|balanca deu|balanca marcou) [hoje|agora|de manha|essa manha] {carga} [hoje|agora|de manha|essa manha]",
      "(meu peso|peso) [hoje|de hoje|atual] (e|eh|ta|esta|deu|foi|=) {carga} [hoje|agora]",
      "(pesei|me pesei|subi na balanca) [hoje|agora] [e] (deu|marcou|foi|tava|estava) {carga}",
      "<anotar> [o|meu] peso [de hoje|corporal|hoje] [de|em|com|=] {carga}",
      "<anotar> {carga} (de|no|como) [meu] peso [corporal]",
    ],
  },
  {
    id: { cmd: "corpo-peso", partial: true },
    templates: ["(anota|anotar|registra|registrar|salva|salvar) [o|meu] peso [corporal|de hoje]", "(pesei|me pesei) [hoje|agora]"],
  },
  {
    id: { cmd: "conta-1rm" },
    templates: [
      "[qual|quanto] [e|eh|o|meu|da] [o|meu] (1rm|rm|maximo|max|carga maxima|uma repeticao maxima) [estimado] [de|com|pra|para|se eu faco|se fiz|se eu fiz|fazendo|levantando] {carga} (por|x|com|vezes) {reps} [reps|repeticoes|rep|vezes]",
      "{carga} (por|x) {reps} [reps|repeticoes|vezes] (da|e|eh|equivale a|vale) [quanto|qual] [de] (1rm|rm|maximo)",
      "{carga} (por|x) {reps} [reps|repeticoes] (1rm|rm)",
      "[se] [eu] (fiz|faco|fizer|fazendo|levantei|levanto) {carga} (por|x|com) {reps} [reps|repeticoes|vezes] (qual|quanto) [e|eh|seria|fica] [o] [meu] (maximo|1rm|rm|max)",
    ],
  },
  {
    id: { cmd: "conta-anilhas" },
    templates: [
      "[quantas|quais|que] (anilhas|anilha|placas|pesos) [por lado|de cada lado|em cada lado|coloco|ponho|boto|eu coloco|eu ponho|vao] [na barra] (pra|para|com|de|em|no|pro) {carga}",
      "(quanto|o que) (coloco|ponho|boto|eu coloco|eu ponho|vai) [de cada lado|em cada lado|por lado|na barra] (pra|para|com|de) {carga}",
      "(como monto|montar|monta|montagem) {carga} [na barra]",
      "{carga} na barra [olimpica] [fica como|como fica|quanto de cada lado]",
      "como fica {carga} na barra [olimpica]",
      "(anilhas|anilha) {carga}",
    ],
  },
  {
    id: { cmd: "conta-anilhas", partial: true },
    templates: ["(calcula|calcular|calculadora de) [as] anilhas", "anilhas por lado"],
  },
  {
    id: { cmd: "conta-porcento" },
    templates: [
      "[<quanto>] {numero} (%|por cento|porcento|porcentos) (de|do|da) {carga}",
      "(calcula|calcular|faz|me da) {numero} (%|por cento|porcento) (de|do|da) {carga}",
      "{numero} (%|por cento|porcento) (de|do|da) {carga} (da|e|eh|fica|sao) quanto",
    ],
  },
  {
    id: { cmd: "conta-converter" },
    templates: [
      "[<quanto>|converte|converter|transforma|transformar|passa|passar] {carga} (em|para|pra|pro|no|na) {unidade}",
      "quant(os|as) {unidade} (e|eh|sao|da|tem|fica|ficam|tem em) {carga}",
      "{carga} (e|eh|sao|da) quant(os|as) {unidade}",
    ],
  },
  {
    id: { cmd: "conta-aritmetica" },
    templates: ["[<quanto>|calcula|conta] {numero} (mais|menos|vezes|x|dividido por|dividido|sobre|+|-|*|/) {numero_2}"],
  },
  {
    id: { cmd: "cal-hoje" },
    templates: [
      "(que|qual) [o] dia (e|eh|é) hoje",
      "(que|qual) [o] dia [da semana] (e|eh) hoje",
      "hoje (e|eh) que dia [da semana]",
      "(qual|que) [e] [a] data [de hoje|e hoje|hoje]",
      "dia de hoje",
      "data de hoje",
    ],
  },
  {
    id: { cmd: "cal-hora" },
    templates: ["(que|q) (horas|hora) (sao|e|eh)", "(me fala|me diz|diz|fala) [a] hora", "hora (agora|atual)", "que horas"],
  },
  {
    id: { cmd: "cal-deload" },
    templates: [
      "quant(os|as) (dias|semanas) (falta|faltam|tem|ate|pro|pra|para) [para|pra|pro|o|ate o|ate] [o] deload",
      "quando (e|eh|vai ser|sera|comeca|começa|vem|cai) [o|a] [semana de] deload",
      "(falta|faltam) [quanto|quantos dias|quantas semanas|muito] (pro|para o|pra|ate o) deload",
      "[o] deload (e|eh|vai ser|cai) quando",
      "(proximo|proxima semana de) deload",
      "[esta|ta|to|estou] (perto|longe) [do|de|para o] deload",
      "quanto (falta|tempo falta|ainda falta) (pro|para o|pra|ate o) deload",
    ],
  },
  {
    id: { cmd: "cal-fim-ciclo" },
    templates: [
      "quando (acaba|termina|fecha|encerra|vira) [o|esse|meu|este] (ciclo|meso|mesociclo)",
      "(quanto|quantos dias|quantas semanas) (falta|faltam) (pro|para o|pra|ate o) (fim|final) do (ciclo|meso|mesociclo)",
      "quantas semanas faltam [no|do|pro fim do] [ciclo|meso|mesociclo]",
      "(fim|final) do (ciclo|meso|mesociclo) [e|eh] quando",
      "quando (comeca|começa) [o] (proximo|novo) (ciclo|meso|mesociclo)",
      "[o|esse|meu|este] (ciclo|meso|mesociclo) (acaba|termina|fecha) quando",
      "quantas semanas (pro|para o|pra|ate o) (fim|final) do (ciclo|meso|mesociclo)",
    ],
  },
  {
    id: { cmd: "ajuste-unidade" },
    templates: [
      "(muda|mudar|troca|trocar|passa|passar|usa|usar|coloca|bota|deixa|deixar|altera|alterar) [tudo|o app|as cargas|a unidade|os pesos|unidade] (pra|para|em|no|por) {unidade}",
      "(quero|prefiro) (usar|ver|tudo em|em) {unidade}",
      "(quero|prefiro) (usar|ver) [tudo] [em] {unidade}",
      "(unidade|cargas|pesos) em {unidade}",
    ],
  },
  { id: { cmd: "som-liga" }, templates: ["<ligar> [o|esse|esse o] (som|audio|bip|beep|apito)", "(com|quero) som"] },
  {
    id: { cmd: "som-desliga" },
    templates: [
      "<desligar> [o|esse|essa] (som|audio|bip|beep|apito)",
      "(modo silencioso|silencio|silenciar)",
      "(sem|nao quero) (som|barulho|bip)",
    ],
  },
  { id: { cmd: "vibra-liga" }, templates: ["<ligar> [a|essa] (vibracao|vibrar)", "(quero|pode) vibrar", "(quero|pode) que vibre"] },
  {
    id: { cmd: "vibra-desliga" },
    templates: ["<desligar> [a] (vibracao|vibrar)", "(sem|nao quero) (vibracao|vibrar)", "para de vibrar [o celular|o telefone]"],
  },
];

const SET = templateSet(DEFS, RULES);

/** Força o "8x80" e o "90s" a separar número de letra antes dos modelos. */
function spaced(text: string): string {
  return text
    .replace(/(\d)\s*x\s*(\d)/gi, "$1 x $2")
    .replace(/(\d)\s*%/g, "$1 %")
    .replace(/\+\s*(\d)/g, "+ $1");
}

/** Comando no texto, ou null. Pedido incompleto volta com `partial`. */
export function matchCommand(text: string): CommandMatch | null {
  const m = SET.match(spaced(text), READERS);
  if (!m) return null;
  return { id: m.id.cmd, values: m.values, partial: m.id.partial };
}

/** Palavras dos modelos (para corrigir erro de digitação na frase livre). */
export function commandVocabulary(): string[] {
  const words = new Set<string>();
  const add = (src: string) => {
    for (const w of clean(src.replace(/\{[^}]*\}|<[^>]*>/g, " ").replace(/[()[\]|]/g, " ")).split(" ")) if (w.length >= 4) words.add(w);
  };
  for (const d of DEFS) d.templates.forEach(add);
  Object.values(RULES).forEach(add);
  return [...words];
}

// ---------- Respostas ----------

const kgTxt = (v: number) => `${formatWeight(Math.round(v * 100) / 100)} kg`;
const LB = 0.45359237;

function activeSession(d: AnswerData): Session | undefined {
  return d.sessions.find((s) => s.status === "active" && s.date === d.today) ?? d.sessions.find((s) => s.status === "active");
}

function cycleDates(d: AnswerData) {
  const w = weekFor(d.settings.mesoStart, d.today);
  if (w === 0) return null;
  const weekStart = mondayOf(d.today);
  const start = addDays(weekStart, -(w - 1) * 7);
  return { w, start, deload: addDays(start, 42), end: addDays(start, 48) };
}

function when(today: string, date: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  return `em ${n} dias (${longDate(date)})`;
}

function load(v: unknown): { value: number; unit?: Unit } {
  return v as { value: number; unit?: Unit };
}

function ask(id: CommandId, values: Record<string, unknown>, text: string, env: CommandEnv): CommandReply {
  return { id, text, pending: { id, values, at: env.now ?? Date.now() } };
}

/** Próxima série de trabalho do treino aberto (exercício em foco = o primeiro com série por fazer). */
function nextPending(s: Session) {
  for (const e of s.exercises) {
    const set = e.sets.find((x) => x.kind === "work" && !x.done);
    if (set) return { e, set };
  }
  return undefined;
}

/** Maior carga de trabalho já feita nesse exercício, em kg (para a trava contra erro de digitação). */
function maxKgOf(d: AnswerData, exId: string): number | undefined {
  let max: number | undefined;
  for (const s of d.sessions)
    if (s.status === "done")
      for (const e of s.exercises)
        if (e.exId === exId)
          for (const x of workSets(e))
            if (x.weight != null) {
              const kg = toKg(x.weight, e.unit);
              if (max == null || kg > max) max = kg;
            }
  return max;
}

function logSet(d: AnswerData, values: Record<string, unknown>, env: CommandEnv): CommandReply {
  const reps = values.reps as number | undefined;
  let carga = values.carga ? load(values.carga) : undefined;
  // Treino aberto e só as reps ("anota 8"): vale a carga já posta na próxima série (a sugerida ou a digitada).
  const open = activeSession(d);
  const pending = open && nextPending(open);
  let usedSuggested = false;
  if (reps != null && !carga && pending?.set.weight != null) {
    carga = { value: pending.set.weight, unit: pending.e.unit };
    usedSuggested = true;
  }
  if (reps == null && !carga) return ask("treino-anotar", values, "Quantas repetições e com quanto? Por exemplo: **8 com 80**.", env);
  if (reps == null) return ask("treino-anotar", values, `Com ${formatWeight(carga!.value)}: quantas repetições?`, env);
  if (!carga) return ask("treino-anotar", values, `${reps} repetições com quanto de carga?`, env);
  const s = activeSession(d);
  if (!s) {
    return {
      id: "treino-anotar",
      text: "Não há treino em andamento para anotar a série. Comece o treino de hoje e eu anoto por aqui.",
      route: "/",
      routeLabel: "Ir para o treino",
    };
  }
  for (const e of s.exercises) {
    const set = e.sets.find((x) => x.kind === "work" && !x.done);
    if (!set) continue;
    const ex = exOf(e);
    const name = e.alt ?? (ex ? shortName(ex) : e.exId);
    const unit = carga.unit ?? e.unit;
    const weight =
      carga.unit && carga.unit !== e.unit ? Math.round((carga.unit === "lb" ? carga.value * LB : carga.value / LB) * 2) / 2 : carga.value;
    const n = workSets(e).length + 1;
    const odd = suspiciousSet({ weight, reps }, e.unit, maxKgOf(d, e.exId));
    const notes = [
      unit !== e.unit ? ` (convertido de ${formatWeight(carga.value)} ${unit})` : "",
      usedSuggested ? " Usei a carga que já estava na série." : "",
      odd ? ` **Confere:** ${odd}` : "",
    ].join("");
    return {
      id: "treino-anotar",
      text: `Anotar **${reps} × ${formatWeight(weight)} ${e.unit}** em **${name}**, série ${n}?${notes}`,
      route: `/treino/${s.id}`,
      routeLabel: "Abrir o treino",
      proposal: {
        kind: "log-set",
        sessionId: s.id,
        exId: e.exId,
        setId: set.id,
        weight,
        reps,
        confirmLabel: `Anotar ${reps} × ${formatWeight(weight)} ${e.unit} em ${name}`,
      },
    };
  }
  return {
    id: "treino-anotar",
    text: "Todas as séries de trabalho de hoje já estão marcadas. Para uma série a mais, use o treino.",
    route: `/treino/${s.id}`,
    routeLabel: "Abrir o treino",
  };
}

function nextSetReply(d: AnswerData): CommandReply {
  const s = activeSession(d);
  if (!s) return { id: "treino-proxima", text: "Não há treino aberto. Para ver o de hoje: **qual o meu próximo treino?**" };
  const p = nextPending(s);
  if (!p)
    return {
      id: "treino-proxima",
      text: "Todas as séries de trabalho de hoje estão feitas.",
      route: `/treino/${s.id}`,
      routeLabel: "Abrir o treino",
    };
  const ex = exOf(p.e);
  const name = p.e.alt ?? (ex ? shortName(ex) : p.e.exId);
  const n = workSets(p.e).length + 1;
  const left = s.exercises.reduce((k, e) => k + e.sets.filter((x) => x.kind === "work" && !x.done).length, 0);
  const range = ex ? `${ex.reps[0]}–${ex.reps[1]} reps` : "";
  const loadTxt = p.set.weight != null ? `${formatWeight(p.set.weight)} ${p.e.unit}` : "carga livre";
  return {
    id: "treino-proxima",
    text: `Próxima: **${name}**, série ${n}: **${loadTxt}**${range ? `, ${range}` : ""}. Faltam ${left} ${left === 1 ? "série" : "séries"} de trabalho hoje.`,
    route: `/treino/${s.id}`,
    routeLabel: "Abrir o treino",
  };
}

function swap(d: AnswerData, ex: ExerciseRef): CommandReply {
  // O que a pessoa disse que não gosta sai da lista; o equipamento preferido vem primeiro.
  const taste = applyTaste(LIB_BY_ID[ex.libId]?.alternatives ?? [], d.memory?.notes);
  const alts = taste.names;
  const tasteNote = taste.changed ? " (levei em conta o que você me contou)" : "";
  const s = activeSession(d);
  const entry = s?.exercises.find((e) => e.exId === ex.exId || exOf(e)?.lib === ex.libId);
  if (!alts.length) {
    return {
      id: "treino-trocar",
      text: `Não tenho troca cadastrada para **${ex.name}**. Procure pelo músculo em Exercícios.`,
      route: "/exercicios",
      routeLabel: "Abrir os exercícios",
    };
  }
  if (!s || !entry) {
    return {
      id: "treino-trocar",
      text: `Trocas para **${ex.name}**:\n${alts
        .slice(0, 3)
        .map((a) => `- ${a}`)
        .join("\n")}\n${s ? "Esse exercício não está no treino de hoje." : "Quando o treino estiver aberto, eu troco por aqui."}`,
      route: s ? `/treino/${s.id}` : `/exercicios/${ex.libId}`,
      routeLabel: s ? "Abrir o treino" : "Ver o exercício",
    };
  }
  const alt = alts.find((a) => a !== entry.alt) ?? alts[0];
  return {
    id: "treino-trocar",
    text: `Trocar **${ex.name}** por **${alt}** só neste treino?${tasteNote} O programa não muda. Outras opções: ${
      alts
        .filter((a) => a !== alt)
        .slice(0, 2)
        .join(", ") || "nenhuma"
    }.`,
    route: `/treino/${s.id}`,
    routeLabel: "Abrir o treino",
    proposal: { kind: "swap", sessionId: s.id, exId: entry.exId, alt, confirmLabel: `Trocar por ${alt} hoje` },
  };
}

function bodyWeight(d: AnswerData, values: Record<string, unknown>, env: CommandEnv): CommandReply {
  if (!values.carga) return ask("corpo-peso", values, "Quanto deu na balança?", env);
  const c = load(values.carga);
  const kg = c.unit === "lb" ? Math.round(c.value * LB * 10) / 10 : c.value;
  if (kg < 25 || kg > 350) {
    return { id: "corpo-peso", text: `${formatWeight(c.value)} ${c.unit ?? "kg"} não parece peso corporal. Confira e mande de novo.` };
  }
  return {
    id: "corpo-peso",
    text: `Registrar **${formatWeight(kg)} kg** como seu peso de hoje (${shortDate(d.today)})?`,
    route: "/progresso",
    routeLabel: "Abrir a biometria",
    proposal: { kind: "body-weight", date: d.today, weightKg: kg, confirmLabel: `Registrar ${formatWeight(kg)} kg hoje` },
  };
}

function plates(d: AnswerData, values: Record<string, unknown>, env: CommandEnv): CommandReply {
  if (!values.carga) return ask("conta-anilhas", values, "Qual o peso total na barra? Por exemplo: **anilhas pra 87,5**.", env);
  const c = load(values.carga);
  const unit = c.unit ?? "kg";
  const bar = barWeightIn(unit, d.settings.barWeightKg);
  const p = platesForBarbell(c.value, unit, bar);
  if (!p) return { id: "conta-anilhas", text: `${formatWeight(c.value)} ${unit} é menos que a barra (${bar} ${unit}).` };
  return {
    id: "conta-anilhas",
    text: `Para **${formatWeight(c.value)} ${unit}** com a barra de ${bar} ${unit}: **${p}**.`,
  };
}

function e1rmReply(values: Record<string, unknown>): CommandReply {
  const c = load(values.carga);
  const reps = values.reps as number;
  const unit = c.unit ?? "kg";
  const v = setE1rm({ id: "conta", kind: "work", weight: c.value, reps, done: true }, unit, "recorde");
  if (v == null) {
    return {
      id: "conta-1rm",
      text: `Com ${reps} repetições a estimativa do máximo fica imprecisa. O app só estima com até 15.`,
    };
  }
  const shown = unit === "lb" ? `${formatWeight(Math.round(v / LB))} lb` : kgTxt(Math.round(v * 2) / 2);
  return {
    id: "conta-1rm",
    text: `${formatWeight(c.value)} ${unit} × ${reps} dá um máximo estimado de **${shown}** para 1 repetição (fórmula de Epley, a mesma dos recordes do app). É estimativa, não teste.`,
  };
}

function convert(values: Record<string, unknown>): CommandReply {
  const c = load(values.carga);
  const to = values.unidade as Unit;
  const from: Unit = c.unit ?? (to === "kg" ? "lb" : "kg");
  if (from === to)
    return { id: "conta-converter", text: `${formatWeight(c.value)} ${to} já está em ${to === "kg" ? "quilos" : "libras"}.` };
  const v = from === "lb" ? c.value * LB : c.value / LB;
  return {
    id: "conta-converter",
    text: `${formatWeight(c.value)} ${from} = **${formatWeight(Math.round(v * 10) / 10)} ${to}**.`,
  };
}

function percent(values: Record<string, unknown>): CommandReply {
  const p = values.numero as number;
  const c = load(values.carga);
  const v = Math.round(((p * c.value) / 100) * 100) / 100;
  return {
    id: "conta-porcento",
    text: `${formatWeight(p)}% de ${formatWeight(c.value)}${c.unit ? ` ${c.unit}` : ""} = **${formatWeight(v)}${c.unit ? ` ${c.unit}` : ""}**.`,
  };
}

function arithmetic(text: string, values: Record<string, unknown>): CommandReply {
  const a = values.numero as number;
  const b = values.numero_2 as number;
  const t = prepare(spaced(text));
  const op = /\b(menos)\b| - /.test(t) ? "-" : /\b(vezes|x)\b|\*/.test(t) ? "*" : /\b(dividido|sobre)\b|\//.test(t) ? "/" : "+";
  if (op === "/" && b === 0) return { id: "conta-aritmetica", text: "Dividir por zero não dá." };
  const v = op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b;
  const sign = op === "*" ? "×" : op === "/" ? "÷" : op;
  return {
    id: "conta-aritmetica",
    text: `${formatWeight(a)} ${sign} ${formatWeight(b)} = **${formatWeight(Math.round(v * 100) / 100)}**.`,
  };
}

function unitPatch(d: AnswerData, unit: Unit): CommandReply {
  const ids = programDays().flatMap((day) => day.exercises.map((e) => e.id));
  const already = ids.length > 0 && ids.every((id) => (d.settings.units[id] ?? "kg") === unit);
  const name = unit === "kg" ? "quilos" : "libras";
  if (already) return { id: "ajuste-unidade", text: `Todos os exercícios já estão em ${name}.` };
  const units = { ...d.settings.units };
  for (const id of ids) units[id] = unit;
  return {
    id: "ajuste-unidade",
    text: `Mostrar todas as cargas do programa em **${name}** daqui em diante? Os treinos já feitos continuam na unidade em que foram anotados.`,
    route: "/ajustes",
    routeLabel: "Abrir os ajustes",
    proposal: { kind: "settings", patch: { units }, confirmLabel: `Usar ${name} em todos os exercícios` },
  };
}

function toggle(d: AnswerData, id: CommandId): CommandReply {
  const sound = id.startsWith("som");
  const on = id.endsWith("liga") && !id.endsWith("desliga");
  const cur = sound ? d.settings.sound : d.settings.vibrate;
  const what = sound ? "O som do fim do descanso" : "A vibração do fim do descanso";
  const state = on ? (sound ? "ligado" : "ligada") : sound ? "desligado" : "desligada";
  if (cur === on) return { id, text: `${what} já está ${state}.` };
  const verb = on ? "Ligar" : "Desligar";
  return {
    id,
    text: `${verb} ${sound ? "o som" : "a vibração"} do fim do descanso?`,
    proposal: {
      kind: "settings",
      patch: sound ? { sound: on } : { vibrate: on },
      confirmLabel: `${verb} ${sound ? "o som" : "a vibração"}`,
    },
  };
}

function fmtSec(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** Executa o comando: resposta na hora, ação sem gravação, proposta ou pergunta pelo que falta. */
export function runCommand(m: CommandMatch, d: AnswerData, text: string, env: CommandEnv = {}): CommandReply {
  const v = m.values;
  switch (m.id) {
    case "navegar": {
      const s = v.tela as (typeof SCREENS)[number];
      return { id: m.id, text: `Abrindo ${s.label}.`, route: s.route, routeLabel: `Abrir ${s.label}` };
    }
    case "navegar-exercicio": {
      const ex = v.exercicio as ExerciseRef;
      const name = libraryName(ex.libId) ?? ex.name;
      return {
        id: m.id,
        text: `**${name}**: execução, fotos e o seu histórico.`,
        route: `/exercicios/${ex.libId}`,
        routeLabel: `Abrir ${name}`,
      };
    }
    case "timer-iniciar": {
      const s = v.duracao as number | undefined;
      if (s == null) return ask(m.id, v, "Descanso de quanto tempo? Por exemplo: **90 segundos** ou **2 minutos**.", env);
      if (s < 10 || s > 900) return { id: m.id, text: "O descanso vai de 10 segundos a 15 minutos." };
      return { id: m.id, text: `Descanso de **${fmtSec(s)}** começando.`, action: { kind: "timer-start", seconds: s } };
    }
    case "timer-parar":
      return env.timerActive
        ? { id: m.id, text: "Descanso encerrado.", action: { kind: "timer-stop" } }
        : { id: m.id, text: "Não há descanso correndo." };
    case "timer-somar":
    case "timer-tirar": {
      const s = v.duracao as number;
      if (!env.timerActive) return { id: m.id, text: "Não há descanso correndo. Para começar um: **descanso de 90 segundos**." };
      const signed = m.id === "timer-somar" ? s : -s;
      return {
        id: m.id,
        text: `${signed > 0 ? "Mais" : "Menos"} ${fmtSec(s)} no descanso.`,
        action: { kind: "timer-add", seconds: signed },
      };
    }
    case "treino-comecar": {
      const s = activeSession(d);
      if (s) return { id: m.id, text: "Seu treino já está aberto.", route: `/treino/${s.id}`, routeLabel: "Continuar o treino" };
      const next = planAhead(d.sessions, d.today, 7, d.settings.trainingDays)[0];
      const day = next ? programDays().find((x) => x.id === next.dayId) : undefined;
      return {
        id: m.id,
        text: day
          ? `${next.date === d.today ? "Hoje é" : "O próximo da fila é"} **${day.name}**, ${day.exercises.length} exercícios. Toque em Iniciar protocolo para começar.`
          : "Toque em Iniciar protocolo para começar.",
        route: "/",
        routeLabel: "Ir para o treino",
      };
    }
    case "treino-anotar":
      return logSet(d, v, env);
    case "treino-proxima":
      return nextSetReply(d);
    case "treino-trocar":
      return swap(d, v.exercicio as ExerciseRef);
    case "corpo-peso":
      return bodyWeight(d, v, env);
    case "conta-1rm":
      return e1rmReply(v);
    case "conta-anilhas":
      return plates(d, v, env);
    case "conta-converter":
      return convert(v);
    case "conta-porcento":
      return percent(v);
    case "conta-aritmetica":
      return arithmetic(text, v);
    case "cal-hoje": {
      const c = cycleDates(d);
      const next = planAhead(d.sessions, d.today, 1, d.settings.trainingDays)[0];
      const day = next?.date === d.today ? programDays().find((x) => x.id === next.dayId) : undefined;
      return {
        id: m.id,
        text: `Hoje é **${longDate(d.today)}**.${c ? ` Semana ${c.w} de 7 do ciclo.` : ""}${day ? ` Dia de ${day.name}.` : " Sem treino marcado para hoje."}`,
      };
    }
    case "cal-hora": {
      const now = new Date(env.now ?? Date.now());
      return {
        id: m.id,
        text: `Agora são **${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}**, pelo relógio do aparelho.`,
      };
    }
    case "cal-deload": {
      const c = cycleDates(d);
      if (!c) return { id: m.id, text: "Seu programa é fixo: não tem semana de deload automática." };
      if (c.w === 7)
        return {
          id: m.id,
          text: `Você já está no deload (semana 7). O ciclo fecha ${when(d.today, c.end)}.`,
          route: "/relatorio",
          routeLabel: "Abrir o relatório",
        };
      return {
        id: m.id,
        text: `O deload começa **${when(d.today, c.deload)}**. Você está na semana ${c.w} de 7.`,
        card: {
          title: "Protocolo // mesociclo",
          tag: `SEMANA ${c.w}/7`,
          cells: [
            { k: "Deload", v: shortDate(c.deload), s: `em ${daysBetween(d.today, c.deload)} dias` },
            { k: "Fim do ciclo", v: shortDate(c.end), s: "domingo" },
          ],
        },
      };
    }
    case "cal-fim-ciclo": {
      const c = cycleDates(d);
      if (!c) return { id: m.id, text: "Seu programa é fixo: não tem ciclo de 7 semanas." };
      const left = daysBetween(d.today, c.end);
      return {
        id: m.id,
        text: `Este ciclo fecha **${when(d.today, c.end)}**${left > 6 ? ` (faltam ${Math.ceil(left / 7)} semanas)` : ""}. O próximo começa ${shortDate(addDays(c.end, 1))}.`,
        route: "/relatorio",
        routeLabel: "Abrir o relatório",
      };
    }
    case "ajuste-unidade":
      return unitPatch(d, v.unidade as Unit);
    case "som-liga":
    case "som-desliga":
    case "vibra-liga":
    case "vibra-desliga":
      return toggle(d, m.id);
  }
}

/**
 * Resposta a um pedido em aberto ("Quantas repetições e com quanto?" → "8 com 80"). Null se o texto não completa o
 * pedido (aí ele segue pelas outras camadas e o pedido cai).
 */
export function continuePending(text: string, p: PendingCommand, d: AnswerData, env: CommandEnv = {}): CommandReply | null {
  if ((env.now ?? Date.now()) - p.at > 5 * 60_000) return null;
  const t = prepare(spaced(text));
  if (/^(cancela|cancelar|deixa|deixa pra la|esquece|nao|nada|para)$/.test(t)) return { id: p.id, text: "Tudo bem, deixei para lá." };
  const values = { ...p.values };
  if (p.id === "treino-anotar") {
    const both = t.match(/^(.+?) (?:reps |repeticoes |vezes )?(?:com|x|de|no) (.+)$/);
    const rev = t.match(/^(.+?) (?:por|x) (.+?)(?: reps| repeticoes| vezes)?$/);
    const reps = READERS.reps;
    if (both && reps(both[1]) != null && readLoad(both[2])) {
      values.reps = reps(both[1]);
      values.carga = readLoad(both[2]);
    } else if (rev && readLoad(rev[1]) && reps(rev[2]) != null) {
      values.carga = readLoad(rev[1]);
      values.reps = reps(rev[2]);
    } else if (values.reps == null && reps(t.replace(/ (reps|repeticoes|vezes)$/, "")) != null && values.carga) {
      values.reps = reps(t.replace(/ (reps|repeticoes|vezes)$/, ""));
    } else if (!values.carga && readLoad(t.replace(/^com /, ""))) {
      values.carga = readLoad(t.replace(/^com /, ""));
    } else return null;
    return logSet(d, values, env);
  }
  if (p.id === "timer-iniciar") {
    const s = readDuration(t.replace(/^(de|com) /, ""));
    return s == null ? null : runCommand({ id: p.id, values: { duracao: s } }, d, text, env);
  }
  if (p.id === "corpo-peso" || p.id === "conta-anilhas") {
    const c = readLoad(t.replace(/^(deu|foi|pra|para|com|de) /, ""));
    return c ? runCommand({ id: p.id, values: { carga: c } }, d, text, env) : null;
  }
  return null;
}
