// Papo do chat sem chave. A lista de situações segue o roteiro de "conversa fiada" de assistentes abertos (saudação,
// despedida, obrigado, quem é você…); as respostas são nossas, no tom do app: seco, humor curto, nunca bajulador.
// `{dado}` é trocado por uma linha com um dado real (o treino de hoje, um músculo pronto); sem dado, a resposta usa a
// variação `plain`. Honestidade: perguntado se é IA, diz que são respostas prontas e contas com os dados do aparelho.

export type SmalltalkId =
  | "oi"
  | "bom-dia"
  | "boa-tarde"
  | "boa-noite"
  | "tudo-bem"
  | "tchau"
  | "obrigado"
  | "quem-e"
  | "e-ia"
  | "e-robo"
  | "idade"
  | "nome"
  | "o-que-faz"
  | "ta-ai"
  | "elogio"
  | "xingamento"
  | "tedio"
  | "piada"
  | "desanimo"
  | "cansado"
  | "preguica"
  | "consegui"
  | "humano"
  | "gosta"
  | "voce-treina"
  | "ok"
  | "desculpa"
  | "teste"
  | "amor"
  | "como-voce-funciona";

export interface Smalltalk {
  id: SmalltalkId;
  /** Expressões regulares sobre o texto normalizado (sem acento, minúsculo). */
  match: RegExp[];
  /** Variações com `{dado}`. */
  replies: string[];
  /** Variações sem dado. */
  plain: string[];
  /** Que dado puxar. */
  data?: "hoje" | "pronto" | "semana" | "treinos";
}

