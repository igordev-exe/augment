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
    keys: ["ordem", "sequencia", "primeiro", "comecar", "antes", "depois", "pre exaustao", "supino", "crucifixo"],
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
    keys: ["dolorido", "dor tardia", "quebrado", "moido", "sinal", "normal", "acordei"],
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
    keys: ["braco", "biceps", "triceps", "rosca", "testa", "aumentar", "braco fino"],
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
    keys: ["gluteo", "bumbum", "quadril", "elevacao pelvica", "afundo", "bulgaro", "crescer", "hipertrofia"],
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
      "quanto colocar de peso na primeira vez",
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
    keys: ["idade", "idoso", "velho", "anos", "terceira idade", "tarde", "da tempo", "comecar tarde", "comecei", "iniciante"],
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
    keys: ["refeicoes", "frequencia alimentar"],
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
    asks: ["glutamina funciona", "glutamina ajuda a recuperar", "vale tomar glutamina", "glutamina compensa o custo"],
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

  // ---------- App e ciência (ampliação) ----------
  {
    id: "app-fontes",
    topic: "app",
    asks: [
      "quais fontes científicas você usa",
      "quais são suas fontes",
      "de onde vêm as informações do app",
      "qual a base científica do app",
      "em quais estudos você se baseia",
    ],
    keys: ["fontes", "cientificas", "estudos", "referencias", "artigos", "pesquisas", "literatura"],
    answer:
      "As respostas e regras do app vêm de revisões recentes, ensaios clínicos e posicionamentos da ciência do exercício, como o ACSM 2026 e estudos de Pelland, Schoenfeld, Refalo, Singer e Helms. Cada princípio traz o nível de evidência e as citações completas no Guia.",
    route: "/guia",
    related: ["app-guia", "app-treinador-completo"],
  },
  {
    id: "app-guia",
    topic: "app",
    asks: [
      "o que é o guia científico",
      "o que significam evidência, consenso e prática de campo",
      "o que são os níveis de evidência no app",
      "onde vejo os princípios científicos",
    ],
    keys: ["guia", "principios", "niveis", "evidencia", "consenso", "hipotese", "pratica de campo"],
    answer:
      'O Guia reúne os 48 princípios que governam os treinos e as respostas do app, separados pelo peso da prova: Evidência (vários estudos), Consenso (posicionamentos), Prática de campo (uso comum sem teste direto) e Hipótese. Você abre pelo botão flutuante em Exercícios ou pelo botão "Ler mais no Guia".',
    route: "/guia",
    related: ["app-fontes"],
  },
  {
    id: "app-atributos",
    topic: "app",
    asks: [
      "o que é a roda de atributos",
      "como são calculados meus atributos",
      "o que significam força, volume e consistência no progresso",
      "como subir os atributos no app",
    ],
    keys: ["atributos", "roda", "hexagono", "forca", "consistencia", "composicao"],
    answer:
      "A roda de atributos em Progresso resume seis frentes reais do seu histórico: força, volume, consistência, recuperação, intensidade e composição. Cada ponta sobe conforme você registra treinos constantes, cargas, RIR e biometria, sem inventar nota fora dos seus dados.",
    route: "/progresso",
    related: ["app-postos", "app-conquistas"],
  },
  {
    id: "app-conquistas",
    topic: "app",
    asks: [
      "o que são as conquistas do app",
      "como desbloquear os hexágonos no perfil",
      "para que servem as medalhas no perfil",
      "onde vejo minhas conquistas",
    ],
    keys: ["conquistas", "medalhas", "hexagonos", "desbloquear"],
    answer:
      "As conquistas são marcos automáticos do que você já fez: primeiro treino, sequências de semanas, tonelagem acumulada, recordes e uso constante do registro. Os hexágonos aparecem no seu perfil; toque em qualquer um para ver o critério.",
    route: "/perfil",
    related: ["app-postos", "app-atributos"],
  },
  {
    id: "app-relatorio",
    topic: "app",
    asks: [
      "para que serve o relatório da semana",
      "como funciona o relatório do mesociclo",
      "onde vejo quais exercícios estão travados",
      "o que tem no relatório semanal",
    ],
    keys: ["relatorio", "semanal", "estagnacoes", "resumo"],
    answer:
      "O Relatório junta o resumo da sua semana e do ciclo de 7 semanas: treinos feitos vs. planejados, recordes batidos, músculos com pouco volume, esforço (RIR) e exercícios travados há 3 sessões. No fim do ciclo ele também sugere ajustes de volume e trocas de acessórios.",
    route: "/relatorio",
    related: ["app-semanas", "app-recordes"],
  },

  // ---------- Treino e iniciante (ampliação) ----------
  {
    id: "melhorar-treino",
    topic: "treino",
    asks: [
      "como eu posso melhorar meu treino",
      "como melhorar meu treino",
      "dicas para melhorar o treino",
      "como fazer o treino dar mais resultado",
      "o que mais conta para ter resultado no treino",
      "como treinar melhor na academia",
    ],
    keys: ["melhorar", "dicas", "evoluir", "resultados", "otimizar", "eficiente"],
    answer:
      "O que mais melhora o treino são quatro bases simples: somar umas 10 a 20 séries difíceis por músculo na semana, parar a maioria das séries a 1 ou 2 repetições do limite, descansar 1,5 a 3 minutos entre séries e tentar bater uma repetição ou um pouco mais de carga ao longo das semanas. Dormir bem e bater a proteína fecham o pacote.",
    principle: "acsm-2026",
    related: ["series-por-semana", "progressao-carga", "descanso-series"],
  },
  {
    id: "horario-treino",
    topic: "treino",
    asks: [
      "qual o melhor horário para treinar",
      "treinar de manhã ou à noite",
      "qual a melhor hora para ir na academia",
      "treinar à noite atrapalha o sono",
      "horário do treino muda o resultado",
    ],
    keys: ["horario", "hora", "manha", "tarde", "noite", "cedo", "dia"],
    answer:
      "O melhor horário é o que você consegue manter com constância. Para hipertrofia, treinar de manhã, à tarde ou à noite dá resultado parecido quando o treino é o mesmo. Só evite treino muito pesado colado na hora de dormir se perceber que atrapalha o seu sono.",
    level: "evidencia",
    related: ["sono", "treinar-todo-dia"],
  },
  {
    id: "combinar-musculos",
    topic: "treino",
    asks: [
      "quais músculos treinar juntos",
      "como dividir os músculos na semana",
      "posso treinar peito e costas no mesmo dia",
      "peito com tríceps ou peito com bíceps",
      "qual combinação de músculos fazer",
    ],
    keys: ["combinar", "combinacao", "juntos", "peito e costas", "peito e triceps", "mesmo dia"],
    answer:
      "Qualquer combinação funciona se você conseguir manter a qualidade das séries e dar 48 horas antes de treinar o mesmo músculo pesado de novo. Empurrar (peito, ombro, tríceps) e puxar (costas, bíceps), superior/inferior ou corpo inteiro são escolhas práticas porque agrupam músculos que trabalham juntos. Se preferir peito com bíceps ou peito com costas, também funciona.",
    principle: "divisao",
    route: "/programas",
    related: ["melhor-divisao", "frequencia-musculo"],
  },
  {
    id: "mente-musculo",
    topic: "treino",
    asks: [
      "preciso sentir o músculo trabalhar",
      "conexão mente-músculo funciona",
      "não sinto o peito no supino",
      "não sinto as costas na puxada",
      "se não sentir o músculo pegar o treino valeu",
    ],
    keys: ["mente musculo", "sentir", "consciencia", "pegar", "ativacao"],
    answer:
      "Sentir o músculo trabalhar ajuda a acertar a técnica, principalmente em isolados, mas não é obrigatório para crescer. Se a execução está firme, com boa amplitude e chegando perto do limite, o músculo está trabalhando mesmo sem queimar. Para sentir mais as costas ou o peito, controle a descida e pense em puxar pelos cotovelos ou empurrar os braços juntos.",
    level: "evidencia",
    related: ["pump", "cadencia"],
  },
  {
    id: "pegada-fraca",
    topic: "treino",
    asks: [
      "minha mão abre antes de cansar as costas",
      "antebraço cansa antes na puxada ou no terra",
      "como melhorar a força da pegada",
      "barra escorrega da mão no treino",
    ],
    keys: ["pegada", "mao", "antebraco", "escorrega", "dedos", "strap"],
    answer:
      "Se o antebraço e a mão falham antes das costas na remada, puxada ou terra, use strap nas séries mais pesadas para as costas não ficarem subtreinadas. Nas séries leves e no aquecimento, treine sem strap para a pegada continuar evoluindo. Secar bem as mãos ou usar magnésio onde for permitido também ajuda.",
    level: "campo",
    related: ["acessorios", "exercicios-costas"],
  },
  {
    id: "roubar-repeticao",
    topic: "treino",
    asks: [
      "posso roubar nas últimas repetições",
      "dar impulso no exercício atrapalha",
      "fazer rosca roubando funciona",
      "impulso no fim da série vale a pena",
    ],
    keys: ["roubar", "roubando", "impulso", "balancar", "tecnica"],
    answer:
      "Um leve impulso controlado nas últimas repetições de isolados de braço ou ombro não impede o ganho de músculo, mas roubar desde o começo tira o trabalho do músculo-alvo e dificulta saber se você progrediu de verdade. Nos compostos pesados (agachamento, terra, supino, remada), mantenha a técnica limpa e pare quando a postura ceder.",
    principle: "cadencia",
    related: ["cadencia", "ate-a-falha"],
  },
  {
    id: "aquecimento-cardio",
    topic: "treino",
    asks: [
      "preciso fazer esteira antes da musculação",
      "aquecer na bicicleta antes de treinar é necessário",
      "10 minutos de esteira antes do treino ajuda",
      "cardio leve para aquecer antes do peso",
    ],
    keys: ["esteira antes", "bicicleta antes", "cardio antes", "aquecer antes", "aquecimento"],
    answer:
      "Não é obrigatório fazer esteira ou bicicleta antes da musculação. Se você está com frio ou travado, 5 minutos bem leves só para soltar o corpo bastam; o aquecimento que realmente prepara o movimento são 1 a 3 séries leves do próprio exercício antes da carga de trabalho.",
    level: "consenso",
    related: ["aquecimento-series", "alongamento", "cardio"],
  },
  {
    id: "passos-caminhada",
    topic: "treino",
    asks: [
      "quantos passos dar por dia",
      "caminhada ajuda a emagrecer",
      "meta de 10 mil passos funciona",
      "caminhar todo dia queima gordura",
    ],
    keys: ["passos", "caminhada", "caminhar", "10 mil", "sedentario"],
    answer:
      "Caminhar mais durante o dia ajuda muito a gastar energia sem atrapalhar a recuperação dos treinos. Não existe número mágico: sair de 3 ou 4 mil para 7 a 10 mil passos por dia já faz diferença clara na saúde e no emagrecimento, com quase zero cansaço para as pernas.",
    level: "evidencia",
    related: ["cardio", "perder-gordura-ritmo"],
  },
  {
    id: "suor-treino",
    topic: "iniciante",
    asks: [
      "suar muito significa que emagreci",
      "não suo no treino, está errado",
      "suor é gordura queimando",
      "treinar de agasalho para suar mais ajuda",
    ],
    keys: ["suor", "suar", "suando", "transpirar", "agasalho", "calor"],
    answer:
      "Suar é só o corpo tentando esfriar, não gordura saindo. O peso que cai depois de suar muito é água, que volta assim que você beber líquidos. Musculação com descanso adequado faz suar menos que uma corrida no sol e, ainda assim, dá ótimo resultado.",
    level: "evidencia",
    related: ["perder-gordura-ritmo", "agua"],
  },
  {
    id: "musculo-tremendo",
    topic: "iniciante",
    asks: [
      "é normal o músculo tremer no exercício",
      "braço tremendo durante a série",
      "perna tremendo depois do treino",
      "por que eu tremo fazendo força",
    ],
    keys: ["tremer", "tremendo", "tremor", "tremo", "oscilar"],
    answer:
      "É bem comum, principalmente no começo, em exercícios novos ou nas últimas repetições perto do limite, quando os músculos estabilizadores cansam. Conforme você aprende o movimento, o tremor diminui. Se vier junto com tontura, fraqueza forte ou dor na articulação, pare a série.",
    level: "consenso",
    related: ["primeiros-passos", "dia-ruim"],
  },
  {
    id: "postura-treino",
    topic: "iniciante",
    asks: [
      "musculação melhora a postura",
      "treino ajuda a corrigir postura curvada",
      "fico sentado o dia todo, a academia ajuda",
      "fortalecer as costas melhora a postura",
    ],
    keys: ["postura", "corcunda", "curvada", "sentado", "coluna"],
    answer:
      "Ajuda, sim. Fortalecer costas, ombros posteriores, glúteos e abdômen dá suporte para segurar o corpo melhor e reduz incômodos de ficar muito tempo sentado. Só não espere que um exercício sozinho mude tudo fora da academia: variar a posição ao longo do dia continua contando.",
    level: "evidencia",
    related: ["exercicios-costas", "alongamento"],
  },
  {
    id: "exercicio-unilateral",
    topic: "treino",
    asks: [
      "exercício unilateral é melhor que bilateral",
      "fazer com um braço ou os dois juntos",
      "preciso ter exercícios unilaterais no treino",
      "diferença entre unilateral e bilateral",
    ],
    keys: ["unilateral", "bilateral", "um braco", "uma perna"],
    answer:
      "Para ganhar músculo, fazer com um lado de cada vez ou com os dois juntos dá resultado parecido. Os unilaterais são ótimos quando um lado está mais fraco que o outro ou quando você quer mais conforto na articulação; os bilaterais costumam ser mais rápidos porque você termina os dois lados de uma vez.",
    principle: "semg",
    related: ["assimetria", "maquina-vs-livre"],
  },
  {
    id: "peso-livre-barra-halter",
    topic: "treino",
    asks: [
      "halter ou barra, qual é melhor",
      "supino com barra ou com halteres",
      "diferença entre barra e halter",
      "halter cresce mais que barra",
    ],
    keys: ["barra", "halter", "halteres", "diferenca"],
    answer:
      "Os dois constroem músculo igualmente bem. A barra permite usar cargas maiores e subir o peso aos poucos com facilidade; os halteres deixam cada braço livre para achar o ângulo mais confortável para os ombros e cotovelos. Escolha pelo conforto e pelo exercício que você consegue progredir melhor.",
    principle: "equipamento",
    related: ["maquina-vs-livre", "exercicio-unilateral"],
  },

  // ---------- Alimentação (ampliação) ----------
  {
    id: "fontes-proteina",
    topic: "alimentacao",
    asks: [
      "quais alimentos têm mais proteína",
      "boas fontes de proteína",
      "o que comer para bater a proteína",
      "lista de alimentos ricos em proteína",
      "alimentos com proteína barata",
    ],
    keys: ["alimentos", "frango", "ovo", "peixe", "carne", "iogurte", "leite", "queijo", "soja", "proteina"],
    answer:
      "As fontes mais práticas são peito de frango, carnes magras, peixes (como tilápia e atum), ovos, leite, iogurte natural ou grego e queijos magros. Para quem prefere fontes vegetais ou quer variar, soja, tofu, proteína texturizada de soja, feijão, lentilha e grão-de-bico ajudam muito, e o whey ou proteína vegetal fecham o resto.",
    principle: "proteina",
    related: ["proteina-quanto", "whey", "vegetariano"],
  },
  {
    id: "ovos-por-dia",
    topic: "alimentacao",
    asks: [
      "quantos ovos posso comer por dia",
      "comer muito ovo faz mal",
      "preciso tirar a gema do ovo",
      "ovo inteiro ou só a clara para hipertrofia",
      "quantas gramas de proteína tem um ovo",
    ],
    keys: ["ovo", "ovos", "gema", "clara", "colesterol"],
    answer:
      "Um ovo médio tem cerca de 6 g de proteína (metade na clara, metade na gema, onde também estão quase todas as vitaminas). Em pessoas saudáveis, comer alguns ovos por dia (2 a 4, por exemplo) encaixa bem; se for comer muitos e quiser economizar calorias ou gordura, misture ovos inteiros com claras extras. Quem tem alteração no colesterol deve confirmar com o médico.",
    level: "evidencia",
    related: ["proteina-quanto", "fontes-proteina"],
  },
  {
    id: "gordura-dieta",
    topic: "alimentacao",
    asks: [
      "preciso cortar toda a gordura da dieta",
      "quanta gordura comer por dia",
      "azeite e pasta de amendoim engordam",
      "gordura boa na dieta de hipertrofia",
    ],
    keys: ["gordura boa", "gorduras", "azeite", "amendoim", "abacate", "castanha", "lipidio"],
    answer:
      "Não corte toda a gordura: o corpo precisa dela para produzir hormônios e absorver vitaminas. Uma faixa comum fica entre 0,6 e 1 g por kg de peso por dia, vindo de azeite, ovos, castanhas, abacate e carnes. Como a gordura tem mais calorias por grama, controle a porção no olhômetro se o objetivo for emagrecer.",
    level: "consenso",
    related: ["calorias", "perder-gordura-ritmo"],
  },
  {
    id: "fibras-vegetais",
    topic: "alimentacao",
    asks: [
      "preciso comer salada e legumes para crescer",
      "dieta de proteína prende o intestino",
      "importância das fibras na dieta",
      "intestino preso com dieta de academia",
    ],
    keys: ["fibras", "salada", "legumes", "verduras", "intestino", "aveia", "treinar", "quem treina"],
    answer:
      "Fibras não constroem músculo direto, mas mantêm o intestino funcionando, dão saciedade na dieta e ajudam a aproveitar melhor uma alimentação rica em proteína. Inclua frutas, legumes, verduras, feijão ou aveia todos os dias e beba bastante água para evitar intestino preso.",
    level: "consenso",
    related: ["agua", "frutas", "fome-saciedade"],
  },
  {
    id: "sal-sodio",
    topic: "alimentacao",
    asks: ["preciso cortar o sal da comida", "sal dá retenção de líquido", "sódio atrapalha a definição", "sal antes do treino ajuda"],
    keys: ["sal", "sodio", "retencao", "inchaco"],
    answer:
      "Quem treina e não tem pressão alta não precisa zerar o sal. Mudanças bruscas de sal fazem o corpo segurar ou soltar água por alguns dias, mas não criam nem queimam gordura. Tempere a comida de forma normal e constante, e siga orientação médica se tiver hipertensão.",
    level: "consenso",
    related: ["peso-oscila", "agua"],
  },
  {
    id: "refrigerante-zero",
    topic: "alimentacao",
    asks: [
      "posso tomar refrigerante zero na dieta",
      "coca zero engorda ou atrapalha",
      "adoçante atrapalha o emagrecimento",
      "bebida zero calorias pode na dieta",
    ],
    keys: ["refrigerante zero", "coca zero", "adocante", "diet", "zero calorias"],
    answer:
      "Bebidas zero não têm calorias significativas e não atrapalham o emagrecimento nem o ganho de massa quando substituem versões com açúcar. Para muita gente, ajudam a segurar a vontade de doce no cutting. Só não deixe que tomem o lugar da água ao longo do dia.",
    level: "evidencia",
    related: ["doces", "agua"],
  },
  {
    id: "fome-saciedade",
    topic: "alimentacao",
    asks: [
      "sinto muita fome na dieta, o que fazer",
      "como controlar a fome no cutting",
      "alimentos que dão mais saciedade",
      "como emagrecer sem passar fome",
    ],
    keys: ["fome", "saciedade", "vontade de comer", "beliscar"],
    answer:
      "Para sentir menos fome em dieta, priorize alimentos com muito volume e poucas calorias: proteína magra em todas as refeições, legumes, verduras, frutas inteiras, batata cozida e feijão, além de beber bastante água. Cortes muito agressivos de calorias dão mais fome e rebote; perder peso devagar é bem mais fácil de sustentar.",
    level: "evidencia",
    related: ["perder-gordura-ritmo", "fibras-vegetais"],
  },

  // ---------- Recuperação (ampliação) ----------
  {
    id: "estalo-sem-dor",
    topic: "recuperacao",
    asks: [
      "meu joelho estala no agachamento mas não dói",
      "ombro estalando sem dor tem problema",
      "estalo na articulação sem dor é normal",
      "junta estalando durante o treino",
    ],
    keys: ["estalo", "estalando", "estala", "crepitacao", "sem dor", "nao doi"],
    answer:
      "Estalo na articulação sem dor, sem inchaço e sem travar o movimento costuma ser normal e inofensivo, ligado a bolhas de gás no líquido da junta ou tendões deslizando. Aquecer bem com séries leves antes da carga de trabalho costuma diminuir. Se começar a doer, inchar ou travar, pare o exercício e procure avaliação.",
    level: "consenso",
    related: ["dor-articulacao", "aquecimento-series"],
  },
  {
    id: "banho-quente",
    topic: "recuperacao",
    asks: [
      "banho quente depois do treino é bom",
      "água quente ou fria depois da academia",
      "banho morno ajuda a relaxar o músculo",
      "tomar banho quente pós-treino atrapalha",
    ],
    keys: ["banho quente", "agua quente", "banho morno", "chuveiro"],
    answer:
      "Pode tomar banho quente ou morno tranquilo depois do treino: ajuda a relaxar, melhora o conforto e não atrapalha o ganho de massa muscular. O que pode reduzir um pouco os ganhos se feito sempre logo após a musculação é a imersão frequente em água muito gelada.",
    level: "consenso",
    related: ["gelo", "dor-tardia"],
  },
  {
    id: "resfriado-treino",
    topic: "recuperacao",
    asks: [
      "posso treinar resfriado",
      "nariz escorrendo pode ir na academia",
      "resfriado leve atrapalha o treino",
      "treinar com coriza faz mal",
    ],
    keys: ["resfriado", "coriza", "nariz escorrendo", "espirro", "gripe leve"],
    answer:
      'Com sintomas leves só acima do pescoço (nariz escorrendo, espirro), um treino mais leve e curto costuma ser tolerado, desde que você higienize bem os aparelhos. Com febre, dor no corpo, falta de ar ou peito carregado, descanse até melhorar e diga "fiquei doente" aqui para eu proteger sua sequência.',
    level: "campo",
    related: ["dia-ruim", "estresse"],
  },

  // ---------- Treino: variações e biomecânica (expansão 250+) ----------
  {
    id: "supino-reto-vs-inclinado",
    topic: "treino",
    asks: [
      "qual a diferença entre supino reto, inclinado e declinado",
      "supino inclinado trabalha qual parte do peito",
      "preciso fazer supino declinado",
      "qual o melhor ângulo do banco no supino inclinado",
    ],
    keys: ["supino reto", "supino inclinado", "declinado", "peito superior", "inclinacao", "angulo"],
    answer:
      "O supino reto trabalha o peitoral como um todo; o inclinado a 30°–45° dá mais ênfase à parte superior do peito (perto da clavícula). Acima de 45° passa a jogar muito trabalho para o ombro. O declinado não é obrigatório: um bom supino reto ou inclinado já desenvolve bem a parte inferior.",
    level: "evidencia",
    related: ["exercicios-peito", "maquina-vs-livre"],
  },
  {
    id: "crucifixo-vs-supino",
    topic: "treino",
    asks: [
      "supino ou crucifixo faz mais peito",
      "preciso fazer crucifixo além do supino",
      "para que serve o crucifixo se já faço supino",
      "peck deck e supino são a mesma coisa",
    ],
    keys: ["crucifixo", "peck deck", "voador", "isolar peito"],
    answer:
      "O supino trabalha peito, ombro e tríceps juntos e permite cargas mais altas; o crucifixo (ou peck deck) isola o peitoral sem o tríceps cansar antes. Ter os dois ajuda a completar o volume do peito sem sobrecarregar os braços.",
    principle: "reto-femoral",
    related: ["exercicios-peito", "supino-reto-vs-inclinado"],
  },
  {
    id: "agachamento-livre-vs-smith-hack",
    topic: "treino",
    asks: [
      "agachamento livre é melhor que hack ou smith",
      "fazer agachamento no smith funciona igual",
      "hack machine substitui agachamento livre",
      "diferença entre agachamento livre e hack",
    ],
    keys: ["smith", "hack", "agachamento livre", "guiado"],
    answer:
      "Para crescer a coxa e o glúteo, agachamento livre, hack e Smith dão ótimos resultados. O livre exige mais equilíbrio e trabalha mais o tronco e a lombar; o hack e o Smith dão suporte nas costas para você ir mais perto do limite na perna com menos fadiga geral.",
    principle: "estabilidade",
    related: ["maquina-vs-livre", "exercicios-perna"],
  },
  {
    id: "stiff-vs-terra-tradicional",
    topic: "treino",
    asks: [
      "qual a diferença entre stiff, terra romeno e levantamento terra",
      "stiff ou levantamento terra tradicional para posterior",
      "posso trocar o terra pelo stiff ou terra romeno",
      "terra romeno trabalha qual músculo",
    ],
    keys: ["stiff", "terra romeno", "rdl", "levantamento terra", "sumo"],
    answer:
      "O levantamento terra tradicional sai do chão e exige bastante do corpo inteiro, gerando muita fadiga. O terra romeno (RDL) e o stiff começam em pé, mantêm a tensão na parte de trás da coxa e no glúteo e costumam cansar menos para hipertrofia. No terra romeno o joelho dobra um pouco; no stiff fica quase estendido.",
    principle: "estabilidade",
    related: ["terra-coluna", "exercicios-gluteo"],
  },
  {
    id: "puxada-frente-vs-nuca",
    topic: "treino",
    asks: [
      "puxada na frente ou atrás da nuca",
      "pegada aberta ou fechada na puxada trabalha diferente",
      "puxada supinada pega mais bíceps",
      "qual a melhor pegada no pulley costas",
    ],
    keys: ["puxada", "pulley", "nuca", "pegada aberta", "pegada neutra", "supinada"],
    answer:
      "Faça a puxada pela frente do peito, nunca atrás da nuca (que força o ombro à toa). Pegada aberta, neutra (triângulo) ou supinada trabalham bem as costas; a pegada neutra na largura dos ombros costuma ser mais confortável e dá ótima amplitude para a dorsal.",
    level: "consenso",
    related: ["exercicios-costas"],
  },
  {
    id: "remada-curvada-vs-apoiada",
    topic: "treino",
    asks: [
      "remada curvada livre ou remada na máquina com apoio",
      "por que usar remada com apoio no peito",
      "remada baixa no cabo trabalha igual remada curvada",
      "minha lombar cansa na remada curvada",
    ],
    keys: ["remada curvada", "apoio no peito", "remada baixa", "cavalinho"],
    answer:
      "Todas crescem muito bem o meio das costas e a dorsal. A vantagem da remada apoiada no peito ou na máquina é tirar a sobrecarga da lombar, permitindo levar a série perto do limite sem que a coluna canse antes das costas.",
    principle: "estabilidade",
    related: ["exercicios-costas", "maquina-vs-livre"],
  },
  {
    id: "leg-press-posicao-pes",
    topic: "treino",
    asks: [
      "posição dos pés no leg press muda o músculo",
      "pé alto ou pé baixo no leg press",
      "abrir os pés no leg press pega interno da coxa",
      "onde colocar o pé na plataforma do leg press",
    ],
    keys: ["posicao dos pes", "pe alto", "pe baixo", "plataforma", "interno da coxa"],
    answer:
      "Pés mais baixos e próximos na plataforma deixam o joelho dobrar mais e enfatizam o quadríceps; pés mais altos tiram o foco do joelho e aumentam o trabalho do glúteo. Escolha uma altura que permita descer fundo mantendo o quadril apoiado no banco e o calcanhar firme na placa.",
    level: "consenso",
    related: ["leg-press-quadriceps", "exercicios-perna"],
  },
  {
    id: "flexora-sentada-vs-deitada",
    topic: "treino",
    asks: [
      "cadeira flexora sentada ou mesa flexora deitada",
      "qual o melhor exercício para posterior de coxa",
      "por que a flexora sentada cresce mais que a deitada",
      "preciso fazer os dois tipos de flexora",
    ],
    keys: ["flexora sentada", "mesa flexora", "deitada", "isquiotibiais", "posterior"],
    answer:
      "A cadeira flexora sentada deu cerca de 40% a 50% mais crescimento na parte de trás da coxa do que a mesa deitada, porque o quadril dobrado mantém o músculo mais esticado. Se você tem acesso à sentada, priorize ela e complete com um exercício de quadril como o terra romeno ou stiff.",
    principle: "biarticulares",
    related: ["exercicios-perna"],
  },
  {
    id: "elevacao-lateral-cabo-vs-halter",
    topic: "treino",
    asks: [
      "elevação lateral no cabo ou com halter",
      "elevação lateral na polia cresce mais que halter",
      "onde deixar a polia na elevação lateral",
      "melhor jeito de fazer elevação lateral",
    ],
    keys: ["elevacao lateral", "polia", "halter", "deltoide lateral"],
    answer:
      "No halter é muito leve embaixo e pesado só em cima; na polia baixa (na altura da mão ou um pouco acima) já há tensão desde o início do movimento, com o ombro alongado. Os dois funcionam muito bem e dá para alternar os dois na semana.",
    principle: "biarticulares",
    related: ["exercicios-ombro"],
  },
  {
    id: "rosca-direta-vs-martelo-scott",
    topic: "treino",
    asks: [
      "diferença entre rosca direta, rosca martelo e rosca scott",
      "rosca inclinada cresce mais o bíceps",
      "para que serve a rosca martelo",
      "qual a melhor variação de rosca para bíceps",
    ],
    keys: ["rosca direta", "rosca martelo", "rosca scott", "rosca inclinada", "bayesian"],
    answer:
      "Rosca direta e Scott trabalham o bíceps com muita estabilidade; a rosca inclinada e a bayesian no cabo desafiam o bíceps bem alongado atrás do corpo. A rosca martelo (pegada neutra) foca mais no braquial e no antebraço, ajudando a dar volume ao braço como um todo.",
    level: "evidencia",
    related: ["exercicios-braco"],
  },
  {
    id: "triceps-polia-vs-frances",
    topic: "treino",
    asks: [
      "tríceps corda ou tríceps francês acima da cabeça",
      "por que fazer tríceps acima da cabeça",
      "tríceps testa ou pulley qual trabalha mais",
      "cabeça longa do tríceps como trabalhar",
    ],
    keys: ["triceps corda", "triceps frances", "overhead", "cabeca longa", "triceps testa"],
    answer:
      "Exercícios de tríceps com o braço acima da cabeça (francês ou cabo overhead) alongam a cabeça longa do tríceps e deram cerca de 40% mais hipertrofia dela em estudos comparados ao pulley para baixo. O pulley com corda ou barra continua ótimo complemento e poupa os cotovelos.",
    principle: "biarticulares",
    related: ["exercicios-braco"],
  },
  {
    id: "afundo-vs-bulgaro",
    topic: "treino",
    asks: [
      "diferença entre afundo, passada e agachamento búlgaro",
      "agachamento búlgaro pega mais glúteo ou quadríceps",
      "búlgaro é melhor que leg press",
      "como ajustar o passo no búlgaro",
    ],
    keys: ["afundo", "passada", "bulgaro", "unilateral perna"],
    answer:
      "Todos são ótimos exercícios unilaterais para perna e glúteo. No búlgaro o pé de trás apoiado no banco tira ajuda da perna traseira e aumenta o trabalho na perna da frente. Tronco mais ereto e joelho avançando focam o quadríceps; passo um pouco maior inclinando o tronco leve à frente joga mais para o glúteo.",
    level: "consenso",
    related: ["exercicios-gluteo", "exercicios-perna"],
  },
  {
    id: "panturrilha-pe-vs-sentado",
    topic: "treino",
    asks: [
      "panturrilha em pé ou sentada qual fazer",
      "panturrilha sentada trabalha menos que em pé",
      "fazer panturrilha sentado ou no leg press",
      "gastrocnêmio e sóleo na panturrilha",
    ],
    keys: ["panturrilha em pe", "panturrilha sentada", "gastrocnemio", "soleo", "joelho estendido"],
    answer:
      "Fazer panturrilha com o joelho reto (em pé ou no leg press) cresceu muito mais o músculo principal da panturrilha do que fazer sentado (joelho dobrado), mantendo o músculo esticado no fundo e parando em amplitude máxima. Faça quase todo o volume com o joelho estendido.",
    principle: "biarticulares",
    related: ["panturrilha"],
  },
  {
    id: "encolhimento-trapezio",
    topic: "treino",
    asks: [
      "preciso treinar trapézio separado",
      "encolhimento com halteres funciona",
      "remadas já trabalham o trapézio?",
      "como desenvolver o trapézio superior",
    ],
    keys: ["encolhimento", "trapezio"],
    answer:
      "Remadas, puxadas e terra romeno já treinam bastante o trapézio. Se você quer dar destaque à parte superior do trapézio, somar 2 a 4 séries semanais de encolhimento com halteres ou barra (subindo e segurando controlado sem girar os ombros) já resolve.",
    level: "consenso",
    related: ["exercicios-costas"],
  },
  {
    id: "treino-antebraco",
    topic: "treino",
    asks: [
      "preciso treinar antebraço isolado",
      "como ganhar massa no antebraço",
      "rosca punho e rosca inversa valem a pena",
      "meu antebraço é muito fino",
    ],
    keys: ["antebraco", "rosca punho", "rosca inversa", "braquiorradial"],
    answer:
      "Puxadas, remadas e rosca martelo sem strap já trabalham bem o antebraço. Se mesmo assim quiser dar mais volume, adicione no fim do treino de braço ou costas 2 a 3 séries de rosca inversa ou flexão de punho duas vezes na semana.",
    level: "campo",
    related: ["pegada-fraca", "exercicios-braco"],
  },
  {
    id: "lombar-fortalecer",
    topic: "treino",
    asks: [
      "como fortalecer a lombar na academia",
      "banco romano de extensão lombar é bom",
      "exercicios seguros para fortalecer as costas embaixo",
      "preciso treinar lombar separado",
    ],
    keys: ["banco romano", "hiperextensao", "extensao lombar", "lombar fraca"],
    answer:
      "Agachamento, remada livre e terra romeno já fortalecem os músculos da lombar quando feitos com boa postura. Para um reforço direto e seguro, a extensão de tronco no banco 45° (banco romano), subindo apenas até alinhar a coluna e aumentando a carga devagar, funciona muito bem.",
    level: "consenso",
    related: ["terra-coluna"],
  },
  {
    id: "abdutora-gluteo-medio",
    topic: "treino",
    asks: [
      "cadeira abdutora funciona para glúteo",
      "como treinar o glúteo lateral",
      "cadeira abdutora inclinada para frente ou encostada",
      "adutora ou abdutora serve para quê",
    ],
    keys: ["abdutora", "adutora", "gluteo medio", "gluteo lateral", "culote"],
    answer:
      "A cadeira abdutora trabalha o glúteo médio e superior (o contorno lateral do quadril), completando os agachamentos e o hip thrust que focam mais o glúteo máximo. Sentar ereto ou levemente inclinado para frente funciona bem; a adutora trabalha o interno da coxa.",
    level: "consenso",
    related: ["exercicios-gluteo"],
  },
  {
    id: "paralelas-mergulho",
    topic: "treino",
    asks: [
      "paralelas trabalha mais peito ou tríceps",
      "como fazer mergulho nas paralelas para peito",
      "mergulho no banco é bom para tríceps",
      "paralela substitui supino",
    ],
    keys: ["paralela", "paralelas", "mergulho", "dips"],
    answer:
      "As paralelas trabalham fortemente o tríceps, a parte baixa do peito e o ombro anterior juntos. Inclinar o tronco um pouco para frente com os cotovelos levemente abertos joga mais para o peito; ficar mais reto com os cotovelos fechados enfatiza o tríceps. Evite descer além do confortável para o ombro.",
    level: "consenso",
    related: ["exercicios-peito", "exercicios-braco"],
  },
  {
    id: "barra-fixa-evoluir",
    topic: "treino",
    asks: [
      "não consigo fazer nenhuma barra fixa",
      "como aprender a fazer barra fixa do zero",
      "graviton ou elástico na barra fixa funciona",
      "quero aumentar minhas repetições na barra fixa",
    ],
    keys: ["barra fixa", "graviton", "negativa", "excentrica", "pull up"],
    answer:
      "Se ainda não sai nenhuma repetição, comece na puxada alta no pulley até igualar perto do seu peso corporal, e pratique no graviton, com elástico ou apenas segurando a descida bem devagar (3 a 5 segundos) na barra. Quando fizer 1 ou 2 repetições limpas, some várias séries curtas ao longo da semana.",
    level: "campo",
    related: ["exercicios-costas", "peso-corporal"],
  },
  {
    id: "abdominal-tipos-prancha",
    topic: "treino",
    asks: [
      "abdominal supra, infra ou prancha qual escolher",
      "prancha abdominal faz crescer o abdômen",
      "melhor fazer abdominal com peso ou sem peso",
      "quantas repetições fazer no abdominal",
    ],
    keys: ["supra", "infra", "prancha", "abdominal na polia", "roda abdominal"],
    answer:
      "O reto abdominal é um músculo só inteiro: para crescer os gomos, escolha movimentos em que a coluna dobra sob carga progressiva (abdominal na polia com corda, máquina ou elevação de pernas na barra, de 8 a 15 reps). A prancha trabalha resistência e estabilidade, mas evolui pouco em tamanho sem carga extra.",
    level: "evidencia",
    related: ["abdomen-tanquinho"],
  },
  {
    id: "extensora-dor-joelho",
    topic: "treino",
    asks: [
      "joelho incomoda na cadeira extensora",
      "como ajustar a cadeira extensora para não doer o joelho",
      "amplitude segura na extensora para patela",
      "onde colocar o rolo da cadeira extensora",
    ],
    keys: ["extensora", "patela", "femoropatelar", "rolo", "ajuste banco"],
    answer:
      "Alinhe o eixo da máquina ao centro do seu joelho e apoie o rolo logo acima do tornozelo. Se a frente do joelho incomoda ao dobrar muito ou no meio do arco, reduza a amplitude inicial (trabalhando na faixa sem dor, como os últimos 45° até estender) e suba a carga devagar.",
    principle: "dor-femoropatelar",
    related: ["agachamento-joelho", "leg-press-quadriceps"],
  },
  {
    id: "composto-vs-isolado",
    topic: "treino",
    asks: [
      "diferença entre exercício composto e isolado",
      "treino só com compostos basta ou preciso de isolados",
      "quantos isolados devo fazer por músculo",
      "multiarticular ou monoarticular qual cresce mais",
    ],
    keys: ["composto", "isolado", "isolador", "multiarticular", "monoarticular"],
    answer:
      "Compostos (supino, remada, agachamento) mexem várias articulações e resolvem a base do treino rápido. Isolados (elevação lateral, extensora, rosca, tríceps) completam músculos que o composto não trabalha por inteiro, como o reto femoral e o deltoide lateral. Os dois juntos dão o melhor equilíbrio.",
    principle: "reto-femoral",
    related: ["ordem-exercicios", "exercicios-por-treino"],
  },

  // ---------- Treino: metodologia e rotina prática ----------
  {
    id: "cardio-hiit-vs-moderado",
    topic: "treino",
    asks: [
      "HIIT ou caminhada moderada emagrece mais",
      "tiro de corrida ou cardio leve depois do treino",
      "cardio intenso atrapalha a perna",
      "qual a diferença entre HIIT e cardio moderado",
    ],
    keys: ["hiit", "liss", "tiro", "moderado", "intenso"],
    answer:
      "Para perder gordura, os dois funcionam igualmente quando gastam o mesmo total de energia na semana. A caminhada rápida ou bicicleta em ritmo moderado tem grande vantagem na musculação: cansa muito menos as pernas e quase não atrapalha a recuperação do agachamento.",
    level: "evidencia",
    related: ["cardio", "passos-caminhada"],
  },
  {
    id: "cardio-em-jejum",
    topic: "treino",
    asks: ["aeróbico em jejum funciona", "AEJ queima mais gordura", "fazer AEJ logo que acorda", "cardio em jejum vale a pena"],
    keys: ["aej", "aerobico em jejum", "cardio em jejum"],
    answer:
      "Fazer cardio em jejum queima mais gordura naquela hora, mas o corpo compensa no resto do dia: em estudos comparando semanas, perder gordura é igual fazendo em jejum ou depois de comer. Escolha pelo conforto e pelo horário que você consegue cumprir.",
    level: "evidencia",
    related: ["cardio", "antes-do-treino"],
  },
  {
    id: "escada-vs-esteira-bike",
    topic: "treino",
    asks: [
      "escada, esteira inclinada ou bicicleta ergométrica",
      "simulador de escada cresce glúteo",
      "qual o melhor aparelho de cardio para quem treina perna",
      "esteira inclinada é melhor que bicicleta",
    ],
    keys: ["escada", "esteira inclinada", "bicicleta", "ergometrica", "eliptico"],
    answer:
      "Qualquer um dos três funciona muito bem para coração e gasto de energia. A bicicleta tem menos impacto e atrapalha menos a recuperação da coxa e panturrilha; a esteira inclinada gasta bastante sem precisar correr. A escada não substitui musculação para crescer o glúteo, mas soma um ótimo gasto calórico.",
    level: "consenso",
    related: ["cardio", "passos-caminhada"],
  },
  {
    id: "alongar-entre-series",
    topic: "treino",
    asks: [
      "alongar o músculo entre as séries faz crescer",
      "posso alongar no descanso entre séries",
      "alongamento entre séries atrapalha a força",
      "esticar o músculo no intervalo da série funciona",
    ],
    keys: ["entre as series", "no intervalo", "alongar no descanso"],
    answer:
      "Alongar de leve para soltar o corpo não tem problema, mas forçar alongamentos pesados entre as séries costuma cansar mais e reduzir as repetições da série seguinte, sem prova firme de ganho extra. Use o intervalo para respirar e recuperar para empurrar forte na próxima série.",
    level: "consenso",
    related: ["alongamento", "descanso-series"],
  },
  {
    id: "descanso-entre-exercicios",
    topic: "treino",
    asks: [
      "quanto tempo descansar entre um exercício e outro",
      "pausa na troca de aparelho no treino",
      "preciso descansar muito quando mudo de exercício",
      "quanto tempo de intervalo ao trocar de máquina",
    ],
    keys: ["trocar de exercicio", "entre exercicios", "transicao"],
    answer:
      "Descanse o tempo normal da sua última série (uns 2 a 3 minutos se saiu de um exercício pesado) e use 1 série leve rápida se o músculo ou padrão de movimento for novo. Não precisa esperar 5 minutos parando entre aparelhos, nem sair correndo sem fôlego para o próximo.",
    level: "campo",
    related: ["descanso-series", "duracao-treino"],
  },
  {
    id: "piramide-carga-fixa",
    topic: "treino",
    asks: [
      "treino em pirâmide crescente funciona",
      "fazer carga fixa ou ir aumentando o peso a cada série",
      "o que é top set e back off set",
      "melhor manter o mesmo peso em todas as séries",
    ],
    keys: ["piramide", "carga fixa", "top set", "back off", "decrescente"],
    answer:
      "Manter o mesmo peso nas séries de trabalho facilita medir a evolução toda semana. Usar uma série principal mais pesada seguida de séries uns 10%–15% mais leves (top set + back-off) também funciona bem. Evite pirâmide longa onde as primeiras séries são leves demais e longe do limite.",
    principle: "ancora",
    related: ["progressao-carga", "series-por-exercicio"],
  },
  {
    id: "isometria-pico-contracao",
    topic: "treino",
    asks: [
      "segurar 2 segundos contraindo no topo faz crescer mais",
      "pico de contração espremendo o músculo vale a pena",
      "treino só de isometria dá hipertrofia",
      "espremer o músculo no final da repetição ajuda",
    ],
    keys: ["pico de contracao", "isometria", "espremer", "segurar em cima"],
    answer:
      "Fazer uma pausa rápida espremendo no topo não prejudica, mas estudos mostram que a parte mais importante para o músculo crescer é quando ele está esticado sob carga, não encurtado. Isometria parada pura funciona bem menos que o movimento dinâmico completo.",
    level: "evidencia",
    related: ["amplitude", "cadencia"],
  },
  {
    id: "parciais-pos-falha",
    topic: "treino",
    asks: [
      "repetições parciais depois da falha funcionam",
      "continuar a série após falhar",
      "parciais pós-falha aumentam os ganhos?",
      "insistir quando o movimento não sobe mais",
    ],
    keys: ["pos falha", "depois da falha", "parcial pos falha"],
    answer:
      "Fazer meias repetições quando a completa já falhou cansa bastante, mas os dados em pessoas treinadas não provaram vantagem sobre parar na falha normal. Use no máximo na última série de um isolado seguro se gostar da sensação.",
    principle: "parciais-pos-falha",
    related: ["amplitude", "tecnicas-avancadas"],
  },
  {
    id: "pausa-embaixo-alongamento",
    topic: "treino",
    asks: [
      "fazer pausa embaixo no supino ou agachamento",
      "parar no ponto mais baixo do exercício ajuda a crescer",
      "pausa no alongamento aumenta hipertrofia",
      "agachamento pausado dá mais resultado?",
    ],
    keys: ["pausa embaixo", "pausa no alongamento", "pausado"],
    answer:
      "Pausar meio segundo embaixo evita usar o rebote e garante controle e amplitude real no fundo do supino ou agachamento. Porém, segurar 2 ou mais segundos parado não se mostrou superior a uma cadência controlada normal perto da falha.",
    principle: "pausa-alongamento",
    related: ["cadencia", "amplitude"],
  },
  {
    id: "perder-forca-cutting",
    topic: "treino",
    asks: [
      "é normal perder força no cutting",
      "minhas cargas caíram na dieta de emagrecimento",
      "como não perder força enquanto emagreço",
      "por que fiquei mais fraco fazendo dieta",
    ],
    keys: ["perder forca", "carga caiu", "forca no cutting"],
    answer:
      "É comum notar uma queda leve de energia ou menos 1 repetição no fim do cutting, especialmente nos supinos. Para segurar força e massa muscular, mantenha o peso nas séries principais em vez de passar a treinar levinho com muitas reps, bata a proteína alta e evite déficit agressivo demais.",
    principle: "ritmo-perda",
    related: ["perder-gordura-ritmo", "forca-vs-hipertrofia"],
  },
  {
    id: "academia-lotada-revezar",
    topic: "treino",
    asks: [
      "academia cheia, o que fazer nos aparelhos",
      "revezar aparelho atrapalha o treino",
      "todos os aparelhos ocupados no horário de pico",
      "esperar aparelho vago ou trocar no dia",
    ],
    keys: ["lotada", "revezar", "horario de pico", "academia cheia"],
    answer:
      "Pode inverter os exercícios sem peso na consciência quando o aparelho estiver ocupado; o crescimento muscular praticamente não muda com a sequência. Se só falta um aparelho igual do mesmo padrão (ex.: supino máquina em vez de banco com halteres), troque só naquele dia pelo menu do treino.",
    principle: "ordem",
    related: ["ordem-exercicios", "app-trocar-hoje"],
  },
  {
    id: "velocidade-subida-exercicios",
    topic: "treino",
    asks: [
      "subir o peso rápido ou devagar na musculação",
      "fase concêntrica explosiva é melhor",
      "qual a velocidade da subida do exercício",
      "fazer a força de subida rápida dá mais resultado?",
    ],
    keys: ["subida", "concentrica", "explosivo", "cadencia subida"],
    answer:
      "Suba com intenção firme e rápida (mesmo que o peso pesado faça a barra subir devagar de verdade) e segure a descida por 2 a 3 segundos com controle. Tentar empurrar o peso devagar de propósito na subida reduz o recrutamento e o desempenho.",
    principle: "cadencia",
    related: ["cadencia"],
  },
  {
    id: "treino-curto-30-min",
    topic: "treino",
    asks: [
      "só tenho meia hora por dia para treinar",
      "dá para ganhar massa com treino expresso",
      "como montar um treino rápido quando estou sem tempo",
      "pouco tempo na academia dá resultado?",
    ],
    keys: ["meia hora", "treino curto", "sem tempo", "treino expresso", "pouco tempo"],
    answer:
      'Dá, sim. Foque em 3 exercícios compostos (um de empurrar, um de puxar e um de perna) ou faça superséries de músculos opostos (como supino + remada ou bíceps + tríceps), levando 2 a 3 séries difíceis em cada. O app também tem o comando "treino de 30 min" para adaptar o dia.',
    principle: "sistemas-avancados",
    related: ["duracao-treino", "superserie"],
  },
  {
    id: "fadiga-central-pesados",
    topic: "treino",
    asks: [
      "por que agachamento e terra cansam muito mais que máquinas",
      "sinto exaustão no corpo inteiro depois de treino de perna",
      "o que é fadiga sistêmica no treino",
      "por que exercícios livres pesados esgotam mais rápido",
    ],
    keys: ["fadiga sistemica", "exaustao", "cansa mais", "pesado"],
    answer:
      "Exercícios livres pesados com carga sobre a coluna recrutam muitos músculos estabilizadores ao mesmo tempo e exigem muito do coração e da atenção. Máquinas apoiadas geram menos fadiga geral para o mesmo estímulo no músculo-alvo; misturar os dois ajuda a não esgotar a recuperação.",
    principle: "estabilidade",
    related: ["maquina-vs-livre", "overtraining"],
  },
  {
    id: "progressao-salto-grande",
    topic: "treino",
    asks: [
      "os halteres sobem de 2 em 2 kg e fica pesado",
      "o aparelho pula muito peso de uma placa para a outra",
      "como progredir quando o próximo peso da máquina é pesado demais",
      "o salto entre as placas do aparelho é muito grande",
    ],
    keys: ["salto de carga", "placas pesadas", "subir de 5 em 5", "anilha pequena"],
    answer:
      "Quando o próximo peso é um salto grande, fique na carga atual e vá somando repetições (por exemplo, subir de 8 para 12 ou 14 repetições bem feitas). Quando bater o topo com folga, passe para a próxima placa mesmo começando na parte baixa da faixa. Em Ajustes você pode cadastrar exatamente as placas que a máquina tem.",
    principle: "progressao",
    related: ["progressao-carga", "app-pesos-maquina"],
  },
  {
    id: "reps-forca-pura",
    topic: "treino",
    asks: [
      "quantas repetições fazer para força máxima",
      "fazer 1 a 5 repetições serve para quê",
      "treino de 3 repetições pesadas funciona",
      "faixa de repetições para força pura",
    ],
    keys: ["forca maxima", "forca pura", "poucas repeticoes", "3 repeticoes", "baixas repeticoes"],
    answer:
      "Para força máxima em um movimento específico, cargas altas na faixa de 1 a 5 ou 6 repetições (perto de 80%+ do máximo) dão resultado superior a séries leves, mantendo pausas longas de 3 minutos ou mais para não fadigar antes da hora.",
    principle: "carga-faixa",
    related: ["forca-vs-hipertrofia", "quantas-reps"],
  },

  // ---------- Iniciante e situações reais de academia ----------
  {
    id: "tenis-ideal-treino",
    topic: "iniciante",
    asks: [
      "qual tênis usar para treinar na academia",
      "pode fazer agachamento com tênis de corrida",
      "posso agachar descalço ou de meia",
      "tênis reto melhora o agachamento e terra",
    ],
    keys: ["tenis", "calcado", "solado reto", "descalco", "meia"],
    answer:
      "Para agachar e fazer levantamento terra, tênis de solado reto, firme e fino (tipo All Star ou vans, ou tênis específico de treino) dão muito mais estabilidade que tênis macios de corrida com mola/amortecedor alto. Se sua academia permitir e for seguro, fazer sem tênis também dá ótima base.",
    level: "campo",
    related: ["agachamento-joelho", "terra-coluna"],
  },
  {
    id: "calos-mao-pegada",
    topic: "iniciante",
    asks: [
      "como evitar calos na mão pegando barra",
      "onde segurar a barra para não machucar a palma",
      "minha mão arde e faz bolha na puxada",
      "usar luva ou strap evita calo na mão?",
    ],
    keys: ["calo", "calos", "bolha", "palma da mao"],
    answer:
      "Apoiando a barra bem no meio da palma, a pele dobra e belisca na descida da puxada ou terra. Segure a barra mais perto da base dos dedos (na linha onde os dedos encontram a palma) para diminuir bastante os calos. Se incomodar muito nas séries pesadas, luva ou strap aliviam sem atrapalhar.",
    level: "campo",
    related: ["acessorios", "pegada-fraca"],
  },
  {
    id: "enjoo-treino-perna",
    topic: "iniciante",
    asks: [
      "sinto enjoo no treino pesado de perna",
      "estômago embrulhado no leg press ou agachamento",
      "por que fico enjoado treinando perna pesado",
      "mal estar no dia de perna como evitar",
    ],
    keys: ["enjoo", "nausea", "ansia", "passar mal", "perna pesado"],
    answer:
      "Treino intenso de perna puxa muito sangue para as coxas e sobe a demanda do coração; junto de comer muito perto da hora, falta de água ou respiração presa, pode dar enjoo. Descanse 2 a 3 minutos entre séries, respire fundo, beba água aos goles e espere mais tempo após uma refeição grande.",
    level: "campo",
    related: ["respiracao", "descanso-series"],
  },
  {
    id: "espera-pos-almoco",
    topic: "iniciante",
    asks: [
      "quanto tempo esperar depois de almoçar para treinar",
      "treinar de barriga cheia faz mal",
      "tempo de digestão após almoçar antes da academia",
      "almocei pesado, quanto espero para ir malhar",
    ],
    keys: ["almoco", "barriga cheia", "digestao", "almocei"],
    answer:
      "Depois de uma refeição grande, como almoço completo, esperar cerca de 1,5 a 2,5 horas costuma evitar peso no estômago e refluxo durante exercícios de perna e abdômen. Se for apenas um lanche leve (fruta, iogurte ou pão), 30 a 60 minutos antes já costumam cair bem.",
    level: "campo",
    related: ["antes-do-treino", "enjoo-treino-perna"],
  },
  {
    id: "mobilidade-antes-treino",
    topic: "iniciante",
    asks: [
      "preciso fazer mobilidade antes de treinar",
      "exercícios de mobilidade para agachar mais fundo",
      "mobilidade de ombro e tornozelo ajuda no treino",
      "quanto tempo gastar fazendo mobilidade articular",
    ],
    keys: ["mobilidade", "tornozelo", "encurtamento", "profundidade"],
    answer:
      "Se o calcanhar levanta ao agachar ou o ombro trava em cima, 5 minutos de mobilidade específica (tornozelo na parede, agachamento segurando sem peso ou rotações com bastão) ajudam você a alcançar melhor amplitude naquele dia. Não precisa de meia hora de alongamentos genéricos.",
    level: "campo",
    related: ["aquecimento-series", "alongamento"],
  },
  {
    id: "treino-viagem-ferias",
    topic: "iniciante",
    asks: [
      "vou viajar sem academia, como não perder massa",
      "como manter os músculos nas férias",
      "treino mínimo na viagem para manter resultados",
      "quantas séries para só manter o músculo viajando",
    ],
    keys: ["viagem", "ferias", "manter massa", "hotel", "dose minima"],
    answer:
      "Manter músculo exige bem menos do que ganhar: cerca de 4 séries intensas por músculo na semana (mesmo com flexão de braço, barra de parque, agachamento unilateral e elástico) somadas a boa ingestão de proteína seguram quase tudo por várias semanas. Férias de 1 ou 2 semanas quase não tiram massa nenhuma.",
    principle: "volume-dose",
    related: ["voltar-pausa", "treino-em-casa"],
  },
  {
    id: "lombar-cansando-agachamento",
    topic: "iniciante",
    asks: [
      "minha lombar cansa antes da perna no agachamento",
      "como evitar que a lombar puxe todo o peso no agachamento",
      "lombar queimando no leg press e agachamento",
      "coluna cansando no treino de coxa como resolver",
    ],
    keys: ["lombar cansando", "costas no agachamento", "arredondar", "bumbum entrando"],
    answer:
      "Mantenha o tronco firme puxando o ar antes de descer e evite descer até o quadril virar para baixo no fim do movimento. No leg press, desça só até onde o quadril continua colado no encosto. Se a lombar continuar limitando a coxa, use mais o hack machine ou agachamento com halter no peito.",
    level: "consenso",
    related: ["agachamento-livre-vs-smith-hack", "terra-coluna"],
  },
  {
    id: "ombro-pegando-supino",
    topic: "iniciante",
    asks: [
      "sinto muito o ombro no supino em vez do peito",
      "ombro cansa antes do peito no supino",
      "como ajustar os cotovelos no supino",
      "onde descer a barra no peito durante o supino",
    ],
    keys: ["ombro no supino", "angulo cotovelo", "escapula", "banco"],
    answer:
      "Encoste as escápulas para trás e para baixo no banco mantendo o peito alto, e desça com os cotovelos apontados cerca de 45° a 60° em relação ao tronco (nunca totalmente abertos em T a 90°). Baixar um pouco a inclinação do banco ou usar halteres ajuda a achar um ângulo sem incômodo.",
    level: "consenso",
    related: ["mente-musculo", "exercicios-peito"],
  },
  {
    id: "punho-cotovelo-rosca",
    topic: "iniciante",
    asks: [
      "desconforto no punho na rosca direta com barra reta",
      "cotovelo incomoda fazendo tríceps testa",
      "barra W alivia o punho na rosca?",
      "como fazer rosca sem doer o pulso",
    ],
    keys: ["punho", "pulso", "barra w", "testa"],
    answer:
      "A barra reta fixa o punho e o cotovelo num ângulo que incomoda muita gente. Trocar pela barra W, fazer com halteres (que giram livre) ou usar corda na polia resolve na hora na maioria dos casos, sem perder nenhum estímulo no bíceps ou tríceps.",
    level: "campo",
    related: ["rosca-direta-vs-martelo-scott", "triceps-polia-vs-frances"],
  },
  {
    id: "trapezio-elevacao-lateral",
    topic: "iniciante",
    asks: [
      "sinto mais o trapézio e pescoço na elevação lateral",
      "como parar de usar o trapézio na elevação lateral",
      "pescoço tenso fazendo elevação ou abdominal",
      "elevação lateral pegando muito o pescoço o que mudo",
    ],
    keys: ["trapezio tenso", "pescoco", "encolher ombro"],
    answer:
      "Suba os pesos pensando em empurrar as mãos para longe em direção às paredes laterais, não em levantar os ombros até as orelhas, e segure o tronco sem balançar. Usar carga levemente menor com controle na descida resolve rápido; no abdominal, sustente o queixo solto em vez de puxar a cabeça com as mãos.",
    level: "campo",
    related: ["elevacao-lateral-cabo-vs-halter", "mente-musculo"],
  },
  {
    id: "faltei-uma-semana",
    topic: "iniciante",
    asks: [
      "faltei uma semana inteira, diminuo o peso?",
      "voltar depois de 7 dias sem ir",
      "uma semana sem academia muda a carga da barra?",
      "como retomar após faltar uma semana",
    ],
    keys: ["1 semana", "7 dias", "faltei uma semana", "voltar a treinar"],
    answer:
      "Em apenas 5 a 7 dias você quase não perde massa nem força real. Volte com a mesma carga (ou só ~5%–10% mais leve na primeira série para aquecer o ritmo) e pare com 2 repetições na reserva para não ficar dolorido demais na semana seguinte.",
    principle: "inicio-bloco",
    related: ["voltar-pausa", "app-pular"],
  },
  {
    id: "musculo-murcho-pausa",
    topic: "iniciante",
    asks: [
      "parei alguns dias e me sinto murcho",
      "por que o músculo parece menor em poucos dias sem treino",
      "braço parece mais desinchado no cutting",
      "músculo diminuiu rápido em poucos dias sem academia",
    ],
    keys: ["murcho", "desinchado", "glicogenio", "volume celular"],
    answer:
      "Aquele aspecto mais cheio logo após dias de treino vem de água, sangue e reservas de energia (glicogênio) dentro do músculo. Com poucos dias parado ou com menos carboidrato, esse fluido diminui e dá impressão de estar murcho, mas o músculo real não sumiu e volta ao normal em 2 ou 3 treinos.",
    principle: "carboidrato",
    related: ["voltar-pausa", "pump"],
  },
  {
    id: "treinar-ressaca-ontem",
    topic: "iniciante",
    asks: [
      "bebi ontem à noite, posso treinar hoje?",
      "treinar de ressaca faz mal ou adianta",
      "como treinar no dia seguinte depois de beber",
      "academia depois de uma noite bebendo vale a pena",
    ],
    keys: ["ressaca", "bebi ontem", "dia seguinte bebida"],
    answer:
      "Se dormiu pouco e está desidratado, um treino pesado vai render mal e aumentar risco de erro na técnica. Priorize água, comida leve e sono; se quiser se mexer, faça apenas uma caminhada leve ou um treino bem curto e moderado longe do limite.",
    level: "consenso",
    related: ["alcool", "dia-ruim"],
  },
  {
    id: "suplemento-iniciante",
    topic: "iniciante",
    asks: [
      "quem começa na academia já deve tomar suplemento",
      "preciso comprar whey e creatina no primeiro mês",
      "quais suplementos para quem começou agora",
      "iniciante na primeira semana precisa de suplementação",
    ],
    keys: ["primeiro mes", "iniciante suplemento", "comecou agora"],
    answer:
      "No primeiro mês o mais importante é pegar regularidade, dormir bem e ajustar a comida do dia a dia (frango, ovos, arroz, feijão, frutas). Creatina é opcional desde o início e segura, mas nenhum suplemento substitui aprender a treinar e comer proteína suficiente.",
    level: "consenso",
    related: ["primeiros-passos", "suplementos"],
  },
  {
    id: "mulher-recuperacao-reps",
    topic: "iniciante",
    asks: [
      "mulher recupera mais rápido entre séries",
      "quantas repetições mulher consegue fazer na mesma carga",
      "descanso entre séries para mulheres pode ser menor",
      "por que mulheres fazem mais repetições perto do máximo",
    ],
    keys: ["recuperacao mulher", "descanso mulher", "fadiga feminina"],
    answer:
      "Mulheres costumam cansar mais devagar dentro da série e fazer um pouco mais de repetições na mesma porcentagem de carga, podendo usar descansos um pouco mais curtos nos compostos (1,5 a 2,5 min) se recuperarem bem. Entre os dias de treino, a recuperação muscular segue o ritmo normal (48–72 h).",
    principle: "sexos-fadiga",
    related: ["mulher-treino", "descanso-series"],
  },

  // ---------- Alimentação e alimentos brasileiros ----------
  {
    id: "arroz-batata-macarrao",
    topic: "alimentacao",
    asks: [
      "arroz branco, batata doce ou macarrão qual é melhor",
      "arroz integral emagrece mais que arroz branco",
      "batata inglesa ou batata doce na dieta",
      "macarrão atrapalha definir",
    ],
    keys: ["arroz", "batata doce", "batata inglesa", "macarrao", "integral", "carboidrato"],
    answer:
      "Todos funcionam bem para energia e hipertrofia; nenhum engorda ou emagrece sozinho. O que manda é a quantidade de calorias da porção. Batata inglesa cozida costuma saciar bastante com menos calorias por grama do que arroz e macarrão, sendo ótima aliada no cutting.",
    level: "evidencia",
    related: ["calorias", "fome-saciedade"],
  },
  {
    id: "pao-frances-tapioca",
    topic: "alimentacao",
    asks: [
      "posso comer pão francês na dieta",
      "tapioca é melhor que pão francês",
      "pão de manhã engorda ou atrapalha",
      "o que comer no lugar do pão para emagrecer",
    ],
    keys: ["pao", "pao frances", "tapioca", "cuscuz", "cafe da manha"],
    answer:
      "Pode comer pão francês na dieta tranquilamente; calorias por grama dele e da tapioca são parecidas (a tapioca apenas não tem glúten). O segredo é somar uma fonte de proteína (ovos mexidos, frango desfiado ou queijo magro) e não exagerar em manteiga ou requeijão em cima.",
    level: "consenso",
    related: ["calorias", "fontes-proteina"],
  },
  {
    id: "leite-queijo-inflama",
    topic: "alimentacao",
    asks: [
      "leite inflama o corpo ou engrossa a pele",
      "queijo e iogurte atrapalham a definição muscular",
      "tomar leite todo dia faz mal na hipertrofia",
      "laticínios retêm líquido na dieta?",
    ],
    keys: ["leite", "laticinio", "laticinios", "queijo", "iogurte", "inflama"],
    answer:
      "Para quem não tem alergia ou intolerância à lactose, leite, iogurte e queijos não inflamam nem impedem definição muscular. Pelo contrário: têm proteína de ótima qualidade e ajudam muito a bater a meta diária com praticidade.",
    level: "evidencia",
    related: ["fontes-proteina", "whey"],
  },
  {
    id: "pasta-amendoim-aveia",
    topic: "alimentacao",
    asks: [
      "pasta de amendoim engorda ou ajuda na dieta",
      "aveia é boa para emagrecer ou para ganhar massa",
      "quanta pasta de amendoim comer por dia",
      "comer aveia com banana e pasta de amendoim engorda",
    ],
    keys: ["pasta de amendoim", "amendoim", "aveia"],
    answer:
      "A pasta de amendoim é muito calórica (umas 90 kcal por colher de sopa) e pouca proteína por caloria: ótima no bulking para quem precisa comer mais, mas fácil de exagerar no cutting. Já a aveia traz boas fibras e saciedade, entrando bem nos dois objetivos ajustando a quantidade.",
    level: "consenso",
    related: ["gordura-dieta", "dificil-ganhar"],
  },
  {
    id: "banana-caimbra-energia",
    topic: "alimentacao",
    asks: [
      "banana antes do treino dá energia ou evita cãibra",
      "comer banana com aveia pré-treino funciona",
      "banana engorda no cutting",
      "quantas bananas comer por dia na dieta",
    ],
    keys: ["banana", "banana pre treino", "potassio"],
    answer:
      "Banana é uma fonte prática, leve e barata de carboidrato rápido antes ou depois de treinar, ótima para quem treina cedo sem fome para almoço completo. Sobre cãibra, ela quase sempre vem do cansaço muscular, não da falta de potássio da banana.",
    level: "consenso",
    related: ["antes-do-treino", "frutas", "caimbra"],
  },
  {
    id: "carne-porco-atum-sardinha",
    topic: "alimentacao",
    asks: [
      "carne de porco (lombo ou pernil) serve na dieta",
      "atum em lata e sardinha são boas proteínas",
      "preciso comer só frango e ovo para crescer",
      "posso variar frango com patinho ou lombo suíno",
    ],
    keys: ["porco", "lombo", "pernil", "atum", "sardinha", "tilapia", "patinho"],
    answer:
      "Não precisa ficar só no frango. Lombo suíno, filé mignon suíno, patinho, tilápia, atum em lata (de preferência em água no cutting) e sardinha são excelentes fontes completas de proteína. Variar as proteínas torna a dieta muito mais fácil de manter por meses.",
    level: "consenso",
    related: ["fontes-proteina", "proteina-quanto"],
  },
  {
    id: "soja-pts-proteina",
    topic: "alimentacao",
    asks: [
      "proteína de soja dá resultado na musculação",
      "soja faz mal para homem na academia",
      "PTS e tofu servem para hipertrofia",
      "soja atrapalha ganhar massa muscular",
    ],
    keys: ["soja", "pts", "proteina texturizada", "tofu"],
    answer:
      "Os estudos mostram que proteína de soja (PTS, tofu, proteína isolada de soja) ajuda a ganhar força e massa normalmente e não altera os níveis masculinos nem feminiza o homem. É uma opção acessível e com bastante proteína por porção.",
    level: "evidencia",
    related: ["vegetariano", "fontes-proteina"],
  },
  {
    id: "hipercalorico-vitamina",
    topic: "alimentacao",
    asks: [
      "hipercalórico vale a pena para ganhar massa",
      "mass gainer funciona ou engorda muito",
      "como fazer hipercalórico caseiro bom",
      "vitamina caseira para ganhar peso funciona melhor que mass gainer",
    ],
    keys: ["hipercalorico", "mass gainer", "vitamina", "muito magro"],
    answer:
      "Hipercalóricos prontos costumam ser caros e cheios de açúcar simples (maltodextrina) com pouca proteína. Para quem é magro e tem dificuldade de comer, bater leite ou iogurte com banana, aveia, pasta de amendoim e whey sai bem mais nutritivo e mais barato.",
    level: "consenso",
    related: ["dificil-ganhar", "ganhar-massa-comer"],
  },
  {
    id: "cafe-sem-acucar-creatina",
    topic: "alimentacao",
    asks: [
      "café corta o efeito da creatina",
      "posso tomar creatina junto com café",
      "café preto sem açúcar quebra o jejum",
      "cafeína anula a creatina?",
    ],
    keys: ["cafe com creatina", "corta efeito", "cafe sem acucar"],
    answer:
      "Café preto puro praticamente não tem calorias e não atrapalha o jejum nem o emagrecimento. Sobre misturar café e creatina, estudos mais antigos mostraram interferência só com doses altíssimas de cafeína, mas o consumo normal do dia a dia não anula os ganhos da creatina.",
    level: "evidencia",
    related: ["creatina", "cafeina"],
  },
  {
    id: "creatina-retencao-barriga",
    topic: "alimentacao",
    asks: [
      "creatina deixa inchado ou retém líquido na barriga",
      "creatina engorda e tira a definição",
      "posso tomar creatina no cutting para secar",
      "creatina dá retenção hídrica subcutânea?",
    ],
    keys: ["retencao creatina", "inchar", "creatina no cutting", "barriga"],
    answer:
      "Creatina puxa água para dentro das células do músculo (intracelular), não por baixo da pele nem para a barriga: isso deixa o músculo mais cheio e protege a força durante o emagrecimento. Você pode e deve mantê-la no cutting.",
    level: "evidencia",
    related: ["creatina", "peso-oscila"],
  },
  {
    id: "whey-com-agua-ou-leite",
    topic: "alimentacao",
    asks: [
      "tomar whey com água ou com leite",
      "leite no whey atrapalha a absorção",
      "whey com leite no emagrecimento pode?",
      "muda o resultado misturar whey no leite em vez de água",
    ],
    keys: ["whey com leite", "whey com agua", "absorcao whey"],
    answer:
      "Tanto faz para o ganho muscular. Com leite o shake fica mais gostoso, ganha uns 6 a 8 g extras de proteína e dá mais saciedade; a digestão um pouco mais lenta não atrapalha em nada. Com água tem menos calorias e sai mais fácil no cutting.",
    level: "evidencia",
    related: ["whey", "leite-queijo-inflama"],
  },
  {
    id: "whey-esquentar-receita",
    topic: "alimentacao",
    asks: [
      "posso esquentar o whey ou colocar no mingau quente",
      "whey na panqueca perde proteína",
      "cozinhar com whey estraga o suplemento",
      "bater whey no bolo ou café quente funciona?",
    ],
    keys: ["esquentar whey", "cozinhar whey", "mingau", "panqueca whey"],
    answer:
      "Não estraga. O calor muda o formato das proteínas (desnaturação, igual acontece quando você cozinha um ovo ou um bife), mas os aminoácidos continuam lá e seu corpo aproveita exatamente igual.",
    level: "evidencia",
    related: ["whey", "fontes-proteina"],
  },
  {
    id: "catabolizar-horas-sem-comer",
    topic: "alimentacao",
    asks: [
      "ficar 4 horas sem comer faz catabolizar",
      "se eu atrasar o lanche perco músculo",
      "quanto tempo sem comer começa o catabolismo",
      "ficar a tarde toda sem comer perde massa muscular?",
    ],
    keys: ["catabolismo", "catabolizar", "atrasar refeicao", "horas sem comer"],
    answer:
      "O medo de perder músculo por ficar 4 ou 6 horas sem comer é mito. Seu corpo continua digerindo a refeição anterior por horas; se você bate a proteína e as calorias no conjunto do dia e treina bem, um intervalo maior entre refeições não faz perder massa.",
    level: "evidencia",
    related: ["refeicoes-por-dia", "jejum-intermitente"],
  },
  {
    id: "refeicao-liquida-vs-solida",
    topic: "alimentacao",
    asks: [
      "shake ou vitamina substitui refeição sólida",
      "comida sólida emagrece mais que shake",
      "tomar suplemento no lugar do jantar",
      "refeição líquida dá menos saciedade que prato de comida",
    ],
    keys: ["refeicao liquida", "solida", "substituir refeicao"],
    answer:
      "Comida sólida mastigada gera mais saciedade e costuma ser melhor quando você quer controlar a fome no cutting. Refeições líquidas (como vitamina de aveia, fruta e whey) são ótimas aliadas para bater calorias e proteína no bulking ou nos dias sem tempo.",
    level: "consenso",
    related: ["fome-saciedade", "dificil-ganhar"],
  },
  {
    id: "vontade-de-doce",
    topic: "alimentacao",
    asks: [
      "como controlar a vontade de comer doce na dieta",
      "muita vontade de açúcar depois do almoço",
      "dicas para substituir doces no cutting",
      "desejo de doce toda noite na dieta",
    ],
    keys: ["vontade de doce", "desejo doce", "beliscar doce"],
    answer:
      "Garanta proteína suficiente em todas as refeições e inclua frutas doces, iogurte com whey ou gelatina e bebidas zero para aliviar o paladar. Se o corte de calorias estiver apertado demais, a vontade dispara: comer 1 quadradinho de chocolate planejado evita ataques maiores depois.",
    level: "campo",
    related: ["doces", "fome-saciedade"],
  },
  {
    id: "fome-a-noite-jantar",
    topic: "alimentacao",
    asks: [
      "vontade de assaltar a geladeira à noite",
      "por que sinto tanta fome de madrugada",
      "como montar o jantar para saciar à noite",
      "fome noturna depois de jantar o que fazer",
    ],
    keys: ["fome noturna", "geladeira", "jantar leve", "madrugada"],
    answer:
      "Muita gente sente mais fome à noite quando come pouco no café e no almoço, ou quando cansa do dia. Guardar uma parte boa das calorias para um jantar caprichado em proteína e legumes (e beber chá ou água) ajuda muito a dormir satisfeito sem furar a dieta.",
    level: "campo",
    related: ["fome-saciedade", "comer-a-noite"],
  },
  {
    id: "arroz-com-feijao",
    topic: "alimentacao",
    asks: [
      "arroz com feijão todo dia pode na dieta de hipertrofia",
      "feijão engorda ou ajuda no músculo",
      "arroz e feijão atrapalham o emagrecimento",
      "feijão é boa fonte de proteína e fibra?",
    ],
    keys: ["arroz com feijao", "feijao", "leguminosa"],
    answer:
      "Arroz com feijão todo dia é excelente para quem treina: juntos completam os aminoácidos, trazem fibras que seguram a fome no cutting e dão energia limpa para o treino. Basta adequar o tamanho da concha às suas calorias.",
    level: "consenso",
    related: ["arroz-batata-macarrao", "fibras-vegetais"],
  },
  {
    id: "isotonico-agua-coco",
    topic: "alimentacao",
    asks: [
      "preciso tomar isotônico ou água de coco na academia",
      "gatorade ajuda no treino de musculação",
      "eletrólitos são necessários no treino",
      "água de coco durante o treino vale a pena?",
    ],
    keys: ["isotonico", "gatorade", "agua de coco", "eletrolitos"],
    answer:
      "Para um treino normal de musculação de 45 a 90 minutos, água pura já hidrata completamente (o sal e o potássio das refeições dão conta). Isotônicos e água de coco somam açúcar e calorias extras que só fazem diferença em treinos longos de corrida ou suor muito pesado no calor.",
    level: "consenso",
    related: ["agua", "sal-sodio"],
  },
  {
    id: "comer-pouco-metabolismo",
    topic: "alimentacao",
    asks: [
      "comer muito pouco trava o metabolismo",
      "por que emagreço menos quando corto demais as calorias",
      "dieta muito baixa adapta o gasto energético",
      "metabolismo fica lento depois de dieta pesada?",
    ],
    keys: ["trava metabolismo", "adaptacao metabolica", "metabolismo lento", "neat"],
    answer:
      "Cortar calorias demais não desliga a física do corpo, mas reduz bastante quanto você se mexe sem perceber no dia a dia (passos, gesticular) e aumenta a fome, fazendo o gasto cair e a dieta falhar. Por isso déficit moderado (0,4–0,6 kg por semana) sustenta muito melhor o resultado.",
    principle: "ritmo-perda",
    related: ["perder-gordura-ritmo", "plato"],
  },
  {
    id: "dieta-fim-de-semana",
    topic: "alimentacao",
    asks: [
      "como não estragar a dieta no fim de semana",
      "faço dieta de segunda a sexta e não emagreço",
      "como equilibrar as calorias para sair sábado e domingo",
      "o que comer no fim de semana sem perder o foco",
    ],
    keys: ["fim de semana", "sabado e domingo", "segunda a sexta", "sair da dieta"],
    answer:
      "Duas refeições muito calóricas no fim de semana facilmente apagam o déficit pequeno de segunda a sexta. Em vez de largar tudo no sábado, mantenha a proteína e os passos nos mesmos dias, planeje uma refeição mais livre de verdade e volte ao padrão normal logo na refeição seguinte.",
    level: "campo",
    related: ["refeicao-livre", "plato"],
  },
  {
    id: "proteina-limite-30g",
    topic: "alimentacao",
    asks: [
      "o corpo só absorve 30 gramas de proteína por refeição",
      "comer 60g de proteína de uma vez desperdiça",
      "existe limite de proteína por refeição",
      "posso comer 50g de proteína no mesmo prato",
    ],
    keys: ["absorve 30g", "limite por refeicao", "desperdica proteina"],
    answer:
      "Não é verdade que o excesso acima de 30 g é jogado fora: o intestino absorve praticamente tudo, só leva mais tempo digerindo. Dividir em 3 a 5 refeições com cerca de 30 a 55 g cada ajuda a aproveitar melhor durante o dia, mas refeições maiores ainda funcionam.",
    principle: "proteina",
    related: ["proteina-quanto", "refeicoes-por-dia"],
  },
  {
    id: "pre-treino-industrializado",
    topic: "alimentacao",
    asks: [
      "pré-treino comprado em pote vale mais que café",
      "suplemento pré-treino dá mais força ou só energia",
      "vasodilatador e arginina no pré-treino funcionam",
      "citrulina e suplemento pump dão massa muscular?",
    ],
    keys: ["pre treino em po", "vasodilatador", "arginina", "citrulina", "pote"],
    answer:
      "Na maioria dos pré-treinos comprados, quase todo o efeito que você sente vem da cafeína (e o formigamento vem da beta-alanina). Arginina e misturas para pump deixam a veia mais aparente na hora, mas não trazem ganho real que justifique gastar caro: café forte ou cafeína simples entregam quase tudo pelo menor preço.",
    level: "evidencia",
    related: ["cafeina", "beta-alanina", "suplementos"],
  },
  {
    id: "azeite-oleo-airfryer",
    topic: "alimentacao",
    asks: [
      "frango na airfryer ou grelhado com azeite muda na dieta",
      "posso usar óleo de soja ou azeite para cozinhar",
      "azeite esquentado faz mal ou engorda igual",
      "preparar carne com óleo na dieta atrapalha",
    ],
    keys: ["airfryer", "azeite", "oleo", "fritura", "grelhado"],
    answer:
      "Todos os óleos e o azeite têm cerca de 108 a 120 calorias por colher de sopa; preparar na airfryer ou usar pouco azeite só borrifado economiza muitas calorias escondidas sem mudar a proteína da carne. Cozinhar em fogo médio com azeite comum não faz mal.",
    level: "consenso",
    related: ["gordura-dieta", "calorias"],
  },

  // ---------- Recuperação, hábitos e app (expansão) ----------
  {
    id: "sono-pos-treino-exaustao",
    topic: "recuperacao",
    asks: [
      "sinto muito sono depois que volto da academia",
      "por que fico exausto logo após treinar",
      "cansaço forte depois do treino de perna é normal",
      "fico com muita moleza depois que chego do treino",
    ],
    keys: ["sono pos treino", "exausto depois", "moleza depois"],
    answer:
      "Depois de um treino pesado, o corpo ativa o modo de recuperação e muita gente sente uma moleza boa ou sono. Porém, se você apaga de cansaço todo dia de treino, confira se não está dormindo pouco à noite, comendo calorias ou carboidrato de menos, ou acumulando séries demais.",
    level: "campo",
    related: ["sono", "overtraining", "agua"],
  },
  {
    id: "recuperacao-ativa-caminhada",
    topic: "recuperacao",
    asks: [
      "caminhar no dia de descanso tira a dor nas pernas",
      "vale a pena fazer recuperação ativa no dia livre",
      "pedalar leve ajuda o músculo a recuperar mais rápido",
      "mexer o corpo no dia sem academia melhora a rigidez?",
    ],
    keys: ["recuperacao ativa", "tirar dor", "caminhada leve", "soltar perna"],
    answer:
      "Movimento bem leve (caminhada de 20–30 minutos ou bicicleta sem carga) ativa a circulação, alivia a sensação de perna travada no dia seguinte e não atrapalha o ganho de músculo. Só cuide para continuar leve e não virar outro treino pesado.",
    level: "consenso",
    related: ["dias-descanso", "dor-tardia"],
  },
  {
    id: "sol-caminhada-sono",
    topic: "recuperacao",
    asks: [
      "tomar sol e caminhar de manhã ajuda na academia",
      "vitamina D do sol melhora força e sono",
      "falta de luz natural atrapalha dormir e recuperar",
      "pegar sol cedo ajuda a regular o sono",
    ],
    keys: ["sol", "luz natural", "manha", "relogio biologico"],
    answer:
      "Pegar 10 a 20 minutos de sol ou claridade de manhã ajuda a regular o ciclo do sono à noite e a manter níveis bons de vitamina D, dois fatores que melhoram disposição e constância nos treinos.",
    level: "evidencia",
    related: ["sono", "multivitaminico"],
  },
  {
    id: "cigarro-vape-treino",
    topic: "recuperacao",
    asks: [
      "fumar cigarro ou vape atrapalha a musculação",
      "pod e tabaco prejudicam ganhar massa muscular",
      "nicotina tira o fôlego na academia",
      "fumar prejudica o resultado nos treinos",
    ],
    keys: ["cigarro", "vape", "pod", "fumar", "nicotina", "tabaco"],
    answer:
      "Fumar reduz o fôlego durante séries pesadas e prejudica a circulação, a recuperação entre séries e a saúde cardiovascular como um todo. Quem reduz ou larga costuma notar melhora rápida na disposição entre séries de agachamento e no cardio.",
    level: "evidencia",
    related: ["cardio", "respiracao"],
  },
  {
    id: "periodizacao-tipos",
    topic: "treino",
    asks: [
      "o que é periodização linear e ondulatória",
      "preciso de periodização complexa para hipertrofia",
      "diferença entre periodização de força e hipertrofia",
      "vale a pena variar peso e repetições toda semana (ondulatória)",
    ],
    keys: ["periodizacao", "linear", "ondulatoria", "mesociclo"],
    answer:
      "Periodização é organizar cargas e séries ao longo das semanas. Para hipertrofia pura, com o mesmo volume semanal e esforço, periodização simples (mesmo peso e repetições progredindo aos poucos) dá praticamente o mesmo resultado de esquemas complexos; para força máxima, variar cargas ajuda mais.",
    principle: "periodizacao",
    related: ["app-semanas", "progressao-carga"],
  },
  {
    id: "app-calculo-1rm-volume",
    topic: "app",
    asks: [
      "como o app calcula o 1RM estimado",
      "por que o app conta meia série nos exercícios",
      "o que é tonelagem e volume fracionado no app",
      "como o app conta séries indiretas de bíceps e tríceps",
    ],
    keys: ["1rm estimado", "meia serie", "fracionado", "tonelagem", "formula"],
    answer:
      "O 1RM estimado usa peso e repetições feitas (até 15 reps) para comparar treinos mesmo quando você muda a faixa de reps. A tonelagem é peso × repetições × séries. Já o volume fracionado conta 1 série para o músculo principal e 0,5 para músculos auxiliares (como tríceps no supino).",
    principle: "volume-fracionado",
    route: "/progresso",
    related: ["app-recordes", "series-por-semana"],
  },
  {
    id: "app-calculadora-anilhas",
    topic: "app",
    asks: [
      "o chat calcula quanto colocar de cada lado da barra",
      "tem calculadora de anilhas e conversão de libras no app",
      "como converter lb para kg no treino",
      "como saber quanto de anilha montar na barra aqui no app",
    ],
    keys: ["anilhas", "cada lado", "converter", "porcentagem"],
    answer:
      'Sim, aqui mesmo no chat você pode pedir contas diretas como "anilhas para 80 kg", "100 lb em kg", "80% de 120" ou "1RM de 90 por 6" e o app calcula na hora sem precisar de calculadora fora do treino.',
    route: "/treinador",
    related: ["app-unidade", "app-pesos-maquina"],
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
