import type { EvidenceLevel } from "./science";

// Respostas prontas do treinador sem chave (fase 1 do docs/prompt-chat-local.md). Nada aqui é gerado na hora:
// cada texto foi escrito para um público leigo e leva o nível de evidência honesto. Respostas de alimentação e
// recuperação passam pela revisão do dono antes de publicar (docs/respostas-para-revisar.md).
//
// Regras para escrever:
// - `asks`: 4 a 8 jeitos de perguntar, do jeito que um leigo digita (sem jargão).
// - `keys`: termos e sinônimos que não aparecem nas perguntas.
// - `answer`: 2 a 5 frases curtas, em pt-BR, sem "IA", "modelo" ou jargão. Faixa, nunca dose fechada ou cardápio.
// - `principle`: id em PRINCIPLES (vira "Ler mais" no Guia); o nível vem dele quando `level` não é dado.

export type AnswerTopic = "treino" | "alimentacao" | "recuperacao" | "app" | "iniciante";

export interface Answer {
  id: string;
  topic: AnswerTopic;
  asks: string[];
  keys?: string[];
  answer: string;
  /** Obrigatório (direto ou pelo princípio) em treino, alimentação, recuperação e iniciante. */
  level?: EvidenceLevel;
  principle?: string;
  /** Atalho para uma tela do app (rota do HashRouter, sem o #). */
  route?: string;
  related?: string[];
}