export const SMALLTALK: Smalltalk[] = [
  {
    id: "bom-dia",
    match: [/^(bom dia|bomdia|bd|dia)( (nucleo|aug|core|ai|pra voce|pra vc|meu|amigo))?$/],
    replies: ["Bom dia. {dado}", "Bom dia. {dado} Café primeiro."],
    plain: ["Bom dia. Pergunte o que precisar.", "Bom dia. Pronto quando você estiver."],
    data: "hoje",
  },
  {
    id: "boa-tarde",
    match: [/^(boa tarde|bt)( (nucleo|aug|core|ai))?$/],
    replies: ["Boa tarde. {dado}", "Boa tarde. {dado}"],
    plain: ["Boa tarde. Em que posso ajudar?"],
    data: "hoje",
  },
  {
    id: "boa-noite",
    match: [/^(boa noite|bn|boa madrugada)( (nucleo|aug|core|ai))?$/],
    replies: ["Boa noite. {dado}", "Boa noite. {dado} Dormir bem também é treino."],
    plain: ["Boa noite. Dormir bem também é treino.", "Boa noite."],
    data: "pronto",
  },
  {
    id: "tudo-bem",
    match: [
      /^(oi |ola |e ai |eai |opa )?(tudo bem|td bem|tudo bom|td bom|tranquilo|como vai|como voce esta|como vc ta|como ce ta|beleza|blz|suave|de boa|firmeza)( e (voce|vc|ce|contigo))?$/,
    ],
    replies: ["Tudo em ordem por aqui. {dado}", "Funcionando. {dado}"],
    plain: ["Tudo em ordem por aqui. E o treino?", "Funcionando, sem reclamar. E você?"],
    data: "hoje",
  },
  {
    id: "oi",
    match: [/^(oi+|ola|ola+|oie|e ai|eai|eae|salve|fala|hey|hi|hello|opa|alo|yo|bom|iae|ae|oi (nucleo|aug|core|tudo))$/],
    replies: ["Oi. {dado}", "Fala. {dado}", "Na escuta. {dado}"],
    plain: ["Oi. Pergunte sobre o seu treino, os seus números ou o app.", "Na escuta. O que vai ser?"],
    data: "hoje",
  },
  {
    id: "tchau",
    match: [/^(tchau|tchauzinho|xau|bye|ate mais|ate logo|ate amanha|falou|flw|fui|vou nessa|to indo|valeu e tchau|ate)$/],
    replies: ["Até. {dado}", "Falou. {dado}"],
    plain: ["Até a próxima série.", "Falou. Eu fico aqui."],
    data: "hoje",
  },
  {
    id: "obrigado",
    match: [
      /^(obrigad[oa]|obg|brigad[oa]|valeu|vlw|vlww|thanks|grato|grata|muito obrigad[oa]|valeu mesmo|obrigadao|tmj|show|top|perfeito|otimo|massa|boa)( (nucleo|aug|core|cara|mano))?$/,
    ],
    replies: [],
    plain: ["Disponha.", "Tamo junto. Agora vai treinar.", "De nada. Anota a carga, hein."],
  },
  {
    id: "e-ia",
    match: [
      /\b(voce|vc|ce) (e|eh) (o |a |uma? )?(ia|inteligencia artificial|chatgpt|gpt|chat gpt|gemini|claude|bot|chatbot)\b/,
      /\b(e|eh) (uma? )?(ia|inteligencia artificial)\b/,
      /\busa (ia|chatgpt|gpt|inteligencia artificial)\b/,
    ],
    replies: [],
    plain: [
      "Não. Sou respostas prontas e contas com os dados que estão no seu aparelho, sem internet. Quando não sei, digo que não sei.",
      "Não sou uma IA. São respostas conferidas e contas com o seu histórico, tudo no aparelho. O treinador completo, se você ligar, é outra coisa.",
    ],
  },
  {
    id: "e-robo",
    match: [/\b(voce|vc|ce) (e|eh) (um )?(robo|maquina|programa|computador)\b/],
    replies: [],
    plain: [
      "Sou um programa: respostas prontas e contas com os seus dados. Robô mesmo só o capacete do banner.",
      "Programa, sim. Dos que fazem conta e não inventam.",
    ],
  },
  {
    id: "humano",
    match: [/\b(voce|vc|ce) (e|eh) (gente|humano|pessoa|de verdade|real)\b/, /\btem alguem ai\b/],
    replies: [],
    plain: ["Não, sou um programa. Respostas prontas e contas com os seus dados.", "Gente não. Só contas e respostas conferidas."],
  },
  {
    id: "quem-e",
    match: [/\b(quem (e|eh) (voce|vc|ce)|quem (voce|vc|ce) (e|eh)|o que (e|eh) (voce|vc|ce)|vc e quem|quem fala)\b/],
    replies: [],
    plain: [
      "Sou o núcleo do AUGMENT: leio o seu histórico, faço as contas e respondo com o que está conferido.",
      "O núcleo do app. Seus números, a ciência do Guia e um timer, tudo no aparelho.",
    ],
  },
  {
    id: "nome",
    match: [/\b(qual (e|eh) )?(o )?seu nome\b/, /\bcomo (voce|vc|ce) se chama\b/, /\bvoce tem nome\b/],
    replies: [],
    plain: ["AUG.CORE. Pode chamar de núcleo.", "Núcleo. AUG.CORE no crachá."],
  },
  {
    id: "idade",
    match: [/\bquantos anos (voce|vc|ce) tem\b/, /\bsua idade\b/, /\b(voce|vc) e (novo|velho)\b/],
    replies: [],
    plain: ["Idade de software: a da última atualização.", "Nova o bastante para não ter lesão no ombro."],
  },
  {
    id: "o-que-faz",
    match: [
      /\bo que (voce|vc|ce) (sabe|consegue|pode) fazer\b/,
      /\b(no que|em que) (voce|vc) (pode )?(me )?ajuda\b/,
      /^(me )?ajuda$/,
      /^help$/,
      /\bpra que (voce|vc) serve\b/,
      /^o que (da|posso) (pra )?(perguntar|fazer)/,
    ],
    replies: [],
    plain: [
      'Respondo sobre treino, alimentação e recuperação; faço contas com os seus números ("quantas séries de peito em outubro", "meu supino subiu?"); marco descanso ("descanso de 90 segundos"); calculo anilhas e 1RM; e abro as telas do app.',
    ],
  },
  {
    id: "como-voce-funciona",
    match: [/\bcomo (voce|vc|ce) funciona\b/, /\bde onde (voce|vc) tira\b/, /\b(voce|vc|ce) (usa|precisa de) internet\b/],
    replies: [],
    plain: [
      "Tudo no aparelho: frases-modelo para comandos, contas com o seu histórico e um buscador de respostas conferidas. Nada sai do celular sem você tocar.",
    ],
  },
  {
    id: "ta-ai",
    match: [
      /^(ta ai|tá ai|ta on|ta ligado|ta funcionando|alguem ai|ola\?|oi\?|ei|hello\?|alo\?|responde|me responde|ta me ouvindo|ta vivo)$/,
    ],
    replies: ["Aqui. {dado}"],
    plain: ["Aqui. Pode mandar.", "Ligado."],
    data: "hoje",
  },
  {
    id: "elogio",
    match: [
      /^(voce|vc|ce) (e|eh) (muito )?(bom|boa|legal|incrivel|demais|top|show|inteligente|o melhor|brabo|fera)/,
      /^(gostei|adorei|amei|curti)( (de voce|disso|do app))?$/,
      /\bapp (muito )?(bom|top|show|incrivel)\b/,
    ],
    replies: ["Bom saber. {dado}"],
    plain: ["Obrigado. O mérito é de quem levanta o peso.", "Anotado. Agora bate o recorde."],
    data: "treinos",
  },
  {
    id: "xingamento",
    match: [
      /^(que |seu |sua |vc e |voce e |ce e |isso e |esse app e |app )?(muito )?(burro|burra|idiota|inutil|lixo|merda|porcaria|bosta|imbecil|otario|ridiculo|horrivel)( de app| demais| hein)?$/,
      /\b(voce|vc|ce|app|isso) (e|eh|ta|esta) (um |uma )?(muito )?(burro|burra|idiota|inutil|lixo|uma merda|uma porcaria|ridiculo|horrivel)\b/,
      /\b(nao serve pra nada|vai se ferrar|fdp|pqp)\b/,
    ],
    replies: [],
    plain: [
      "Entendido. Se errei, me diga o que você queria e eu tento de novo, ou leve a pergunta para outro chat.",
      "Pode ser. Fale de outro jeito e eu tento de novo.",
    ],
  },
  {
    id: "tedio",
    match: [/\b(to|estou|tô) (entediad[oa]|de boa|sem nada pra fazer|a toa)\b/, /^(tedio|que tedio|bored)$/],
    replies: ["Tédio tem cura: {dado}"],
    plain: ["Tédio tem cura: 3 séries de qualquer coisa."],
    data: "hoje",
  },
  {
    id: "piada",
    match: [/\b(conta|me conta|fala|manda) (uma )?piada\b/, /^piada$/, /\bme faz rir\b/],
    replies: [],
    plain: [
      "Fui à academia pela primeira vez. Agora vou sempre: passo na frente todo dia.",
      "O que o halter disse para a anilha? Nada. Ficou pesado o clima.",
      "Dia de perna é como imposto: ninguém gosta, mas foge e dá problema depois.",
    ],
  },
  {
    id: "desanimo",
    match: [
      /\b(desanimad[oa]|sem motivacao|desmotivad[oa]|vontade de desistir|quero desistir|nao to evoluindo|nao vejo resultado|to mal)\b/,
    ],
    replies: ["Normal ter semana assim. Os números contam outra história: {dado}"],
    plain: ["Normal ter semana assim. Faça o treino mais curto hoje: aparecer conta mais que o treino perfeito."],
    data: "treinos",
  },
  {
    id: "cansado",
    match: [/^(to|estou|tô) (muito )?(cansad[oa]|morto|morta|exausto|exausta|quebrado|quebrada|destruid[oa])( hoje)?$/],
    replies: ['Anotado. {dado} Se quiser, diga "só tenho 40 minutos" e eu encurto o treino.'],
    plain: ['Anotado. Se quiser, diga "só tenho 40 minutos" e eu encurto o treino.'],
    data: "hoje",
  },
  {
    id: "preguica",
    match: [/\b(preguica|to com preguica|sem vontade de treinar|nao quero treinar|nao to afim)\b/],
    replies: ["Preguiça não pega peso. {dado} Começa pelo aquecimento e decide depois."],
    plain: ["Começa pelo aquecimento e decide depois. Quase sempre o treino sai."],
    data: "hoje",
  },
  {
    id: "consegui",
    match: [
      /^(consegui|bati|deu certo|fiz|foi|terminei|acabei|treino feito|treinei|mandei bem)( hoje| o treino| meu recorde| recorde)?!?$/,
    ],
    replies: ["Boa. {dado}"],
    plain: ["Boa. Registrado é melhor que lembrado: marque no treino."],
    data: "treinos",
  },
  {
    id: "gosta",
    match: [/\b(voce|vc) gosta de\b/, /\bqual (seu|teu) (exercicio|treino) (favorito|preferido)\b/],
    replies: [],
    plain: ["Gosto de série registrada com carga e repetição. Sem isso eu não tenho o que contar.", "Favorito? O que você mais registra."],
  },
  {
    id: "voce-treina",
    match: [/\b(voce|vc) treina\b/, /\b(voce|vc) malha\b/],
    replies: [],
    plain: ["Só a paciência. O peso fica com você.", "Não. Eu conto; você levanta."],
  },
  {
    id: "amor",
    match: [/\b(te amo|eu te amo|amo voce|amo vc|casa comigo|namora comigo)\b/],
    replies: [],
    plain: ["Lisonjeado. Meu compromisso é com o seu histórico.", "Melhor investir esse carinho no dia de perna."],
  },
  {
    id: "desculpa",
    match: [/^(desculpa|desculpe|foi mal|perdao|sorry|mals)$/],
    replies: [],
    plain: ["Sem problema.", "Tranquilo. Pode seguir."],
  },
  {
    id: "teste",
    match: [/^(teste|testando|test|123|1 2 3|testing)$/],
    replies: [],
    plain: ["Funcionando. Pergunte algo de verdade agora.", "Recebido. Sinal ok."],
  },
  {
    id: "ok",
    match: [/^(ok|okay|ta|ta bom|ta certo|certo|entendi|blz|beleza|hm+|ah|aham|uhum|sim|nao|legal|show|entendido|ok obrigado)$/],
    replies: [],
    plain: ["Ok.", "Certo."],
  },
];