export const ANSWERS: Answer[] = [
  // ---------- Treino ----------
  {
    id: "series-por-semana",
    topic: "treino",
    asks: [
      "quantas séries por músculo na semana",
      "qual o volume ideal de treino",
      "quantas séries devo fazer para crescer",
      "quantas séries de peito por semana",
      "estou fazendo séries demais?",
    ],
    keys: ["volume", "series semanais", "volume semanal"],
    answer:
      "Para ganhar músculo, o que mais conta é o número de séries por músculo na semana. Umas 10 séries semanais já dão bom resultado para a maioria; 10 a 20 é a faixa de quem busca o máximo. Mais que isso ainda ajuda um pouco, mas cansa bem mais. Comece pelo menor e suba se estiver recuperando bem.",
    principle: "volume-faixa",
    related: ["frequencia-musculo", "quantas-reps"],
  },
  {
    id: "quantas-reps",
    topic: "treino",
    asks: [
      "quantas repetições fazer por série",
      "melhor número de repetições para hipertrofia",
      "faço 8 ou 12 repetições?",
      "poucas repetições com muito peso ou muitas com pouco peso",
      "faixa de repetições",
    ],
    keys: ["reps", "carga leve", "carga pesada", "repeticao"],
    answer:
      "Entre 6 e 15 repetições por série funciona muito bem para ganhar músculo. Cargas mais leves, com mais repetições, também funcionam se você chegar perto do seu limite; só são mais desconfortáveis. O que importa é terminar a série sentindo que sobravam poucas repetições, de 1 a 3.",
    principle: "carga-pratica",
    related: ["ate-a-falha", "progressao-carga"],
  },
  {
    id: "ate-a-falha",
    topic: "treino",
    asks: [
      "preciso ir até a falha",
      "tenho que treinar até não aguentar mais?",
      "ir até a falha faz crescer mais",
      "posso parar antes de falhar",
      "falha muscular é necessária",
    ],
    keys: ["falha", "exaustao", "limite"],
    answer:
      "Não precisa. Parar quando sobram 1 ou 2 repetições dá praticamente o mesmo resultado que ir até não aguentar mais, e cansa menos. Ir à falha de vez em quando, em máquinas e exercícios isolados, é seguro e útil. Em exercícios pesados, como agachamento, pare antes de perder a técnica.",
    principle: "rir-hipertrofia",
    related: ["rir", "quantas-reps"],
  },
  {
    id: "rir",
    topic: "treino",
    asks: [
      "o que é RIR",
      "o que significa repetições na reserva",
      "o que é RIR 2",
      "como saber quantas repetições sobraram",
      "o que o app quer dizer com sobra",
    ],
    keys: ["reserva", "sobrando", "sobra"],
    answer:
      'RIR quer dizer "repetições na reserva": quantas repetições você ainda conseguiria fazer quando parou a série. RIR 2 é parar sabendo que faria mais 2. O app pergunta isso no fim do exercício para ajustar o esforço das próximas semanas. Com a prática, o seu chute fica cada vez mais certeiro.',
    principle: "rir-consenso",
    related: ["ate-a-falha"],
  },
  {
    id: "descanso-series",
    topic: "treino",
    asks: [
      "quanto tempo descansar entre as séries",
      "intervalo entre séries",
      "descanso de 1 minuto é pouco?",
      "quantos minutos de pausa entre série",
      "descansar mais faz crescer mais",
    ],
    keys: ["intervalo", "pausa", "timer", "cronometro"],
    answer:
      "Descanse o bastante para repetir um bom número de repetições na série seguinte: cerca de 1,5 a 2 minutos em exercícios isolados e 2 a 3 minutos nos pesados, como agachamento e supino. Descanso curto demais faz você perder repetições, e isso sim atrapalha. O timer do app já sugere o tempo de cada exercício.",
    principle: "descanso-consenso",
    related: ["quantas-reps"],
  },
  {
    id: "frequencia-musculo",
    topic: "treino",
    asks: [
      "quantas vezes por semana treinar cada músculo",
      "treinar perna uma vez por semana é suficiente",
      "melhor treinar o músculo 1 ou 2 vezes na semana",
      "frequência de treino por grupo muscular",
    ],
    keys: ["frequencia", "vezes por semana"],
    answer:
      "Treinar cada músculo 2 vezes por semana é o jeito mais prático de distribuir as séries. Se o total de séries na semana for o mesmo, 1, 2 ou 3 vezes dão resultado parecido. A vantagem de dividir é não precisar fazer séries demais no mesmo dia, quando a qualidade cai.",
    principle: "frequencia",
    related: ["series-por-semana", "melhor-divisao"],
  },
  {
    id: "melhor-divisao",
    topic: "treino",
    asks: [
      "qual a melhor divisão de treino",
      "ABC ou fullbody",
      "treino ABC é melhor que superior e inferior?",
      "qual divisão escolher para 4 dias",
      "melhor programa de treino",
    ],
    keys: ["divisao", "ficha", "split", "fullbody", "abc", "ppl", "upper lower", "corpo inteiro"],
    answer:
      "Com o mesmo número de séries, corpo inteiro, superior/inferior e ABC (empurrar, puxar, pernas) dão resultados iguais. Escolha pela sua agenda: com 3 dias, corpo inteiro; com 4, superior/inferior; com 5 ou 6, ABC. O melhor programa é o que você consegue cumprir.",
    principle: "divisao",
    route: "/programas",
    related: ["frequencia-musculo", "app-trocar-programa"],
  },
  {
    id: "progressao-carga",
    topic: "treino",
    asks: [
      "quando devo aumentar o peso",
      "como saber a hora de subir a carga",
      "como o app decide aumentar a carga",
      "aumento as repetições ou o peso",
      "como progredir no treino",
    ],
    keys: ["progressao", "progressao dupla", "sobrecarga", "evoluir"],
    answer:
      "O app usa a progressão dupla: você fica na mesma carga até fazer o topo da faixa de repetições em todas as séries; aí ele sobe o peso. Se as repetições caírem, ele mantém ou recua um pouco. Aumentar repetições ou carga dá resultado parecido; o importante é melhorar aos poucos.",
    principle: "progressao",
    related: ["app-sugestao-carga", "quantas-reps"],
  },
  {
    id: "maquina-vs-livre",
    topic: "treino",
    asks: [
      "máquina é pior que peso livre",
      "aparelho faz crescer igual a barra?",
      "halter ou máquina, qual é melhor",
      "treinar só em máquina dá resultado",
    ],
    keys: ["livre", "maquina", "smith", "polia"],
    answer:
      "Não é pior. Máquinas e pesos livres fazem crescer igual no adulto comum. Escolha pelo conforto, pelo que sua academia tem e pelo que deixa você aumentar a carga com segurança. Máquinas costumam ser mais fáceis de levar perto do limite sem perder a técnica.",
    principle: "equipamento",
    related: ["ordem-exercicios"],
  },
  {
    id: "ordem-exercicios",
    topic: "treino",
    asks: [
      "a ordem dos exercícios importa",
      "qual exercício fazer primeiro",
      "começo pelo exercício grande ou pelo pequeno?",
      "pré-exaustão funciona",
    ],
    keys: ["ordem", "sequencia", "primeiro", "comecar", "antes", "depois", "pre exaustao"],
    answer:
      "Para ganhar músculo, a ordem quase não muda nada. Ela importa para a força: o exercício que vem primeiro progride melhor. Coloque no começo o músculo ou o exercício que você mais quer melhorar.",
    principle: "ordem",
    related: ["maquina-vs-livre"],
  },
  {
    id: "cardio",
    topic: "treino",
    asks: [
      "cardio atrapalha ganhar massa",
      "posso fazer esteira depois da musculação",
      "aeróbico faz perder músculo?",
      "correr atrapalha a hipertrofia",
      "cardio antes ou depois do treino",
    ],
    keys: ["aerobico", "esteira", "corrida", "bike", "caminhada", "bicicleta"],
    answer:
      "Cardio em quantidade moderada não atrapalha o ganho de músculo e faz bem ao coração. Para atrapalhar ainda menos, prefira caminhada ou bicicleta e deixe para depois da musculação ou outro horário, longe do treino de pernas. Muito cardio intenso todo dia pode, sim, roubar recuperação.",
    level: "evidencia",
    related: ["perder-gordura-ritmo"],
  },
  {
    id: "deload",
    topic: "treino",
    asks: [
      "o que é deload",
      "para que serve a semana leve",
      "semana 7 é mais fraca por quê",
      "preciso de semana de descanso",
      "por que o treino ficou leve essa semana",
    ],
    keys: ["deload", "descarga", "semana leve", "azul"],
    answer:
      "Deload é uma semana mais leve para o corpo se livrar do cansaço acumulado. No app ela é a semana 7: metade das séries, a mesma carga e umas 4 repetições sobrando. Não é perda de tempo: você volta mais disposto para o próximo ciclo. Se o cansaço apertar antes, o app pode antecipar.",
    principle: "deload",
    related: ["app-semanas"],
  },

  // ---------- Alimentação ----------
  {
    id: "proteina-quanto",
    topic: "alimentacao",
    asks: [
      "quanta proteína devo comer por dia",
      "quantas gramas de proteína por quilo",
      "preciso de muita proteína para crescer?",
      "proteína ideal para hipertrofia",
      "como bater a meta de proteína",
    ],
    keys: ["proteina", "gramas por quilo", "g/kg", "frango", "ovo", "carne"],
    answer:
      "Uma faixa segura para quem treina é de 1,6 a 2,2 g de proteína por quilo de peso por dia. Para quem pesa 70 kg, isso dá de 110 a 155 g. Em fase de perder gordura, vale ficar no alto da faixa. Dividir em 3 a 5 refeições ajuda a bater a meta.",
    level: "evidencia",
    principle: "proteina",
    related: ["whey", "perder-gordura-ritmo"],
  },
  {
    id: "creatina",
    topic: "alimentacao",
    asks: [
      "creatina funciona",
      "como tomar creatina",
      "quanto de creatina por dia",
      "creatina precisa de saturação?",
      "qual o melhor horário para tomar creatina",
      "creatina vale a pena",
    ],
    keys: ["creatina", "monohidratada", "suplemento"],
    answer:
      "Creatina é o suplemento com mais estudos para quem treina: ajuda a fazer algumas repetições a mais e, com o tempo, a ganhar um pouco mais de força e músculo. O uso comum é de 3 a 5 g por dia, todo dia, em qualquer horário. Não precisa de fase de saturação. Ela puxa um pouco de água para dentro do músculo, o que é normal.",
    level: "evidencia",
    related: ["creatina-rim", "whey"],
  },
  {
    id: "creatina-rim",
    topic: "alimentacao",
    asks: [
      "creatina faz mal para os rins",
      "creatina estraga o rim?",
      "creatina é perigosa",
      "creatina faz cair cabelo",
      "creatina aumenta a creatinina no exame",
    ],
    keys: ["rim", "rins", "creatinina", "calvicie", "cabelo", "efeito colateral"],
    answer:
      "Em pessoas saudáveis, nas quantidades comuns (3 a 5 g por dia), os estudos não mostram dano aos rins nem queda de cabelo. A creatina pode subir a creatinina no exame de sangue sem que isso seja problema no rim; avise quem pediu o exame. Quem já tem doença nos rins deve falar com o médico antes.",
    level: "evidencia",
    related: ["creatina"],
  },
  {
    id: "ganhar-massa-comer",
    topic: "alimentacao",
    asks: [
      "quanto comer para ganhar massa",
      "preciso comer mais para crescer?",
      "como fazer bulking",
      "quanto de peso ganhar por semana",
      "estou engordando rápido demais no bulking",
    ],
    keys: ["superavit", "bulking", "engordar", "calorias", "ganho de peso"],
    answer:
      "Para ganhar músculo com pouca gordura, coma um pouco acima do que você gasta: o bastante para o peso subir uns 0,2% a 0,5% por semana (cerca de 0,2 a 0,4 kg para quem pesa 80 kg). Se subir mais rápido, vem mais gordura do que músculo. Pese-se algumas vezes por semana e olhe a média, não um dia só.",
    level: "consenso",
    route: "/progresso",
    related: ["proteina-quanto", "perder-gordura-ritmo"],
  },
  {
    id: "perder-gordura-ritmo",
    topic: "alimentacao",
    asks: [
      "quanto peso perder por semana",
      "como secar sem perder músculo",
      "qual o ritmo certo para emagrecer",
      "perdi muito peso rápido, tem problema?",
      "como fazer cutting",
    ],
    keys: ["deficit", "cutting", "emagrecer", "secar", "dieta", "manter massa", "mantendo"],
    answer:
      "Para perder gordura sem perder músculo, mire em cerca de 0,5% a 0,7% do peso por semana (uns 0,4 a 0,6 kg para quem pesa 80 kg). Mais rápido que isso costuma custar músculo. Mantenha o treino pesado e a proteína alta enquanto perde peso, e olhe a média da semana, não a balança de um dia.",
    principle: "ritmo-perda",
    route: "/progresso",
    related: ["proteina-quanto", "cardio"],
  },
  {
    id: "antes-do-treino",
    topic: "alimentacao",
    asks: [
      "o que comer antes do treino",
      "posso treinar em jejum",
      "qual a melhor refeição antes de treinar",
      "quanto tempo antes do treino comer",
      "treinar de estômago vazio",
    ],
    keys: ["jejum", "refeicao", "carboidrato", "estomago"],
    answer:
      "Uma refeição normal de 1 a 3 horas antes, com carboidrato e alguma proteína (arroz e frango, pão com ovo, iogurte com fruta), funciona bem. Se for treinar logo cedo, algo leve como uma fruta ou café com leite basta. Treinar em jejum não faz perder mais gordura no fim do dia; se você se sente bem assim, tudo certo.",
    level: "consenso",
    related: ["depois-do-treino", "cafeina"],
  },
  {
    id: "depois-do-treino",
    topic: "alimentacao",
    asks: [
      "janela anabólica existe",
      "preciso comer logo depois do treino",
      "o que comer no pós treino",
      "tomar shake assim que acabar o treino",
    ],
    keys: ["janela", "pos treino", "anabolica"],
    answer:
      "Não existe uma janela de 30 minutos que se fecha. O que conta é comer proteína suficiente ao longo do dia. Uma refeição com proteína nas horas seguintes ao treino é uma boa prática, mas não precisa correr para o shake.",
    level: "evidencia",
    related: ["proteina-quanto", "antes-do-treino"],
  },
  {
    id: "whey",
    topic: "alimentacao",
    asks: ["whey é necessário", "preciso tomar whey para crescer", "whey protein vale a pena", "suplemento de proteína é obrigatório?"],
    keys: ["whey", "shake", "proteina em po", "suplemento"],
    answer:
      "Whey é comida em pó: uma forma prática de bater a meta de proteína. Se você já come proteína suficiente com carne, ovo, leite, feijão e afins, ele não muda nada. Vale pelo preço e pela praticidade, não por ter efeito especial.",
    level: "consenso",
    related: ["proteina-quanto", "creatina"],
  },
  {
    id: "cafeina",
    topic: "alimentacao",
    asks: ["café antes do treino ajuda", "pré-treino funciona", "cafeína melhora o treino?", "tomar café para treinar"],
    keys: ["cafeina", "cafe", "pre treino", "energetico"],
    answer:
      "A cafeína melhora um pouco a força e a disposição no treino. Para a maioria, 1 ou 2 xícaras de café cerca de 30 a 60 minutos antes já bastam. Evite nas 6 a 8 horas antes de dormir: sono ruim tira mais do que a cafeína dá. Quem tem problema de coração ou de pressão deve falar com o médico.",
    level: "evidencia",
    related: ["antes-do-treino", "sono"],
  },
  {
    id: "alcool",
    topic: "alimentacao",
    asks: [
      "bebida alcoólica atrapalha o treino",
      "cerveja no fim de semana estraga o resultado?",
      "posso beber e ganhar massa",
      "álcool atrapalha a hipertrofia",
    ],
    keys: ["alcool", "cerveja", "bebida", "vinho", "balada"],
    answer:
      "Beber pouco, de vez em quando, atrapalha pouco. Muita bebida de uma vez reduz a recuperação do músculo, piora o sono e soma calorias rápido. Se for beber, evite logo depois do treino e intercale com água.",
    level: "consenso",
    related: ["sono"],
  },

  // ---------- Recuperação ----------
  {
    id: "sono",
    topic: "recuperacao",
    asks: [
      "sono influencia no ganho de massa",
      "quantas horas dormir para crescer",
      "dormir pouco atrapalha o treino?",
      "durmo 5 horas, tem problema",
    ],
    keys: ["sono", "dormir", "insonia", "cansaco"],
    answer:
      "O sono faz parte do treino. Dormir pouco atrapalha a força e a recuperação e, em dieta, faz perder mais músculo e menos gordura. Tente de 7 a 9 horas por noite. Se suas cargas estão caindo sem motivo, o sono é o primeiro suspeito.",
    principle: "sono",
    related: ["recuperacao-tempo", "cafeina"],
  },
  {
    id: "dor-tardia",
    topic: "recuperacao",
    asks: [
      "é normal ficar dolorido no dia seguinte",
      "posso treinar com o músculo dolorido",
      "se não doer não cresceu?",
      "dor muscular depois do treino",
      "estou todo quebrado do treino de ontem",
    ],
    keys: ["dolorido", "dor tardia", "quebrado", "moido", "sinal", "normal"],
    answer:
      "A dor que aparece 1 ou 2 dias depois do treino é normal, principalmente no começo ou depois de um exercício novo. Ela diminui com as semanas e não mede quanto você cresceu. Dá para treinar com dor leve; se estiver muito dolorido, treine outro músculo e dê mais um dia para aquele.",
    level: "consenso",
    related: ["recuperacao-tempo"],
  },
  {
    id: "recuperacao-tempo",
    topic: "recuperacao",
    asks: [
      "quanto tempo o músculo leva para recuperar",
      "posso treinar o mesmo músculo dois dias seguidos",
      "quantas horas de descanso entre treinos do mesmo músculo",
      "como saber se o músculo já recuperou",
    ],
    keys: ["recuperacao", "recuperar", "fadiga", "pronto", "48 horas", "demora", "seguidos"],
    answer:
      "Um músculo costuma precisar de 48 a 72 horas para se recuperar de um treino puxado. Por isso a maioria dos programas repete o mesmo músculo a cada 2 ou 3 dias. O mapa de fadiga, em Progresso, mostra o que já está pronto.",
    level: "consenso",
    route: "/progresso",
    related: ["dor-tardia", "sono"],
  },
  {
    id: "alongamento",
    topic: "recuperacao",
    asks: [
      "preciso alongar antes do treino",
      "alongamento atrapalha a força?",
      "como aquecer antes de treinar",
      "alongar depois do treino ajuda a recuperar",
    ],
    keys: ["alongamento", "aquecimento", "aquecer", "flexibilidade"],
    answer:
      "Não é obrigatório. O melhor aquecimento é fazer 1 ou 2 séries leves do próprio exercício antes das séries de trabalho; o app já mostra essas séries. Alongamento parado e longo logo antes pode tirar um pouco de força. Se você gosta de alongar, deixe para o fim ou para outro horário.",
    level: "consenso",
    related: ["dor-tardia"],
  },

  // ---------- Uso do app ----------
  {
    id: "app-sugestao-carga",
    topic: "app",
    asks: [
      "de onde vem a carga sugerida",
      "o que é o número cinza na série",
      "por que o app sugeriu esse peso",
      "preciso seguir a carga que o app mostra?",
    ],
    keys: ["sugestao", "cinza", "sugerida", "placeholder"],
    answer:
      'O número em cinza na próxima série é a carga que o app sugere, calculada a partir do seu último treino nesse exercício. Se você marcar a série sem digitar, ele grava a sugestão. Se fez diferente, digite o que fez: é isso que guia a próxima sugestão. Para ver o motivo, toque em "Por que essa carga?" no cartão do exercício.',
    related: ["progressao-carga"],
  },
  {
    id: "app-semanas",
    topic: "app",
    asks: [
      "o que muda em cada semana do programa",
      "como funciona o mesociclo",
      "o que acontece na semana 1",
      "o que acontece na semana 4",
      "quantas semanas tem o ciclo",
    ],
    keys: ["mesociclo", "ciclo", "semana 1", "semana 7", "fase"],
    answer:
      "O programa anda em ciclos de 7 semanas. Na 1ª você pega leve para se acostumar; na 2ª e na 3ª o esforço sobe; da 4ª à 6ª alguns exercícios ganham uma série a mais; a 7ª é a semana leve, com metade das séries. Depois começa um ciclo novo. Programas fixos não seguem esse ciclo.",
    route: "/relatorio",
    related: ["deload"],
  },
  {
    id: "app-backup",
    topic: "app",
    asks: [
      "como faço backup dos meus treinos",
      "vou trocar de celular, perco tudo?",
      "como salvar meus dados",
      "onde ficam guardados meus treinos",
    ],
    keys: ["backup", "exportar", "celular novo", "restaurar", "dados", "passar", "perder dados"],
    answer:
      "Seus dados ficam no próprio celular. Em Ajustes, na parte de Backup, você exporta um arquivo para guardar ou levar para outro aparelho. Com a conta online, que é opcional e grátis, o backup sobe sozinho.",
    route: "/ajustes",
    related: ["app-trocar-programa"],
  },
  {
    id: "app-trocar-programa",
    topic: "app",
    asks: [
      "como mudo meu programa de treino",
      "quero trocar de ficha",
      "como montar meu próprio treino",
      "trocar de programa apaga o histórico?",
    ],
    keys: ["programa", "ficha", "modelo", "montar"],
    answer:
      "Em Programas você escolhe um modelo pronto ou monta o seu, com os dias e exercícios que quiser. Trocar de programa não apaga seu histórico: os treinos antigos continuam guardados do jeito que foram feitos.",
    route: "/programas",
    related: ["melhor-divisao"],
  },

  // ---------- Iniciante ----------
  {
    id: "resultado-tempo",
    topic: "iniciante",
    asks: [
      "quanto tempo para ver resultado",
      "em quantos meses começo a ver o músculo",
      "treino há um mês e não mudou nada",
      "quando vou notar diferença no corpo",
    ],
    keys: ["resultado", "meses", "diferenca", "espelho", "ver", "vejo", "notar", "mudar"],
    answer:
      "A força costuma subir já nas primeiras semanas, porque o corpo aprende o movimento. Mudança visível de músculo leva uns 2 a 3 meses de treino constante. Fotos e medidas a cada 4 semanas mostram melhor que o espelho de todo dia.",
    level: "evidencia",
    route: "/progresso",
    related: ["series-por-semana"],
  },
  {
    id: "treinar-todo-dia",
    topic: "iniciante",
    asks: [
      "posso treinar todo dia",
      "treinar 7 dias por semana faz mal?",
      "quantos dias por semana devo treinar",
      "preciso de dia de descanso",
    ],
    keys: ["todo dia", "dias por semana", "folga"],
    answer:
      "Pode treinar em dias seguidos, desde que não seja o mesmo músculo pesado todo dia. Os programas de 5 ou 6 dias alternam os músculos para cada um descansar. Para a maioria, 3 a 5 treinos por semana já dão ótimo resultado, e ter dias de folga ajuda a manter a rotina.",
    level: "consenso",
    related: ["frequencia-musculo", "recuperacao-tempo"],
  },
  {
    id: "mulher-treino",
    topic: "iniciante",
    asks: ["mulher deve treinar diferente", "vou ficar musculosa demais?", "treino feminino é mais leve", "mulher pode pegar peso pesado"],
    keys: ["mulher", "feminino", "musculosa"],
    answer:
      'Não precisa treinar diferente: mulheres ganham músculo na mesma proporção que homens, com as mesmas regras de séries, esforço e carga. Ficar "grande demais" sem querer não acontece; ganhar músculo é lento e leva anos de esforço. Treinar pesado deixa o corpo mais firme e forte.',
    principle: "sexos-hipertrofia",
    related: ["series-por-semana"],
  },
  // ---------- Treino: exercícios e técnica ----------
  {
    id: "exercicios-peito",
    topic: "treino",
    asks: [
      "qual o melhor exercício para o peitoral",
      "supino reto ou inclinado",
      "o que fazer para crescer o peito",
      "exercícios bons de peitoral",
    ],
    keys: ["peitoral", "peito"],
    answer:
      "Um supino (reto ou inclinado, com barra, halteres ou máquina) mais um crucifixo, no cabo ou na máquina, cobrem o peito muito bem. O inclinado puxa um pouco mais a parte de cima. Mais importante que o exercício é somar umas 10 a 20 séries por semana e ir aumentando a carga.",
    level: "consenso",
    principle: "equipamento",
    route: "/exercicios",
    related: ["series-por-semana", "maquina-vs-livre"],
  },
  {
    id: "exercicios-costas",
    topic: "treino",
    asks: ["melhor exercício para as costas", "como deixar as costas largas", "puxada ou remada", "exercícios de dorsal"],
    keys: ["costas", "dorsal", "puxada", "remada", "barra fixa", "largura"],
    answer:
      "Junte um exercício de puxar de cima para baixo (puxada ou barra fixa) com um de puxar para trás (remada). A puxada pega mais a largura; a remada, a espessura do meio das costas. Remada com apoio no peito tira a lombar da conta e deixa você focar nas costas.",
    level: "consenso",
    route: "/exercicios",
    related: ["series-por-semana"],
  },
  {
    id: "exercicios-perna",
    topic: "treino",
    asks: ["melhor exercício de perna", "agachamento ou leg press", "treino de coxa", "o que fazer no dia de perna"],
    keys: ["perna", "coxa", "quadriceps", "agachamento", "leg press", "extensora", "flexora"],
    answer:
      "Um agachamento, hack ou leg press para a coxa toda, mais a cadeira extensora para a frente da coxa e uma flexora (de preferência sentada) para a parte de trás. Um movimento de quadril, como o terra romeno, completa. Desça fundo no que for confortável: amplitude grande rende mais.",
    principle: "reto-femoral",
    route: "/exercicios",
    related: ["leg-press-quadriceps", "agachamento-joelho"],
  },
  {
    id: "exercicios-braco",
    topic: "treino",
    asks: ["como crescer os braços", "melhor exercício de bíceps", "melhor exercício de tríceps", "braço fino o que fazer"],
    keys: ["braco", "biceps", "triceps", "rosca", "testa"],
    answer:
      "O tríceps é a maior parte do braço: inclua um exercício com o braço acima da cabeça (tríceps francês ou no cabo), que estica a cabeça longa e rende mais. Para o bíceps, uma rosca com o braço atrás do corpo (rosca inclinada ou no cabo) e uma rosca martelo. Os supinos e as remadas já trabalham os braços também.",
    principle: "biarticulares",
    route: "/exercicios",
    related: ["series-por-semana"],
  },
  {
    id: "exercicios-ombro",
    topic: "treino",
    asks: ["como ter ombros largos", "melhor exercício de ombro", "elevação lateral funciona", "desenvolvimento ou elevação lateral"],
    keys: ["ombro", "deltoide", "elevacao lateral", "desenvolvimento"],
    answer:
      "Para o ombro parecer mais largo, o que conta é a parte lateral: elevação lateral, com halter, cabo ou máquina, várias séries por semana. O desenvolvimento ajuda na frente do ombro, que os supinos já trabalham bastante. Para a parte de trás, crucifixo inverso ou face pull.",
    level: "consenso",
    route: "/exercicios",
    related: ["series-por-semana"],
  },
  {
    id: "exercicios-gluteo",
    topic: "treino",
    asks: ["melhor exercício para glúteo", "como aumentar o bumbum", "treino de glúteo", "exercícios para glúteos"],
    keys: ["gluteo", "bumbum", "quadril", "elevacao pelvica", "afundo", "bulgaro"],
    answer:
      "Agachamento profundo, afundo ou búlgaro, terra romeno e elevação pélvica trabalham bem o glúteo. Descer fundo e fazer as séries perto do limite pesam mais que a escolha do exercício. Os programas com ênfase em glúteo, em Programas, já trazem essa combinação.",
    principle: "semg",
    route: "/programas",
    related: ["hip-thrust", "exercicios-perna"],
  },
  {
    id: "panturrilha",
    topic: "treino",
    asks: ["como crescer a panturrilha", "panturrilha é genética?", "panturrilha em pé ou sentado", "exercício de batata da perna"],
    keys: ["panturrilha", "batata da perna", "gemeos"],
    answer:
      "A panturrilha cresce como qualquer músculo, só que costuma ser pouco treinada. Prefira a panturrilha em pé, com o joelho esticado, descendo bem até alongar e segurando um instante embaixo. Faça várias séries por semana, perto do limite, e com o tempo ela responde. A genética muda o formato, não impede o ganho.",
    principle: "biarticulares",
    related: ["genetica"],
  },
  {
    id: "gordura-localizada",
    topic: "treino",
    asks: [
      "fazer abdominal perde a barriga",
      "dá para perder gordura só da barriga",
      "exercício para queimar gordura localizada",
      "como tirar a pochete",
    ],
    keys: ["gordura localizada", "barriga", "pochete", "flancos"],
    answer:
      "Não dá para escolher de onde sai a gordura: exercitar um lugar não queima a gordura em cima dele. A barriga diminui quando o corpo todo perde gordura, com a alimentação um pouco abaixo do que você gasta. O abdominal deixa o músculo mais forte e aparece quando a gordura baixar.",
    level: "evidencia",
    related: ["perder-gordura-ritmo", "abdomen-tanquinho"],
  },
  {
    id: "abdomen-tanquinho",
    topic: "treino",
    asks: ["como ter o abdômen definido", "treino de abdominal", "quantas vezes treinar abdômen", "preciso treinar abdômen todo dia?"],
    keys: ["abdomen", "abdominal", "tanquinho", "prancha", "core"],
    answer:
      "O abdômen é um músculo como os outros: 2 ou 3 vezes por semana, com carga e perto do limite, funciona melhor que centenas de repetições todo dia. Abdominal na polia ou na máquina deixa aumentar a carga. Para ele aparecer, a gordura da barriga precisa estar baixa.",
    level: "consenso",
    related: ["gordura-localizada"],
  },
  {
    id: "duracao-treino",
    topic: "treino",
    asks: ["quanto tempo deve durar o treino", "treino de 2 horas é demais?", "treino curto funciona", "só tenho meia hora para treinar"],
    keys: ["duracao", "minutos", "horas", "tempo de treino", "rapido"],
    answer:
      'Um treino de 45 a 75 minutos é o comum e funciona bem. O que importa é o número de séries boas, não o relógio: descanso suficiente entre séries alonga o treino e vale a pena. Com pouco tempo, superséries e menos exercícios encurtam sem perder o resultado. Diga "só tenho 40 min" e eu proponho um corte para hoje.',
    level: "consenso",
    principle: "sistemas-avancados",
    related: ["superserie", "exercicios-por-treino"],
  },
  {
    id: "exercicios-por-treino",
    topic: "treino",
    asks: [
      "quantos exercícios fazer em cada treino",
      "muitos exercícios no mesmo dia é bom?",
      "quantos exercícios por grupo muscular",
      "treino com 10 exercícios é demais",
    ],
    keys: ["exercicios por treino", "quantidade de exercicios"],
    answer:
      "De 4 a 8 exercícios por treino é o comum. Para cada músculo, 1 ou 2 exercícios por treino bastam; mais que isso costuma só repetir o mesmo trabalho. Conte as séries da semana, que é o que faz diferença.",
    level: "campo",
    principle: "teto-sessao",
    related: ["series-por-exercicio", "series-por-semana"],
  },
  {
    id: "series-por-exercicio",
    topic: "treino",
    asks: [
      "quantas séries fazer em cada exercício",
      "3 ou 4 séries por exercício",
      "fazer 5 séries é melhor?",
      "muitas séries no mesmo exercício",
    ],
    keys: ["series por exercicio", "3 series", "4 series"],
    answer:
      "De 2 a 4 séries de trabalho por exercício é o padrão. Passando disso, as últimas séries rendem menos e cansam mais; é melhor dividir entre dois exercícios ou dois dias. O app usa no máximo 4 séries por exercício.",
    level: "campo",
    principle: "teto-sessao",
    related: ["series-por-semana", "exercicios-por-treino"],
  },
  {
    id: "tecnicas-avancadas",
    topic: "treino",
    asks: ["drop-set dá mais resultado", "rest-pause funciona", "técnicas avançadas de treino", "o que é drop set"],
    keys: ["drop", "dropset", "rest pause", "intensificador", "myo reps", "cluster"],
    answer:
      "Drop-set (baixar o peso e continuar sem descanso), rest-pause e parecidos dão o mesmo resultado que séries normais com o mesmo esforço. A vantagem é economizar tempo; o custo é mais cansaço. O app só sugere essas técnicas na última série dos isolados, a partir da semana 3.",
    principle: "sistemas-avancados",
    related: ["superserie", "duracao-treino"],
  },
  {
    id: "superserie",
    topic: "treino",
    asks: ["o que é superset", "superset funciona", "fazer dois exercícios seguidos sem descanso", "bi-set vale a pena"],
    keys: ["superset", "superserie", "biset", "conjugado"],
    answer:
      "Superset é fazer dois exercícios em seguida, sem descanso entre eles, e só então descansar. Com músculos diferentes (peito e costas, bíceps e tríceps) economiza tempo sem perder rendimento. Com o mesmo músculo, cansa mais e você faz menos repetições.",
    principle: "sistemas-avancados",
    related: ["app-superserie", "duracao-treino"],
  },
  {
    id: "cadencia",
    topic: "treino",
    asks: [
      "qual a velocidade certa da repetição",
      "fazer a descida bem lenta",
      "repetição rápida ou devagar",
      "quantos segundos por repetição",
    ],
    keys: ["cadencia", "velocidade", "lento", "excentrica", "devagar", "segundos"],
    answer:
      "Controle a descida (uns 2 a 3 segundos) e suba firme. Repetições entre meio segundo e uns 8 segundos dão resultado parecido; super lentas, de 10 segundos ou mais, rendem menos. Não precisa contar segundo: só não deixe o peso cair.",
    principle: "cadencia",
    related: ["amplitude"],
  },
  {
    id: "amplitude",
    topic: "treino",
    asks: ["preciso descer o movimento todo", "repetição parcial funciona", "amplitude completa é melhor?", "fazer meio movimento"],
    keys: ["amplitude", "parcial", "parciais", "alongado", "movimento completo"],
    answer:
      "Use a maior amplitude que for confortável, principalmente na parte em que o músculo está esticado: é ali que mais rende. Parciais só na parte esticada funcionam tão bem quanto o movimento completo. Já o meio movimento na parte de cima, onde é fácil, rende menos.",
    principle: "parciais-alongadas",
    related: ["cadencia"],
  },
  {
    id: "agachamento-joelho",
    topic: "treino",
    asks: [
      "agachamento faz mal para o joelho",
      "joelho pode passar da ponta do pé?",
      "agachar fundo é perigoso",
      "agachamento profundo machuca",
    ],
    keys: ["joelho", "agachar", "agachamento", "ponta do pe"],
    answer:
      "Em quem não tem lesão, agachar com boa técnica e carga que você controla não faz mal ao joelho; fortalece. O joelho passar da ponta do pé é natural em muita gente. Desça até onde mantém a coluna firme e sem dor. Se doer na articulação, pare e procure avaliação.",
    level: "consenso",
    related: ["dor-articulacao", "exercicios-perna"],
  },
  {
    id: "terra-coluna",
    topic: "treino",
    asks: ["levantamento terra é perigoso", "terra faz mal para a coluna", "stiff machuca a lombar", "como não machucar a lombar"],
    keys: ["lombar", "coluna", "terra", "stiff", "costas"],
    answer:
      "Feito com técnica e carga que você controla, o terra é seguro e fortalece a lombar. O risco aumenta quando a coluna arredonda com carga pesada ou quando se insiste cansado demais. Comece leve, mantenha a barra perto do corpo e pare a série quando a postura começar a ceder.",
    level: "consenso",
    related: ["dor-articulacao"],
  },
  {
    id: "treino-em-casa",
    topic: "treino",
    asks: ["dá para ganhar massa treinando em casa", "treino em casa funciona", "só tenho halteres em casa", "sem academia dá resultado"],
    keys: ["casa", "sem academia", "elastico", "home"],
    answer:
      "Dá. Peso leve também faz crescer, desde que você chegue perto do limite em cada série. Com halteres ajustáveis, elástico e o próprio corpo dá para montar um bom treino. Quando ficar fácil demais, aumente as repetições, deixe a descida mais lenta ou passe para versões com uma perna ou um braço só.",
    principle: "carga-faixa",
    related: ["peso-corporal"],
  },
  {
    id: "peso-corporal",
    topic: "treino",
    asks: ["flexão de braço faz crescer", "calistenia dá massa", "treinar só com o peso do corpo", "barra fixa e paralela funcionam"],
    keys: ["calistenia", "flexao", "barra fixa", "paralela", "peso do corpo"],
    answer:
      "Funciona, desde que as séries cheguem perto do limite. Flexão, barra fixa, paralela e agachamento búlgaro rendem bem. O desafio é progredir: quando passar de umas 20 a 30 repetições fáceis, use variações mais difíceis ou acrescente peso numa mochila.",
    principle: "carga-faixa",
    related: ["treino-em-casa"],
  },
  {
    id: "forca-vs-hipertrofia",
    topic: "treino",
    asks: [
      "qual a diferença entre treino de força e de hipertrofia",
      "quero ficar mais forte, não maior",
      "treinar pesado com poucas repetições",
      "como aumentar minha força",
    ],
    keys: ["forca", "1rm", "powerlifting", "pesado"],
    answer:
      "Para crescer, qualquer faixa de 6 a 30 repetições funciona perto do limite. Para ficar mais forte no peso máximo, cargas pesadas (umas 1 a 6 repetições) e treinar o próprio movimento fazem diferença. Na prática, os dois andam juntos: quem cresce tende a ficar mais forte.",
    principle: "carga-faixa",
    related: ["quantas-reps"],
  },
  {
    id: "mudar-treino",
    topic: "treino",
    asks: [
      "preciso mudar o treino sempre",
      "músculo se acostuma com o treino?",
      "de quanto em quanto tempo trocar a ficha",
      "confusão muscular funciona",
    ],
    keys: ["mudar", "variar", "acostumar", "confusao muscular", "trocar ficha", "todo mes", "toda semana"],
    answer:
      "Não precisa trocar toda hora; trocar demais atrapalha, porque você não consegue medir se está ficando mais forte. Mantenha os principais exercícios por um ciclo inteiro e vá aumentando carga ou repetições. No fim de cada ciclo, trocar 2 ou 3 acessórios já renova o treino.",
    level: "campo",
    related: ["progressao-carga", "app-semanas"],
  },
  {
    id: "assimetria",
    topic: "treino",
    asks: ["um lado do corpo é mais forte", "braço direito maior que o esquerdo", "como corrigir assimetria", "lado mais fraco"],
    keys: ["assimetria", "lado", "esquerdo", "direito", "unilateral", "menor", "maior"],
    answer:
      "Uma pequena diferença entre os lados é normal. Para equilibrar, use exercícios de um lado por vez (halteres, cabo), comece pelo lado mais fraco e faça o mesmo número de repetições nos dois lados. Com alguns meses a diferença costuma diminuir.",
    principle: "semg",
    related: ["musculo-atrasado"],
  },
  {
    id: "musculo-atrasado",
    topic: "treino",
    asks: ["um músculo não cresce, o que fazer", "como melhorar um ponto fraco", "músculo atrasado", "peito não cresce de jeito nenhum"],
    keys: ["ponto fraco", "atrasado", "nao cresce"],
    answer:
      "Dê a ele prioridade: treine-o no começo do treino, 2 vezes por semana, e some umas 2 a 4 séries semanais a mais por um ciclo. Confira se está chegando perto do limite e usando amplitude boa. Para não aumentar o cansaço total, tire algumas séries de um músculo que já está bom.",
    principle: "feedback-volume",
    related: ["series-por-semana", "ordem-exercicios"],
  },
  {
    id: "pump",
    topic: "treino",
    asks: [
      "o pump faz o músculo crescer",
      "não sinto o músculo queimar",
      "músculo inchado depois do treino",
      "sensação de queimação no treino",
    ],
    keys: ["pump", "inchado", "queimacao", "congestao"],
    answer:
      "O pump, aquele inchaço durante o treino, é sinal de que você trabalhou o músculo, mas não é o que faz crescer. O principal é a tensão das séries perto do limite. Não sentir queimação não quer dizer que o treino foi ruim.",
    principle: "pump",
    related: ["ate-a-falha"],
  },
  {
    id: "acessorios",
    topic: "treino",
    asks: ["preciso usar cinto de musculação", "luva de academia é necessária", "strap ajuda na remada", "joelheira para agachar"],
    keys: ["cinto", "luva", "strap", "munhequeira", "joelheira", "faixa"],
    answer:
      "Nenhum é obrigatório. O cinto ajuda a firmar o tronco em séries pesadas de agachamento e terra; o strap ajuda quando a pegada cansa antes das costas. Luva e joelheira são questão de conforto. Use se ajudar, sem depender deles em tudo.",
    level: "campo",
    related: ["terra-coluna"],
  },
  {
    id: "carga-inicial",
    topic: "treino",
    asks: [
      "como escolher o peso certo",
      "qual carga usar num exercício novo",
      "como sei se o peso está leve demais",
      "peso muito pesado ou muito leve",
    ],
    keys: ["escolher carga", "carga certa", "primeira vez", "leve demais", "pesado demais"],
    answer:
      "Comece com um peso que você levanta com folga e anote quantas repetições saíram. Se passou bem do topo da faixa, aumente na próxima série; se não chegou no mínimo, baixe. Em 1 ou 2 treinos você acha a carga. O app aprende com o que você registra e passa a sugerir sozinho.",
    level: "campo",
    related: ["app-sugestao-carga", "progressao-carga"],
  },
  {
    id: "dia-ruim",
    topic: "treino",
    asks: [
      "dormi mal, devo treinar mesmo assim",
      "estou sem energia hoje",
      "treinar cansado vale a pena",
      "dia ruim no treino, o que faço",
    ],
    keys: ["cansado", "sem energia", "dia ruim", "indisposto", "fraco hoje"],
    answer:
      "Treine, mas ajuste: comece normal e, se a primeira série render bem menos, tire 1 série de cada exercício ou pare uma repetição mais cedo. Um treino leve conta mais que um treino perdido. No check-in do início do treino, marque como dormiu e o app ajusta o dia.",
    principle: "autorregulacao",
    related: ["app-checkin", "sono"],
  },
  {
    id: "voltar-pausa",
    topic: "treino",
    asks: [
      "parei de treinar, perdi tudo?",
      "quanto tempo sem treinar perde massa",
      "voltando depois de meses parado",
      "memória muscular existe",
    ],
    keys: ["parado", "pausa", "voltar", "memoria muscular", "ferias"],
    answer:
      "Até 2 ou 3 semanas parado quase não muda nada. Depois disso você perde um pouco, mas recupera bem mais rápido do que levou para ganhar. Na volta, comece com cargas uns 10% a 20% menores e menos séries na primeira semana; o app sugere recomeçar o ciclo quando você fica muito tempo sem treinar.",
    principle: "deload",
    related: ["app-reiniciar-ciclo"],
  },
  {
    id: "respiracao",
    topic: "treino",
    asks: [
      "como respirar durante o exercício",
      "solto o ar na subida ou na descida",
      "prender a respiração é perigoso",
      "respiração no agachamento",
    ],
    keys: ["respirar", "respiracao", "ar", "valsalva"],
    answer:
      "No geral, puxe o ar antes da parte difícil e solte ao terminar o esforço. Em séries pesadas de agachamento e terra, segurar o ar por um instante para firmar o tronco é comum e seguro para quem é saudável. Quem tem pressão alta ou problema de coração deve evitar prender o ar.",
    level: "consenso",
    related: ["acessorios"],
  },
  {
    id: "aquecimento-series",
    topic: "treino",
    asks: ["quantas séries de aquecimento", "preciso aquecer em todo exercício", "aquecimento com peso leve", "como aquecer para o supino"],
    keys: ["aquecimento", "series de aquecimento", "aquecer", "warm up"],
    answer:
      'Faça 1 a 3 séries leves antes do primeiro exercício pesado de cada músculo, subindo o peso aos poucos e com poucas repetições. Nos exercícios seguintes do mesmo músculo, 1 série leve ou nenhuma basta. O app mostra as séries de aquecimento e dá para tirá-las com "− Aquecimento".',
    level: "campo",
    related: ["alongamento"],
  },
  {
    id: "hip-thrust",
    topic: "treino",
    asks: [
      "elevação pélvica é melhor para o glúteo",
      "hip thrust ativa mais o glúteo",
      "preciso fazer hip thrust",
      "elevação pélvica ou agachamento para bumbum",
    ],
    keys: ["hip thrust", "elevacao pelvica", "ativacao", "emg"],
    answer:
      "A elevação pélvica ativa mais o glúteo na hora, mas num estudo de 9 semanas o glúteo cresceu igual com o agachamento. Ativar mais não quer dizer crescer mais. Faça a que você gosta e consegue progredir; as duas funcionam.",
    principle: "semg",
    related: ["exercicios-gluteo"],
  },
  {
    id: "leg-press-quadriceps",
    topic: "treino",
    asks: [
      "só o leg press basta para a coxa",
      "cadeira extensora é necessária",
      "leg press trabalha qual parte da coxa",
      "leg press substitui o agachamento",
    ],
    keys: ["leg press", "extensora", "reto femoral", "quadriceps"],
    answer:
      "O leg press e o agachamento crescem bem a maior parte da coxa e o glúteo, mas quase não pegam um dos músculos da frente da coxa (o reto femoral). A cadeira extensora pega. Por isso vale ter os dois.",
    principle: "reto-femoral",
    related: ["exercicios-perna"],
  },

  // ---------- Iniciante ----------
  {
    id: "ciclo-menstrual",
    topic: "iniciante",
    asks: [
      "preciso mudar o treino na menstruação",
      "treinar no período menstrual",
      "anticoncepcional atrapalha ganhar massa",
      "fase do ciclo menstrual e treino",
    ],
    keys: ["menstruacao", "menstrual", "anticoncepcional", "tpm", "pilula"],
    answer:
      "Os estudos não mostram que a fase do ciclo mude os ganhos, e a pílula não atrapalha. Não precisa planejar o treino pelo ciclo: ajuste pelo dia. Se estiver indisposta, marque no check-in e faça um treino mais leve.",
    principle: "ciclo-menstrual",
    related: ["mulher-treino", "dia-ruim"],
  },
  {
    id: "idade",
    topic: "iniciante",
    asks: ["é tarde para começar a treinar", "idoso pode fazer musculação", "com 60 anos ainda ganho músculo", "musculação depois dos 40"],
    keys: ["idade", "idoso", "velho", "anos", "terceira idade", "tarde", "da tempo", "comecar tarde"],
    answer:
      "Nunca é tarde. Em qualquer idade o músculo responde ao treino, e mesmo pouco volume já melhora força, equilíbrio e disposição. Comece leve, com técnica, e suba aos poucos. Quem tem alguma condição de saúde deve passar no médico antes.",
    principle: "idosos",
    related: ["primeiros-passos"],
  },
  {
    id: "primeiros-passos",
    topic: "iniciante",
    asks: ["nunca treinei, por onde começar", "sou iniciante na musculação", "primeiro treino na academia", "como começar a treinar"],
    keys: ["inicio", "iniciante", "novato", "primeiro treino", "nunca", "academia"],
    answer:
      "Comece com 3 treinos por semana de corpo inteiro, 3 a 5 exercícios e 2 a 3 séries em cada, sem ir até o limite nas primeiras semanas. Foque em aprender os movimentos com peso leve. O assistente de primeiro uso do app sugere um programa pronto para o seu caso.",
    level: "consenso",
    route: "/primeiro-uso",
    related: ["carga-inicial", "melhor-divisao"],
  },
  {
    id: "vergonha-academia",
    topic: "iniciante",
    asks: [
      "tenho vergonha de treinar na academia",
      "medo de fazer errado na frente dos outros",
      "ansiedade de ir na academia",
      "me sinto julgado na academia",
    ],
    keys: ["vergonha", "medo", "ansiedade", "julgamento"],
    answer:
      "É bem comum e passa rápido. A maioria das pessoas na academia está pensando no próprio treino. Vá em horários mais vazios no começo, leve o treino pronto no app e peça ajuda aos instrutores para ajustar os aparelhos: é o trabalho deles.",
    level: "campo",
    related: ["primeiros-passos"],
  },
  {
    id: "personal",
    topic: "iniciante",
    asks: ["preciso de personal trainer", "vale a pena pagar personal", "dá para treinar sozinho", "consigo aprender a treinar sozinho"],
    keys: ["personal", "instrutor", "treinador", "professor"],
    answer:
      "Não é obrigatório, mas ajuda no começo para aprender a técnica dos exercícios principais. Algumas aulas já fazem diferença. Depois, com um programa bem montado e registrando os treinos, dá para seguir sozinho.",
    level: "campo",
    related: ["primeiros-passos"],
  },
  {
    id: "secar-ou-crescer",
    topic: "iniciante",
    asks: [
      "primeiro emagrecer ou ganhar massa",
      "bulking ou cutting primeiro",
      "estou acima do peso, devo secar antes",
      "devo fazer dieta antes de ganhar massa",
    ],
    keys: ["emagrecer primeiro", "secar primeiro", "bulking ou cutting"],
    answer:
      "Se você tem bastante gordura, comece perdendo: quem está começando consegue ganhar músculo mesmo comendo um pouco menos. Se já está magro, coma um pouco acima do que gasta para crescer. No meio termo, comer na manutenção com proteína alta e treinar bem também funciona.",
    principle: "recomposicao",
    related: ["falso-magro", "recomposicao"],
  },
  {
    id: "falso-magro",
    topic: "iniciante",
    asks: ["sou magro mas tenho barriga", "falso magro o que fazer", "skinny fat", "peso normal mas com gordura na barriga"],
    keys: ["falso magro", "skinny fat", "magro com barriga"],
    answer:
      "Nesse caso o foco é ganhar músculo, não perder peso. Treine pesado, coma proteína suficiente e mantenha as calorias perto do que você gasta. Em alguns meses a balança mexe pouco, mas o corpo muda: menos barriga e mais músculo.",
    principle: "recomposicao",
    related: ["secar-ou-crescer", "proteina-quanto"],
  },
  {
    id: "crescer-rapido",
    topic: "iniciante",
    asks: [
      "como ganhar massa muscular rápido",
      "qual o jeito mais rápido de crescer",
      "acelerar o ganho de massa",
      "quero crescer o mais rápido possível",
    ],
    keys: ["rapido", "acelerar", "rapidez"],
    answer:
      "Não existe atalho, mas o básico bem feito é o mais rápido: treinar cada músculo umas 10 a 20 séries por semana perto do limite, aumentar a carga aos poucos, comer proteína suficiente com as calorias um pouco acima do gasto e dormir bem. Constância por meses vence qualquer truque.",
    level: "consenso",
    related: ["series-por-semana", "ganhar-massa-comer", "proteina-quanto"],
  },
  {
    id: "genetica",
    topic: "iniciante",
    asks: [
      "genética atrapalha ganhar massa",
      "não tenho genética boa",
      "ectomorfo consegue crescer",
      "minha genética é ruim para musculação",
    ],
    keys: ["genetica", "ectomorfo", "biotipo", "endomorfo", "mesomorfo"],
    answer:
      "A genética muda a velocidade e o formato, mas quase todo mundo ganha músculo com treino bem feito. Os tipos de corpo (ectomorfo e outros) não definem o treino. Quem tem mais dificuldade costuma precisar comer mais do que acha.",
    level: "consenso",
    related: ["dificil-ganhar", "resultado-tempo"],
  },
  {
    id: "motivacao",
    topic: "iniciante",
    asks: ["perdi a vontade de treinar", "como manter a constância", "desanimei da academia", "não consigo ser constante"],
    keys: ["motivacao", "desanimo", "preguica", "constancia", "disciplina"],
    answer:
      "Motivação vai e vem; o que segura é a rotina. Combine dias e horários fixos, deixe o treino mais curto nos dias difíceis em vez de faltar e acompanhe os números: ver a carga subir anima. A sequência de semanas e os recordes no app ajudam a enxergar o progresso.",
    level: "campo",
    route: "/progresso",
    related: ["duracao-treino", "app-postos"],
  },

  // ---------- Alimentação ----------
  {
    id: "agua",
    topic: "alimentacao",
    asks: ["quanta água beber por dia", "hidratação no treino", "beber água durante o treino", "quantos litros de água tomar"],
    keys: ["agua", "hidratacao", "litros", "sede", "desidratacao"],
    answer:
      "Para a maioria, beber o bastante para a urina ficar clara e não sentir sede já resolve; costuma dar de 2 a 3 litros por dia, mais no calor e em dia de treino. Leve uma garrafa para o treino e beba aos goles entre as séries.",
    level: "consenso",
    related: ["creatina"],
  },
  {
    id: "carbo-noite",
    topic: "alimentacao",
    asks: [
      "comer carboidrato à noite engorda",
      "posso jantar arroz",
      "carboidrato depois das 18h",
      "jantar com carboidrato atrapalha a dieta",
    ],
    keys: ["noite", "jantar", "carboidrato", "horario"],
    answer:
      "Não. O que engorda é o total de calorias no dia, não o horário. Se o jantar com carboidrato te ajuda a dormir bem e a bater a meta, está ótimo.",
    level: "evidencia",
    related: ["calorias", "comer-a-noite"],
  },
  {
    id: "jejum-intermitente",
    topic: "alimentacao",
    asks: [
      "jejum intermitente funciona",
      "jejum intermitente atrapalha a hipertrofia",
      "posso fazer jejum e ganhar massa",
      "fazer jejum de 16 horas",
    ],
    keys: ["jejum intermitente", "jejum", "janela de alimentacao", "16 8"],
    answer:
      "O jejum intermitente funciona para emagrecer porque ajuda a comer menos, não por mágica. Para ganhar músculo, fica mais difícil bater a proteína em poucas refeições; se gostar do jejum, faça 2 ou 3 refeições bem proteicas na janela. Se comer igual, o resultado é parecido.",
    level: "evidencia",
    related: ["refeicoes-por-dia", "proteina-quanto"],
  },
  {
    id: "refeicoes-por-dia",
    topic: "alimentacao",
    asks: [
      "quantas refeições fazer por dia",
      "comer de 3 em 3 horas",
      "preciso comer várias vezes ao dia",
      "posso fazer só 2 refeições por dia",
    ],
    keys: ["refeicoes", "3 em 3 horas", "frequencia alimentar"],
    answer:
      "Não precisa comer de 3 em 3 horas. O total do dia é o que manda. Para o músculo, dividir a proteína em 3 a 5 refeições é um pouco melhor que concentrar tudo em uma; escolha o número que cabe na sua rotina.",
    level: "evidencia",
    related: ["proteina-quanto", "jejum-intermitente"],
  },
  {
    id: "calorias",
    topic: "alimentacao",
    asks: [
      "quantas calorias devo comer por dia",
      "como calcular minhas calorias",
      "quanto eu gasto por dia",
      "quantas calorias para manter o peso",
    ],
    keys: ["calorias", "kcal", "gasto calorico", "tmb", "metabolismo"],
    answer:
      "Um ponto de partida comum é o peso em kg vezes 30 a 35 para manter o peso (quem se mexe pouco fica perto de 30). É só uma estimativa: pese-se algumas vezes por semana e ajuste pela média. Peso subindo ou caindo mais do que o planejado, mexa umas 100 a 200 calorias.",
    level: "campo",
    route: "/progresso",
    related: ["ganhar-massa-comer", "perder-gordura-ritmo", "contar-calorias"],
  },
  {
    id: "contar-calorias",
    topic: "alimentacao",
    asks: ["preciso contar calorias", "contar macros é necessário", "dá para emagrecer sem contar calorias", "preciso pesar a comida"],
    keys: ["contar", "macros", "aplicativo de dieta", "pesar comida"],
    answer:
      "Não é obrigatório. Contar ajuda a aprender quanto você come, e muita gente faz por algumas semanas e depois segue no olho. Sem contar, use a balança como guia: pese-se algumas vezes por semana e ajuste as porções pela média.",
    level: "campo",
    related: ["calorias", "peso-oscila"],
  },
  {
    id: "recomposicao",
    topic: "alimentacao",
    asks: [
      "dá para ganhar massa e perder gordura ao mesmo tempo",
      "recomposição corporal funciona",
      "o peso não muda mas o corpo mudou",
      "ganhar massa sem engordar",
    ],
    keys: ["recomposicao", "ao mesmo tempo", "simultaneo", "junto", "juntos"],
    answer:
      "Dá, principalmente em iniciantes, em quem tem mais gordura e em quem volta de uma pausa. O caminho é treinar pesado, comer bastante proteína e ficar perto da manutenção ou um pouco abaixo. Sinal de que está acontecendo: peso parado, cintura diminuindo e cargas subindo.",
    principle: "recomposicao",
    related: ["falso-magro", "proteina-quanto"],
  },
  {
    id: "vegetariano",
    topic: "alimentacao",
    asks: ["vegetariano ganha massa", "dieta vegana e hipertrofia", "proteína vegetal funciona", "sem carne dá para ganhar massa"],
    keys: ["vegetariano", "vegano", "vegetal", "soja", "feijao"],
    answer:
      "Ganha, sim. A diferença é planejar a proteína: misture fontes (feijão, lentilha, grão-de-bico, soja, tofu, ovos e laticínios para quem come) e mire no alto da faixa, perto de 2 g por kg. Uma proteína vegetal em pó ajuda a fechar a conta.",
    level: "evidencia",
    related: ["proteina-quanto"],
  },
  {
    id: "proteina-excesso",
    topic: "alimentacao",
    asks: ["proteína demais faz mal", "muita proteína estraga o rim", "existe limite de proteína", "existe proteína demais"],
    keys: ["excesso", "demais", "rim", "limite"],
    answer:
      "Em pessoas saudáveis, comer bem acima da meta (até perto de 3 g por kg) não mostrou dano aos rins nos estudos. Só não traz benefício extra para o músculo e tira espaço de outros alimentos. Quem tem doença nos rins deve seguir a orientação do médico.",
    level: "evidencia",
    related: ["proteina-quanto"],
  },
  {
    id: "doces",
    topic: "alimentacao",
    asks: [
      "posso comer doce de dieta",
      "açúcar atrapalha ganhar massa",
      "um chocolate por dia estraga a dieta",
      "pode comer sobremesa na dieta",
    ],
    keys: ["doce", "acucar", "chocolate", "sobremesa"],
    answer:
      "Pode, com moderação. Se o total de calorias e a proteína do dia estiverem certos, um doce pequeno não atrapalha o resultado e ajuda a manter a dieta. O problema é quando os doces tomam o lugar das refeições.",
    level: "consenso",
    related: ["refeicao-livre", "calorias"],
  },
  {
    id: "refeicao-livre",
    topic: "alimentacao",
    asks: [
      "dia do lixo estraga a dieta",
      "refeição livre no fim de semana",
      "posso comer o que quiser um dia por semana",
      "jacar no fim de semana atrapalha",
    ],
    keys: ["dia do lixo", "refeicao livre", "lixo", "jacada"],
    answer:
      "Uma refeição livre de vez em quando cabe bem. Um dia inteiro comendo muito pode anular o déficit da semana toda. Prefira uma refeição, não um dia, e volte ao normal na seguinte, sem compensar passando fome.",
    level: "campo",
    related: ["doces", "plato"],
  },
  {
    id: "suplementos",
    topic: "alimentacao",
    asks: ["quais suplementos tomar", "suplementos que funcionam", "preciso de suplemento para crescer", "lista de suplementos"],
    keys: ["suplementos", "suplementacao", "loja de suplemento"],
    answer:
      "Poucos têm efeito comprovado: creatina, cafeína e proteína em pó (que é só comida prática). Vitamina D só se o exame mostrar falta. O resto (BCAA, glutamina, termogênicos e afins) faz pouco ou nada para quem já come direito. Comida, treino e sono vêm antes de qualquer pote.",
    level: "evidencia",
    related: ["creatina", "whey", "cafeina"],
  },
  {
    id: "bcaa",
    topic: "alimentacao",
    asks: ["BCAA serve para alguma coisa", "vale a pena tomar bcaa", "aminoácido antes do treino", "bcaa ajuda a recuperar"],
    keys: ["bcaa", "aminoacido", "leucina", "eaa"],
    answer:
      "Para quem come proteína suficiente, o BCAA não acrescenta nada: ele já está na carne, no ovo, no leite e no whey. Gaste esse dinheiro em comida ou em proteína completa.",
    level: "evidencia",
    related: ["suplementos", "whey"],
  },
  {
    id: "glutamina",
    topic: "alimentacao",
    asks: ["glutamina funciona", "glutamina ajuda a recuperar", "vale tomar glutamina", "glutamina vale o dinheiro"],
    keys: ["glutamina"],
    answer:
      "Em pessoas saudáveis que treinam, a glutamina não mostrou ganho de músculo nem de força. O corpo já produz e a comida já tem. Não vale o gasto para esse objetivo.",
    level: "evidencia",
    related: ["suplementos"],
  },
  {
    id: "termogenico",
    topic: "alimentacao",
    asks: ["termogênico funciona", "termogênico ajuda a emagrecer", "queimador de gordura vale a pena", "queimador de gordura é seguro"],
    keys: ["termogenico", "queimador", "fat burner"],
    answer:
      "O efeito é pequeno: a maioria é cafeína com outros nomes, e a diferença no peso fica perto de nada sem o déficit de calorias. Pode dar insônia e acelerar o coração. Quem tem problema de pressão ou de coração não deve usar sem o médico.",
    level: "consenso",
    related: ["cafeina", "perder-gordura-ritmo"],
  },
  {
    id: "colageno",
    topic: "alimentacao",
    asks: [
      "colágeno ajuda a ganhar massa",
      "colágeno conta como proteína",
      "tomar colágeno para as articulações",
      "colágeno para os tendões",
    ],
    keys: ["colageno", "gelatina"],
    answer:
      "O colágeno é uma proteína incompleta e rende pouco para o músculo; não conte ele na meta de proteína. Para articulação e tendão, os estudos ainda são fracos. Se quiser usar, não faz mal, só não espere efeito no músculo.",
    level: "consenso",
    related: ["proteina-quanto", "suplementos"],
  },
  {
    id: "low-carb",
    topic: "alimentacao",
    asks: [
      "dieta low carb perde músculo",
      "cortar carboidrato para secar",
      "dieta cetogênica e musculação",
      "tirar o carboidrato para emagrecer",
    ],
    keys: ["low carb", "cetogenica", "keto", "sem carboidrato", "cortar carboidrato"],
    answer:
      "Com as mesmas calorias e a mesma proteína, low carb e dieta com carboidrato emagrecem parecido. A diferença é que pouco carboidrato pode baixar o rendimento no treino. Escolha a que você consegue manter.",
    level: "evidencia",
    related: ["perder-gordura-ritmo", "calorias"],
  },
  {
    id: "frutas",
    topic: "alimentacao",
    asks: ["comer fruta engorda?", "posso comer banana à noite", "açúcar da fruta atrapalha a dieta", "quantas frutas por dia"],
    keys: ["fruta", "frutas", "banana", "frutose"],
    answer:
      "Fruta não engorda por si: tem fibra, água e vitaminas, e sacia. Entra na conta das calorias como qualquer alimento, mas dificilmente é o problema de uma dieta.",
    level: "consenso",
    related: ["calorias"],
  },
  {
    id: "peso-oscila",
    topic: "alimentacao",
    asks: [
      "meu peso sobe e desce todo dia",
      "engordei 1 kg de um dia para o outro",
      "por que a balança varia tanto",
      "a balança muda muito de um dia para o outro",
    ],
    keys: ["balanca", "oscila", "varia", "retencao", "inchaco"],
    answer:
      "É normal variar 1 a 2 kg de um dia para o outro: água, sal, comida no intestino e glicogênio mudam o peso sem mudar a gordura. Por isso olhe a média da semana. Em Progresso o app mostra a linha da média, que tira esse ruído.",
    level: "evidencia",
    route: "/progresso",
    related: ["plato", "app-corpo"],
  },
  {
    id: "plato",
    topic: "alimentacao",
    asks: ["parei de perder peso", "meu peso travou na dieta", "platô no emagrecimento", "a balança não desce mais"],
    keys: ["plato", "travou", "estagnou", "parou de emagrecer"],
    answer:
      "Primeiro confira a média de 2 semanas, não um dia. Se ela parou mesmo, tire umas 100 a 200 calorias por dia ou some uns 2 a 3 mil passos diários. Peso parado com cintura diminuindo e força subindo pode ser recomposição, e aí está tudo certo.",
    level: "campo",
    principle: "ritmo-perda",
    route: "/progresso",
    related: ["peso-oscila", "recomposicao"],
  },
  {
    id: "dificil-ganhar",
    topic: "alimentacao",
    asks: ["não consigo ganhar peso", "como engordar sendo magro", "como comer mais sem passar mal", "sou muito magro e não engordo"],
    keys: ["engordar", "magro", "ganhar peso", "apetite"],
    answer:
      "Coma um pouco mais do que parece: some uma refeição ou um lanche por dia e prefira alimentos densos (arroz, massas, pão, azeite, pasta de amendoim, leite, banana). Líquidos como vitamina e leite ajudam quem tem pouco apetite. Se a média de peso não subir em 2 semanas, aumente de novo.",
    level: "consenso",
    route: "/progresso",
    related: ["ganhar-massa-comer"],
  },
  {
    id: "cafe-da-manha",
    topic: "alimentacao",
    asks: [
      "pular o café da manhã faz mal",
      "tomar café da manhã acelera o metabolismo",
      "posso treinar sem tomar café",
      "café da manhã é a refeição mais importante",
    ],
    keys: ["cafe da manha", "pular", "manha"],
    answer:
      "Pular o café da manhã não desacelera o metabolismo nem faz perder músculo, se o total do dia estiver certo. Se você treina cedo e sente fraqueza, coma algo leve antes. Faça o que funciona melhor para a sua rotina.",
    level: "evidencia",
    related: ["antes-do-treino", "refeicoes-por-dia"],
  },
  {
    id: "comer-a-noite",
    topic: "alimentacao",
    asks: ["comer antes de dormir atrapalha", "proteína antes de dormir ajuda", "caseína à noite", "lanche antes de deitar"],
    keys: ["dormir", "deitar", "noite", "caseina", "ceia"],
    answer:
      "Comer antes de dormir não engorda por causa do horário. Uma refeição com proteína à noite (iogurte, leite, ovos) pode ajudar um pouco a recuperação e a bater a meta do dia. Evite só exagerar a ponto de atrapalhar o sono.",
    level: "consenso",
    related: ["carbo-noite", "sono"],
  },
  {
    id: "beta-alanina",
    topic: "alimentacao",
    asks: ["beta-alanina funciona", "para que serve beta alanina", "formigamento do pré-treino", "beta-alanina dá formigamento"],
    keys: ["beta alanina", "formigamento", "coceira"],
    answer:
      "A beta-alanina ajuda um pouco em esforços de 1 a 4 minutos, como séries bem longas; para musculação comum o efeito é pequeno. O formigamento que ela dá é inofensivo. Não é prioridade perto de creatina e de comer bem.",
    level: "evidencia",
    related: ["suplementos", "cafeina"],
  },
  {
    id: "multivitaminico",
    topic: "alimentacao",
    asks: ["preciso tomar multivitamínico", "vitamina para ganhar massa", "vitamina D ajuda no treino", "preciso tomar vitaminas"],
    keys: ["vitamina", "multivitaminico", "vitamina d", "minerais"],
    answer:
      "Quem come variado raramente precisa. Vitamina não faz crescer; ela só corrige uma falta. Se suspeitar de falta (vitamina D, ferro), peça um exame ao médico antes de tomar por conta.",
    level: "consenso",
    related: ["suplementos"],
  },

  // ---------- Recuperação ----------
  {
    id: "dias-descanso",
    topic: "recuperacao",
    asks: ["quantos dias de folga na semana", "preciso de folga do treino", "o que fazer no dia de descanso", "descanso ativo funciona"],
    keys: ["folga", "dia de descanso", "descanso ativo"],
    answer:
      "Com 3 a 5 treinos por semana, os dias livres já dão o descanso necessário. No dia de folga, caminhar e se mexer leve ajuda a recuperar; não precisa ficar parado. O importante é não treinar o mesmo músculo pesado em dias seguidos.",
    level: "consenso",
    related: ["treinar-todo-dia", "recuperacao-tempo"],
  },
  {
    id: "overtraining",
    topic: "recuperacao",
    asks: ["sinais de overtraining", "estou treinando demais?", "cansaço que não passa", "cargas caindo toda semana"],
    keys: ["overtraining", "excesso", "esgotado", "fadiga acumulada", "queda de rendimento"],
    answer:
      "Os sinais mais comuns são cargas ou repetições caindo por 2 treinos seguidos, sono ruim, articulações reclamando e falta de vontade de treinar. Quando dois deles aparecem juntos, tire algumas séries ou faça uma semana leve. O app acompanha esses sinais e avisa na tela Hoje.",
    principle: "volume-cego",
    related: ["deload", "sono"],
  },
  {
    id: "massagem",
    topic: "recuperacao",
    asks: [
      "rolo de espuma ajuda a recuperar",
      "massagem depois do treino",
      "liberação miofascial funciona",
      "massagem ajuda a recuperar o músculo",
    ],
    keys: ["rolo", "liberacao", "massagem", "foam roller", "miofascial"],
    answer:
      "Rolo e massagem diminuem um pouco a dor e a sensação de rigidez, por pouco tempo. Não aceleram o crescimento. Use se te faz sentir melhor; não é obrigatório.",
    level: "evidencia",
    related: ["dor-tardia", "alongamento"],
  },
  {
    id: "gelo",
    topic: "recuperacao",
    asks: [
      "banho de gelo depois do treino",
      "crioterapia atrapalha o ganho de massa",
      "gelo no músculo dolorido",
      "imersão no gelo depois da academia",
    ],
    keys: ["gelo", "gelado", "crioterapia", "banheira de gelo", "frio"],
    answer:
      "Banho de gelo logo depois da musculação, feito com frequência, pode reduzir um pouco o ganho de músculo. Se o objetivo é crescer, evite usar logo após o treino. Para alívio da dor de vez em quando, não tem problema.",
    level: "evidencia",
    related: ["dor-tardia", "massagem"],
  },
  {
    id: "dor-articulacao",
    topic: "recuperacao",
    asks: [
      "como diferenciar dor muscular de dor na articulação",
      "dor no joelho durante o exercício",
      "sinto uma fisgada no ombro",
      "dor na junta durante o treino",
    ],
    keys: ["articulacao", "fisgada", "pontada", "estalo", "junta"],
    answer:
      'Dor muscular é espalhada, aparece no dia seguinte e melhora com o movimento. Dor na articulação é localizada, fina ou em pontada, aparece durante o exercício e piora com ele. Nesse caso, pare aquele exercício, troque por outro que não doa e, se continuar, procure um profissional. Diga "dor no ombro" e eu proponho como proteger nos próximos treinos.',
    level: "consenso",
    related: ["dor-tardia", "agachamento-joelho"],
  },
  {
    id: "caimbra",
    topic: "recuperacao",
    asks: ["tive cãibra no treino", "o que causa cãibra", "como evitar cãibra", "câimbra na panturrilha durante o exercício"],
    keys: ["caimbra", "contracao", "travou o musculo"],
    answer:
      "A cãibra no treino vem mais do cansaço do músculo do que da falta de água ou de banana. Na hora, alongue devagar o músculo e espere passar. Se for frequente, com dor forte ou fora do treino, vale procurar um médico.",
    level: "consenso",
    related: ["agua"],
  },
  {
    id: "estresse",
    topic: "recuperacao",
    asks: ["estresse atrapalha ganhar massa", "ansiedade e treino", "semana pesada no emprego e treino", "ando muito estressado"],
    keys: ["estresse", "ansiedade", "emprego", "preocupacao"],
    answer:
      "Estresse alto atrapalha o sono e a recuperação, e o treino rende menos. Em semanas pesadas, mantenha o treino mais curto e mais leve em vez de faltar. O próprio treino costuma ajudar a aliviar o estresse.",
    level: "consenso",
    related: ["sono", "dia-ruim"],
  },
  {
    id: "cochilo",
    topic: "recuperacao",
    asks: ["cochilar ajuda a recuperar", "soneca depois do almoço", "dormi pouco, cochilo compensa?", "dormir à tarde ajuda no treino"],
    keys: ["cochilo", "soneca", "sesta"],
    answer:
      "Um cochilo de 20 a 30 minutos ajuda a disposição e compensa um pouco uma noite curta. Cochilos longos ou no fim da tarde podem atrapalhar o sono da noite, que é o que mais importa.",
    level: "consenso",
    related: ["sono"],
  },

  // ---------- Uso do app ----------
  {
    id: "app-timer",
    topic: "app",
    asks: ["como funciona o timer de descanso", "desligar o som do timer", "o timer não vibra", "aviso de fim do descanso"],
    keys: ["timer", "cronometro", "som", "vibrar", "notificacao"],
    answer:
      "Ao marcar uma série, o timer de descanso começa sozinho, com o tempo do exercício, e aparece numa barra acima das abas. Em Ajustes → Timer de descanso você liga ou desliga o som, a vibração e o aviso quando o app está em outra aba.",
    route: "/ajustes",
    related: ["descanso-series"],
  },
  {
    id: "app-registrar-rir",
    topic: "app",
    asks: [
      "onde registro o RIR",
      "como marcar quantas repetições sobraram",
      "o app pergunta como foi o exercício",
      "onde informo as repetições que sobraram",
    ],
    keys: ["rir", "sobra", "como bateu", "feedback"],
    answer:
      "Quando você termina as séries de um exercício, o cartão pergunta quantas repetições sobraram (o RIR) e como bateu (pump, volume, articulação). Responder ajusta o esforço e as séries das próximas semanas.",
    related: ["rir"],
  },
  {
    id: "app-recordes",
    topic: "app",
    asks: ["onde vejo meus recordes", "lista de recordes pessoais", "histórico de um exercício", "ver meus melhores pesos"],
    keys: ["recordes", "pr", "historico", "marcas"],
    answer:
      'Os recordes de todos os exercícios ficam em Progresso. O histórico completo de um exercício, com gráfico, fica na página dele, em Exercícios. Aqui você também pode perguntar "qual meu recorde no supino?".',
    route: "/progresso",
    related: ["app-sugestao-carga"],
  },
  {
    id: "app-mapa-fadiga",
    topic: "app",
    asks: [
      "o que é o mapa de fadiga",
      "o boneco vermelho no progresso",
      "como o app calcula a recuperação",
      "o que significam as cores do corpo no progresso",
    ],
    keys: ["mapa", "fadiga", "boneco", "corpo vermelho"],
    answer:
      "O mapa de fadiga, em Progresso, pinta cada músculo conforme o cansaço: ciano está pronto, âmbar está quase e vermelho ainda recuperando. A conta usa as séries do último treino, o esforço que você marcou e quanto tempo passou.",
    route: "/progresso",
    related: ["recuperacao-tempo"],
  },
  {
    id: "app-conta",
    topic: "app",
    asks: ["preciso criar conta para usar o app", "a conta online custa quanto", "para que serve a conta online", "o app é de graça"],
    keys: ["conta", "cadastro", "login", "pago", "gratis"],
    answer:
      "Não precisa de conta: o app funciona inteiro sem ela. A conta online é opcional e grátis; com ela, o backup sobe sozinho e você pode adicionar amigos e comparar recordes. Você cria em Ajustes → Conta online.",
    route: "/online",
    related: ["app-amigos", "app-backup"],
  },
  {
    id: "app-amigos",
    topic: "app",
    asks: ["como adicionar amigos no app", "ranking entre amigos", "ver o treino dos meus amigos", "treinar junto com amigos pelo app"],
    keys: ["amigos", "ranking", "feed", "comparar"],
    answer:
      "Com a conta online, em Amigos você busca pelo nome de usuário e manda o pedido. Depois de aceito, aparecem o ranking da semana, os treinos recentes e a comparação de recordes. Dá para bloquear ou denunciar alguém pela página da pessoa.",
    route: "/amigos",
    related: ["app-conta"],
  },
  {
    id: "app-offline",
    topic: "app",
    asks: ["o app funciona sem internet", "posso usar offline", "preciso de internet na academia", "funciona no modo avião"],
    keys: ["internet", "offline", "sem sinal", "wifi"],
    answer:
      "Funciona. Tudo fica no celular: treino, sugestões de carga, timer, relatórios e estas respostas. A internet só é usada pela conta online, quando você tem uma, e pelo treinador completo com chave.",
    related: ["app-conta"],
  },
  {
    id: "app-exercicio-extra",
    topic: "app",
    asks: [
      "como adicionar um exercício só hoje",
      "colocar um exercício a mais no treino",
      "exercício extra sem mudar o programa",
      "incluir um exercício que não está na ficha",
    ],
    keys: ["extra", "adicionar exercicio", "a mais"],
    answer:
      'No fim do treino em andamento, toque em "Adicionar exercício hoje". Ele entra só naquele dia, com a etiqueta "extra hoje", e o programa não muda. Para deixar fixo, adicione em Programas.',
    route: "/programas",
    related: ["app-trocar-hoje", "app-trocar-programa"],
  },
  {
    id: "app-trocar-hoje",
    topic: "app",
    asks: [
      "como trocar um exercício durante o treino",
      "aparelho ocupado, como troco",
      "trocar exercício só por hoje",
      "substituir um exercício no meio do treino",
    ],
    keys: ["ocupado", "trocar hoje", "alternativa", "substituir"],
    answer:
      'No treino, toque no número da série para abrir o menu e escolha "Trocar hoje". As opções são do mesmo movimento, e a carga sugerida passa a seguir o histórico da alternativa. No próximo treino volta o exercício normal.',
    related: ["app-exercicio-extra"],
  },
  {
    id: "app-unidade",
    topic: "app",
    asks: ["como mudar de kg para libras", "trocar a unidade de peso", "a máquina da academia é em libras", "usar libras em vez de quilos"],
    keys: ["libras", "lb", "unidade", "kg"],
    answer:
      "No cartão do exercício, durante o treino, há o seletor kg / lb. A unidade vale para aquele exercício, então dá para usar libras só na máquina que é em libras. Os recordes e comparações convertem sozinhos.",
    related: ["app-pesos-maquina"],
  },
  {
    id: "app-pesos-maquina",
    topic: "app",
    asks: ["informar os pesos de cada máquina", "a máquina pula de 5 em 5", "mudar o incremento de carga", "peso da barra no app"],
    keys: ["incremento", "pilha", "placas", "anilhas", "barra"],
    answer:
      "Em Ajustes → Incrementos e pesos você informa quanto a carga sobe em cada exercício, os pesos que existem em cada máquina e o peso da sua barra. Assim as sugestões só mostram cargas que dá para montar de verdade.",
    route: "/ajustes",
    related: ["app-sugestao-carga"],
  },
  {
    id: "app-importar",
    topic: "app",
    asks: ["importar treinos de outro app", "trazer meu histórico do Strong", "migrar do Hevy", "trazer meus treinos antigos para o app"],
    keys: ["importar", "hevy", "strong", "csv", "migrar"],
    answer:
      'Em Ajustes → Backup, use "Importar do Hevy ou Strong (.csv)". Exporte o CSV no outro app, escolha o arquivo e confira a prévia antes de gravar. Importar de novo não duplica, e antes o app guarda um ponto de restauração.',
    route: "/ajustes",
    related: ["app-backup"],
  },
  {
    id: "app-apagar-treino",
    topic: "app",
    asks: ["como apagar um treino", "excluir treino registrado errado", "corrigir uma série errada", "deletar um treino do histórico"],
    keys: ["apagar", "excluir", "errado", "corrigir"],
    answer:
      'Abra o treino pelo Histórico. Para corrigir uma série, toque nela e edite. Para apagar o treino inteiro, segure o botão "Excluir treino" no fim da tela: é preciso segurar para não apagar sem querer.',
    route: "/historico",
    related: ["app-restauracao"],
  },
  {
    id: "app-azul",
    topic: "app",
    asks: ["por que o app ficou azul", "a cor do app mudou", "o vermelho sumiu", "o app mudou de cor"],
    keys: ["azul", "cor", "vermelho"],
    answer:
      "O app fica azul na semana 7 do ciclo, a semana leve (deload). É um lembrete visual de pegar leve. Na semana seguinte, com o ciclo novo, o vermelho volta.",
    related: ["deload", "app-semanas"],
  },
  {
    id: "app-treinador-completo",
    topic: "app",
    asks: [
      "como ligar o treinador completo",
      "usar o treinador com chave da Anthropic",
      "conversar com o Claude no app",
      "como conversar com o treinador de verdade",
    ],
    keys: ["chave", "claude", "anthropic", "api", "treinador completo"],
    answer:
      'Estas respostas funcionam sem chave e sem internet. Para conversar livremente, ligue o treinador completo em Configurar, com uma chave da Anthropic sua (o uso é cobrado por ela). Sem chave, dá para levar a conversa para o chat que você já usa com "Levar para outro chat".',
    route: "/treinador?config=1",
    related: ["app-offline"],
  },
  {
    id: "app-efeitos",
    topic: "app",
    asks: ["deixar o app mais leve", "desligar as animações", "o app está travando", "como tirar os efeitos visuais"],
    keys: ["animacao", "efeitos", "lento", "travando", "bateria"],
    answer:
      'Em Ajustes → Efeitos visuais, escolha "Mínimo" para cortar as animações. Com "reduzir movimento" ligado no celular, o app já desliga quase tudo sozinho.',
    route: "/ajustes",
    related: ["app-offline"],
  },
  {
    id: "app-dias",
    topic: "app",
    asks: [
      "mudar os dias de treino",
      "treinar em outros dias da semana",
      "escolher os dias que vou à academia",
      "alterar meus dias de academia",
    ],
    keys: ["dias de treino", "agenda", "segunda", "calendario"],
    answer:
      "Em Ajustes → Dias de treino você marca os dias da semana em que treina. A agenda e o próximo treino se reorganizam na hora. O treino que você faltar não some: vira o próximo da fila.",
    route: "/ajustes",
    related: ["app-pular"],
  },
  {
    id: "app-pular",
    topic: "app",
    asks: ["pular um treino da sequência", "faltei, perco o treino?", "o que acontece se eu não treinar num dia", "não fui hoje, e agora"],
    keys: ["pular", "pulei", "faltar", "fila", "sequencia"],
    answer:
      'O treino que você não fez continua como o próximo da fila, então nenhum músculo fica para trás. Se faltar vários dias, o app sugere repetir a semana ou recomeçar o ciclo. Diga "faltei" aqui e eu mostro como fica a sua agenda.',
    related: ["app-dias", "app-reiniciar-ciclo"],
  },
  {
    id: "app-reiniciar-ciclo",
    topic: "app",
    asks: ["como recomeçar o mesociclo", "voltar para a semana 1", "mudar a semana do ciclo", "zerar o ciclo de treino"],
    keys: ["recomecar", "reiniciar", "semana 1", "novo ciclo", "zerar"],
    answer:
      'Em Ajustes → Mesociclo, toque em "Começar novo mesociclo nesta semana" ou escolha a semana certa na faixa. Depois de um tempo parado, a tela Hoje também oferece "Recomeçar na semana 1".',
    route: "/ajustes",
    related: ["app-semanas", "voltar-pausa"],
  },
  {
    id: "app-privacidade",
    topic: "app",
    asks: ["meus dados são vendidos", "quem vê meus treinos", "política de privacidade do app", "meus treinos ficam públicos"],
    keys: ["privacidade", "dados", "vender", "seguranca", "vendem"],
    answer:
      "Seus dados ficam no seu celular. Só sobem para o servidor se você criar a conta online, e servem para backup e para os amigos que você aceitar. Nada é vendido. A política completa está em Privacidade.",
    route: "/privacidade",
    related: ["app-conta"],
  },
  {
    id: "app-corpo",
    topic: "app",
    asks: ["onde registro meu peso", "anotar medidas do corpo", "fotos de progresso no app", "registrar minha cintura"],
    keys: ["peso corporal", "medidas", "cintura", "fotos", "biometria"],
    answer:
      "Em Progresso → Biometria você registra o peso, a cintura e outras medidas, e guarda fotos para comparar. Com alguns registros por semana, o app mostra a tendência e o ritmo em relação à sua meta.",
    route: "/progresso",
    related: ["peso-oscila"],
  },
  {
    id: "app-checkin",
    topic: "app",
    asks: [
      "para que serve o check-in",
      "perguntas de sono e energia no início do treino",
      "pular o check-in",
      "o que o app pergunta antes de começar",
    ],
    keys: ["check in", "checkin", "sono", "energia"],
    answer:
      "No início do treino o app pergunta como você dormiu, a energia e se há dor. Num dia ruim ele propõe tirar 1 série dos isolados, só naquele treino, com a opção de desfazer. Dá para pular se quiser.",
    related: ["dia-ruim"],
  },
  {
    id: "app-superserie",
    topic: "app",
    asks: [
      "o que quer dizer A1 e A2 no treino",
      "como funciona a superserie no app",
      "exercícios marcados como A1",
      "fazer dois exercícios juntos no app",
    ],
    keys: ["a1", "a2", "superserie", "superset", "conjugado"],
    answer:
      "A1 e A2 são uma superserie: faça a série do A1, vá direto para o A2 e só então descanse. O app já cuida disso: depois do A1 ele leva você ao A2 sem timer, e depois do A2 conta o descanso.",
    related: ["superserie"],
  },
  {
    id: "app-programa-fixo",
    topic: "app",
    asks: ["como funciona um programa fixo", "programa sem mesociclo", "desligar a periodização", "treino sem semana leve"],
    keys: ["fixo", "periodizacao", "sem ciclo"],
    answer:
      "Num programa fixo, as séries e o esforço ficam sempre como estão na ficha: sem as 7 semanas do ciclo e sem semana leve automática. Você escolhe isso no montador do programa, em Programas.",
    route: "/programas",
    related: ["app-semanas"],
  },
  {
    id: "app-restauracao",
    topic: "app",
    asks: ["o que são pontos de restauração", "desfazer uma importação", "voltar os dados para antes", "recuperar dados de antes"],
    keys: ["restauracao", "desfazer", "voltar dados"],
    answer:
      "O app guarda cópias automáticas dos seus dados toda semana e antes de importar, restaurar ou apagar algo, até 6 delas. Em Ajustes você volta para qualquer uma. É a rede de segurança caso algo dê errado.",
    route: "/ajustes",
    related: ["app-backup"],
  },
  {
    id: "app-parada",
    topic: "app",
    asks: ["o que significa a etiqueta F", "falha técnica no app", "o que quer dizer sobra 2", "o que é a etiqueta de parada"],
    keys: ["falha tecnica", "etiqueta", "parada", "sobra 2"],
    answer:
      "A etiqueta diz até onde levar a série: F é até a falha, T é falha técnica (parar quando a técnica começar a ceder, com 1 ou 2 repetições sobrando) e R é parar com umas 2 sobrando. Ela muda conforme a semana do ciclo.",
    related: ["rir", "ate-a-falha"],
  },
  {
    id: "app-postos",
    topic: "app",
    asks: ["o que são os postos", "como subir de nível no app", "o que é recruta e veterano", "subir de posto"],
    keys: ["posto", "nivel", "recruta", "veterano", "elite", "patente"],
    answer:
      "O posto sobe com o número de treinos registrados: Recruta, Em calibragem (10), Aumentado (40), Veterano (100) e Elite (200). É só um marcador de constância; aparece no seu perfil e no ranking dos amigos.",
    route: "/progresso",
    related: ["motivacao"],
  },
];

export type GuardTopic = "urgente" | "lesao" | "remedio" | "hormonio" | "transtorno" | "gravidez" | "doenca" | "dieta-restritiva" | "menor";

/** Assuntos que não se respondem aqui: resposta fixa e gentil, que leva a um profissional. */
export const GUARD_REPLY: Record<"urgente" | "geral", string> = {
  urgente:
    "Isso pode ser sério e não dá para avaliar por aqui. Pare o treino e, se for agora, procure atendimento médico (no Brasil, SAMU 192). Depois de avaliado, volte com calma.",
  geral:
    "Esse assunto precisa de alguém que possa te avaliar de perto, como médico, nutricionista ou fisioterapeuta. Eu não respondo sobre isso para não arriscar a sua saúde. Para o resto do treino, pode perguntar.",
};
