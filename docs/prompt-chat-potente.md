# Chat potente: análise e prompt mestre

Pedido do dono em 14/11/2026: levar o chat sem chave (`#/treinador`) ao nível de um assistente de verdade **dentro do
app**: entender frase livre, pedido composto e conversa longa, explicar "por quê", simular "e se", conduzir pedidos
grandes, lembrar do que a pessoa disse, desfazer e responder mais perguntas. Fora deste trabalho: **voz** (adiada até
o dono escolher um motor gratuito melhor) e integração com Siri ou Google Assistente.

Como usar: a Parte 1 é a análise. A Parte 2 é o prompt. Ele está dividido em cinco blocos (A a E); abra uma sessão
nova do Opus na pasta do projeto, cole a Parte 2 inteira e diga qual bloco fazer. Um bloco por sessão, na ordem. O
`CLAUDE.md` entra sozinho.

---

## Parte 1: o que existe e onde quebra

Conferido em `src/lib/core/localchat.ts`, `commands.ts`, `query.ts`, `intents.ts`, `operator.ts` e
`src/screens/Coach.tsx`.

| Hoje                                                                                                                           | Onde quebra                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `coreReply` trata a mensagem inteira como **um** pedido e para na primeira camada que casa                                     | "anota 8 com 80 e começa o descanso" faz só uma das duas coisas, ou nenhuma                                               |
| Comando casa por frase-modelo inteira (`matchCommand` → `templateSet`)                                                         | palavra fora de ordem, enchimento ("tipo", "aí", "né") ou jeito novo de falar cai em "não sei"                            |
| Memória curta: 3 trocas ou 5 minutos (`TTL`, `turns`); resposta pronta apaga `lastKind` e `query`                              | uma pergunta de conhecimento no meio faz o chat esquecer de que exercício se falava; "ele", "esse", "o mesmo" não existem |
| 6 intenções; só `explicar_carga` explica algo, e só a carga do próximo treino                                                  | "por que estagnei?", "por que estou cansado?", "por que menos séries hoje?" não têm resposta com os dados                 |
| `planDay` só é chamado pela intenção de tempo curto                                                                            | "e se eu treinar 3 dias?", "quanto falta para 100 kg no supino?" não existem                                              |
| Pedido incompleto guarda **um** campo em aberto (`PendingCommand`)                                                             | pedido grande ("quero trocar de programa") não tem conversa: vira resposta pronta ou atalho                               |
| `OperatorMemory` guarda restrições com validade e ausências                                                                    | "não gosto de agachamento", "treino em casa com halter" se perdem ao fechar o chat                                        |
| `applyProposal` (`Coach.tsx`) grava e pronto                                                                                   | não há "desfaz"; errou a série pelo chat, tem de ir à tela do treino                                                      |
| Pergunta que cai em "não sei" some                                                                                             | ninguém sabe o que as pessoas perguntam e o chat não aprende quando ela toca na sugestão certa                            |
| 136 respostas prontas, glossário, respostas geradas, 24 comandos, gramática de consultas, papo, saída honesta, travas de saúde | isso funciona e está medido (`chat.test.ts`, `answers.test.ts`); **não refazer**                                          |

O que faz a diferença, em ordem de valor: (1) entender o que a pessoa quis dizer mesmo dito de outro jeito; (2) fazer
mais de uma coisa por frase; (3) não perder o fio; (4) raciocinar com os dados ("por quê", "e se"); (5) lembrar e
desfazer. Mais respostas escritas vem por último: rende menos e aumenta o risco de uma resposta roubar a pergunta de
outra.

---

## Parte 2: prompt mestre

### O que eu quero

O chat sem chave do AUGMENT já responde comandos, consultas aos meus dados, respostas prontas e papo. Quero que ele
vire um assistente potente dentro do app, com as nove capacidades abaixo. Continua **sem modelo de linguagem, sem
rede, sem texto inventado e sem voz**. As decisões de `docs/prompt-chat-local.md` e da Parte 3 de
`docs/prompt-nucleo-vivo.md` continuam valendo. Leia `src/lib/core/localchat.ts` inteiro antes de começar: é o ponto
de entrada (`coreReply`) e a ordem das camadas.

### O que já existe (não refaça)

`coreReply`/`localReply`/`ChatContext`/`CoreProposal` (`localchat.ts`); `templateSet`/`prepare` (`templates.ts`);
`readNumber`/`readLoad`/`readDuration`/`findPeriod` (`readers.ts`); `matchCommand`/`runCommand`/`continuePending`/
`WRITE_COMMANDS` (`commands.ts`); `parseQuery`/`runQuery`/`queryAnswer` (`query.ts`); `detectExercise`/
`detectMuscleWord`/`dataAnswer` (`data-answers.ts`); `findAnswer`/`guardTopic`/`rank` (`answers.ts`);
`matchIntent`/`handleIntent` (`intents.ts`); `explainLoad`/`planDay` (`planner.ts`); `operatorState`/
`OperatorMemory` (`operator.ts`); os conjuntos `chat.golden.ts` e `answers.golden.ts` com os limiares de hoje.

### Bloco A: medir, registrar e entender frase livre

**A0. Medição primeiro.** Antes de mudar qualquer coisa, escreva os conjuntos novos da tabela "Medição" (mais abaixo)
e rode: a maioria vai falhar. Guarde os números de partida no comentário do teste, como em `backtest.test.ts`. Regra
para todos os blocos: **mudança só entra se os conjuntos antigos não piorarem**.

**A1. Registro do que não foi entendido** (`src/lib/core/learned.ts`, puro; gravação em `db.ts`).

- kv `chat-misses`: texto normalizado, camada que respondeu (`none` ou `maybe`), data e contagem. No máximo 200, o
  mais antigo sai. Nunca guarda mensagem que bateu em assunto travado. Entra no backup e **não sobe ao servidor**.
- Script `npm run misses -- backup.json`: lista as perguntas não entendidas, da mais repetida para a menos. É de onde
  saem frases novas para os conjuntos de teste e respostas novas (bloco E).

**A2. Aprender com a pessoa.**

- kv `chat-aliases`: quando a pessoa toca numa sugestão depois de um "você quis dizer" ou de um "não sei", guarde
  "essa frase → essa pergunta". Na próxima vez, a mesma frase (depois de `norm` e do radical) responde direto.
- Apelido de exercício: se `detectExercise` não achou e a pessoa escolheu um exercício na sugestão, o apelido
  ("supinão", "puxada da frente") passa a valer para ela.
- Limites: 300 entradas; nunca para assunto travado; apelido que aponta para comando de gravação continua saindo como
  proposta. "Esquece esse apelido" remove.

**A3. Campos em qualquer ordem** (`src/lib/core/understand.ts`).

- Hoje o comando só casa se a frase inteira bater num modelo. Acrescente um segundo caminho, usado **só quando nenhum
  modelo casou**: extraia da frase tudo o que der (exercício, músculo, carga, reps, duração, período, dia, tela) com
  os leitores que já existem, ache a **palavra de ação** num léxico por comando (anotar: "anota", "registra", "marca",
  "bota", "põe", "fiz", "fechei"; timer: "descanso", "cronômetro", "conta"; e assim por diante) e monte o pedido.
- Pontuação: ação + todos os campos obrigatórios = executa (gravação continua como proposta). Ação sem campo = pedido
  em aberto, como hoje. Campos sem ação clara ou duas ações possíveis = **pergunta com botões** ("Você quer anotar a
  série ou ver o histórico?"). Nunca chute em comando de gravação.
- O mesmo vale para consultas: `parseQuery` aceita os eixos em qualquer ordem e com enchimento no meio.
- Limpeza antes de tudo (em `prepare`): enchimento de fala ("tipo", "aí", "né", "cara", "então", "queria saber", "me
  diz", "sabe me dizer", "será que"), palavra repetida, pontuação solta.
- Números do jeito que se digita: "80x8", "8x80", "3 de 10 com 40", "8 reps 80 quilos". Na dúvida entre carga e reps,
  decida pelo histórico do exercício (reps ≤ 30; carga perto da última) e, se continuar em dúvida, pergunte.
- Um erro de digitação na palavra de ação e no nome do exercício (palavra com 5+ letras e um candidato só).

### Bloco B: pedido composto, contexto longo, desfazer

**B1. Pedido composto** (`splitRequest` em `understand.ts`).

- Quebre em " e ", " depois ", " e também ", vírgula e ponto e vírgula, **só quando cada lado vira sozinho um comando
  ou uma consulta**. "Supino e agachamento", "arroz e feijão", "peito e tríceps" não quebram. No máximo 3 partes.
- Campo que falta numa parte herda da anterior: "anota 8 com 80 no supino e depois 7" (mesmo exercício, mesma carga).
- Mesma consulta com dois alvos ou dois períodos vira **uma** resposta com as duas linhas: "quantas séries de peito e
  de costas essa semana".
- Saída: `CoreReply` ganha `parts` (cada parte com texto, cartão, ação e proposta), na ordem em que foram ditas. As
  propostas saem num cartão só, com a lista e um "Aplicar tudo"; ação sem gravação (timer) roda depois que a pessoa
  confirma, se vier depois de uma gravação, e na hora, se vier sozinha.
- Uma parte em assunto travado trava a mensagem inteira. Uma parte não entendida: faz as outras e diz qual ficou de
  fora.

**B2. Contexto mais longo.**

- Troque "3 trocas ou 5 minutos" por uma **pilha de entidades**: os últimos 5 exercícios, músculos, períodos, métricas
  e dias citados, cada um com a hora. O assunto vale por 10 trocas ou 15 minutos. Resposta pronta, glossário e papo
  **não apagam** a pilha (hoje apagam `lastKind` e `query`); só o pedido em aberto e a proposta aberta expiram como
  hoje.
- Referências: "ele", "esse", "nesse", "o mesmo", "de novo", "o de ontem", "o anterior", "o outro". Troca de um eixo
  só: "e semana passada?", "e de costas?", "e a média?", "e em libras?".
- "Repete" e "de novo" refazem o último comando; "repete com 85" troca só o campo dito.
- Dois candidatos para a referência: em consulta, responde o mais recente e diz qual escolheu; em gravação,
  **pergunta**.
- "Por quê?" logo depois de uma resposta com dados vai para o bloco C com o alvo da resposta anterior.

**B3. Desfazer.**

- Cada proposta aplicada guarda o seu inverso (`inverseOf(proposta, estadoAntes)`, puro): série anotada → limpa a
  série; troca → volta a alternativa anterior; peso → valor anterior ou apaga; ajuste → ajuste anterior; restrição ou
  lembrança → remove. Valem as 5 últimas, por 10 minutos, só na conversa aberta.
- "Desfaz", "volta", "cancela isso", "errei" → mostra **o que** vai ser desfeito e desfaz com um toque. A mensagem
  "Aplicado" ganha um botão "Desfazer".

### Bloco C: "por quê" e "e se"

**C1. Por quê** (`src/lib/core/why.ts`). Cada explicação sai de uma função que já existe; nada de causa sem dado.

| Pergunta                                      | De onde vem                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| por que a carga subiu, baixou ou ficou        | `explainLoad` (hoje só o próximo treino; estenda para qualquer exercício e para a última sessão)                                            |
| por que estagnei / regredi em X               | `stallOf`, `regressionOf` + séries do músculo na semana, sobra média, frequência, check-ins de baixa, peso caindo, `restRatio`, `jointRisk` |
| por que estou cansado / X não recuperou       | `muscleStatus` (com `intensity`), `fatigueAlert`, `effectiveRecoveryHours`                                                                  |
| por que menos séries hoje / por que deload    | `WEEK_RULES`, `setsFor`, `Session.lowDayTrim`, a adaptação de `planDay`                                                                     |
| por que o descanso foi maior                  | o motivo de `restAfter` (`live.ts`)                                                                                                         |
| por que não contou como recorde               | a régua de 1RM (`entryE1rm`, modo "recorde": drop, sobra, mais de 15 reps)                                                                  |
| por que perdi a sequência / o posto não subiu | `weekStreaks`, `rankProgress`                                                                                                               |
| por que esse exercício está no programa       | `EXERCISE_EVIDENCE`, músculos e sinergistas                                                                                                 |

Formato fixo: uma frase de conclusão; até 3 fatores, cada um com o número da pessoa, do mais pesado para o mais leve;
uma linha "o que fazer" apontando para um princípio do Guia (com o nível de evidência) e um atalho. Fator que é só
suspeita diz "provável". Sem dado suficiente: "Não tenho dado para afirmar. O que eu vejo é…" e mostra o que há.

**C2. E se** (`src/lib/core/whatif.ts`). Simulação pura: não grava, não toca em `db.programs`.

| Pergunta                                 | Conta                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| "e se eu treinar só 3 dias?"             | `plannedVolume` por músculo com os dias novos × hoje; quais músculos caem abaixo da faixa; modelo que cabe (`recommendTemplate`) |
| "monta um treino de 40 minutos hoje"     | `planDay` com teto de tempo: cartão com exercícios, séries e duração; proposta de valer só hoje (a restrição que já existe)      |
| "e se eu colocar 5 kg a mais no supino?" | reps esperadas pela curva da pessoa (`personalEpley`) ou pela padrão                                                             |
| "quanto falta para 100 kg no supino?"    | ritmo de `strengthTrend`; só com 4+ sessões; resposta em faixa, com "se o ritmo continuar"                                       |
| "e se eu faltar amanhã?"                 | `planAhead` com o dia deslocado                                                                                                  |
| "e se eu pular o deload?"                | o que o app faz + o princípio do Guia                                                                                            |
| "quanto vou pesar em 2 meses?"           | `weightTrend`, em faixa; sem tendência confiável, diz que falta dado                                                             |

Quando a simulação leva a uma mudança (dias de treino, restrição de hoje), ela sai como proposta, nunca sozinha.

### Bloco D: conversas guiadas e memória do que foi dito

**D1. Conversas guiadas** (`src/lib/core/flows.ts`). Generaliza o `PendingCommand`: roteiro com no máximo 3
perguntas, cada uma com botões de resposta, terminando em proposta ou atalho.

- Roteiros: trocar de programa (dias, experiência, foco → `recommendTemplate` → atalho para o modelo); montar o
  treino de hoje (tempo, equipamento, incômodo → `planDay`); voltei de pausa (quantos dias → `reentryFor`); definir
  meta de peso (`BodyGoal`); incômodo num exercício (onde, em qual, desde quando → restrição de dor; a trava de saúde
  roda antes de cada resposta).
- "Cancela" sai. Pergunta fora do roteiro é respondida e o chat oferece "Continuar de onde paramos"; duas seguidas
  encerram o roteiro. Roteiro expira em 10 minutos.

**D2. Memória longa** (`OperatorMemory`, campo novo opcional `notes`, como foi feito com `absences`).

- Tipos: `dislike` (exercício ou músculo: "não gosto de agachamento"), `prefer` ("prefiro halter"), `fact` ("treino
  de manhã", "treino em casa", "quero focar glúteo"). Cada uma: id, tipo, alvo, a frase original, data, origem.
- **Só grava com confirmação** ("Quer que eu guarde isso?"). Assunto de saúde nunca vira lembrança: vai para a trava
  ou para a restrição de dor que já existe.
- "O que você sabe sobre mim?" lista; "esquece que…" remove. Em Ajustes, uma linha recolhível "O que o núcleo
  guardou" com a lista e o botão de apagar cada uma.
- Efeito: sugestões de troca e "exercícios para {músculo}" não oferecem o que a pessoa não gosta e põem na frente o
  que ela prefere; a resposta diz que levou isso em conta. **`planDay` não muda por gosto**, só por restrição, como
  hoje.
- `sanitizeOperatorMemory` e `mergeOperatorMemory` cobrem o campo novo; backup antigo continua abrindo.

### Bloco E: mais respostas e tela

**E1. Mais respostas, na ordem do que rende.**

1. Mais jeitos de perguntar nas respostas que já existem (`asks`) e sinônimos, guiados pelos erros dos conjuntos.
2. Número da pessoa em mais respostas (`personalInsight`): a de volume mostra as séries dela na semana; a de
   frequência, quantas vezes ela treina o músculo; a de descanso, o descanso real dela.
3. Respostas geradas dos dados, sem texto novo: "o que troca por {exercício}", "qual equipamento", "{exercício} ou
   {exercício}?" (músculos e evidência dos dois lado a lado).
4. Respostas escritas novas **só** para buraco medido (lista do `npm run misses` e erros dos conjuntos). As de
   alimentação e recuperação entram em `docs/respostas-para-revisar.md` para eu aprovar. Não invente "erros comuns" de
   execução: a biblioteca não tem esse dado.

**E2. Tela** (`Coach.tsx`, `16-chat.css`): cartão de proposta com lista e "Aplicar tudo"; botões de resposta dos
roteiros; ficha "Por quê?" embaixo de resposta com dados; botão "Desfazer" na mensagem aplicada; a lista de
lembranças em Ajustes. Regras R1 a R11, setor do treinador, auditoria em 320 a 768 px, texto a 130% e WebKit.

### Inteligência: refinamentos que valem para todos os blocos

O que separa um chat esperto de um que só casa frases. Cada item diz em que bloco entra.

**I1. Escolher a melhor leitura, não a primeira (A).** Hoje a primeira camada que casa responde. Abaixo das travas,
passe a **colher as leituras candidatas** de comandos, intenções, consultas e respostas prontas, cada uma com uma
nota de 0 a 1 (quanto da frase ela explica, quantos campos preencheu, se o alvo existe nos dados da pessoa). A ordem
das camadas vira critério de desempate. Três faixas, com limiares calibrados nos conjuntos:

- nota alta e folga sobre a segunda → responde;
- nota média → responde e mostra numa linha como entendeu ("Entendi: séries de peito, este mês"), com um toque para
  corrigir;
- duas leituras próximas ou nota baixa → pergunta com botões. Em gravação, sempre pergunta.

**I2. Eco do que entendeu (A).** Toda proposta de gravação repete os campos lidos por extenso ("Supino reto, série
3: 8 reps com 80 kg"). Antes de propor, passe por `suspiciousSet` e avise carga ou reps fora do normal, peso do dia já
registrado e treino já encerrado.

**I3. Saber onde a pessoa está (A).** Com treino aberto, o chat usa `liveState`: "anota 8" vale para o exercício em
foco, na próxima série, com a carga sugerida; "próximo", "quanto falta", "qual a próxima série" e "quanto descanso"
respondem do estado ao vivo. Número sem unidade usa a unidade dos ajustes; "cada lado" e "com a barra" seguem
`loadBasis`. Durante o treino a resposta tem **uma linha**; fora dele, a versão completa.

**I4. Filtros, negação e superlativos nas consultas (A).** A gramática ganha: "só" e "sem" ("sem contar
aquecimento", "só compostos", "tirando o supino"), limites ("acima de 80 kg", "com mais de 10 reps"), superlativos e
listas ("qual músculo treinei menos", "meu melhor mês", "os 3 que mais subiram") e comparação entre dois alvos
("supino ou inclinado evoluiu mais?"). Negação de comando ("não anota", "ainda não") nunca executa.

**I5. Tempo como a pessoa fala (A).** Além dos períodos de hoje: "há duas semanas", "nas últimas 3 segundas", "antes
do deload", "desde que voltei" (última retomada), "no ciclo passado" (`mesoHistory`), "desde janeiro", "no fim de
semana". Período impossível ou sem dado diz o que falta.

**I6. Resposta em três partes (C).** Resposta com dados = **o fato** + **o contexto** (comparado com o quê: última
vez, média, recorde, faixa do Guia) + **o próximo passo** (um botão). "Seu recorde no supino é 82,5 kg × 6, há 3
semanas. Desde então ficou em 80. [Por que travou?]". O contexto só entra quando muda a leitura do número.

**I7. Botões gerados do estado, não fixos (C).** As perguntas tocáveis depois de cada resposta saem dos dados: exercício
travado → "Por que travou?"; perto de um número redondo → "Quanto falta para 100 kg?"; músculo abaixo da faixa → "O
que somar para {músculo}?"; véspera do deload → "O que muda no deload?". No máximo 3, sem repetir o que acabou de ser
respondido.

**I8. "Aliás" (C).** Quando a resposta toca num exercício ou músculo que tem um alerta de verdade (estagnação,
regressão, fadiga alta, incômodo registrado), acrescente **uma** linha curta com ele. No máximo uma por resposta e
uma vez por dia por assunto. Sem alerta, nada.

**I9. Mostrar a conta (C).** "Como você chegou nisso?", "de onde saiu esse número?" depois de qualquer resposta com
dados lista o que foi usado: quais treinos, quais séries, qual régua. Cada resposta com dados já guarda esse rastro
(`trace`), que também serve à medição.

**I10. Profundidade sob pedido (E).** "Resumindo", "mais simples", "explica melhor", "mais detalhe" refazem a última
resposta em outro tamanho. Resposta pronta ganha uma versão curta (1 frase) além da atual; a de dados alterna entre o
número e o cartão completo. O padrão segue a experiência declarada no primeiro uso.

**I11. Saber o que sabe (E).** "O que você sabe fazer?", "como eu peço para…?" saem do **registro real** de comandos,
consultas e roteiros, com exemplos montados com os exercícios da pessoa. Comando novo aparece sozinho na lista.

**I12. Resumo sob pedido (C).** "Resumo", "como estou?", "me atualiza" juntam `weeklyReport`, `operatorBrief`, o
próximo treino e o alerta mais importante em até 4 linhas e um cartão.

**I13. Testes de robustez (todos).** Além dos conjuntos: (a) **paráfrase não muda o resultado**: para cada frase dos
conjuntos, gere variações mecânicas (enchimento, ordem dos campos, um erro de digitação, maiúsculas, sem acento) e
exija a mesma leitura em ≥ 95%; (b) **texto aleatório**: 5.000 mensagens geradas por semente nunca derrubam o chat,
nunca gravam e nunca passam por uma trava; (c) toda resposta com número confere com o `trace`.

### Medição (decide se está pronto)

Conjuntos novos em `chat.golden.ts`, escritos como leigo digita no celular, sem copiar frase-modelo nem `asks`:

| Conjunto                                    | Tamanho       | Exigência                                                                                     |
| ------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------- |
| Frase livre (comandos e consultas refeitos) | 150           | pedido certo ≥ 90%; campos certos ≥ 85%; gravação indevida 0                                  |
| Compostos                                   | 60            | todas as partes certas ≥ 85%                                                                  |
| Não compostos com "e" ou vírgula (controle) | 60            | quebrado por engano ≤ 2%                                                                      |
| Conversas de 3 a 6 trocas                   | 40            | referência resolvida ≥ 85%; referência errada em gravação 0 (tem de perguntar)                |
| Por quê                                     | 50            | tipo certo ≥ 85%; cada fator conferido por conta independente; causa sem dado 0               |
| E se                                        | 40            | tipo certo ≥ 85%; número igual ao da conta independente                                       |
| Lembranças                                  | 40            | tipo e alvo certos ≥ 85%; assunto de saúde guardado 0                                         |
| Roteiros                                    | cada um       | termina, cancela, retoma e expira: 100%                                                       |
| Desfazer                                    | cada proposta | aplicar + desfazer devolve o estado exato de antes                                            |
| Conjuntos antigos                           | os de hoje    | nenhum pior: comandos, consultas, papo, fora do escopo, travas 100%, prontas não sequestradas |

Também: mesma entrada → mesma saída; `coreReply` com mediana abaixo de 30 ms no teste; o pacote inicial do
`vite build` não cresce (tudo carrega com a tela do treinador). Ao fim de cada bloco, mostre a tabela e a lista do
que errou.

### Regras duras

- Tudo do `CLAUDE.md`. Nenhuma dependência nova. Sem modelo de linguagem, sem rede, sem voz, sem ditado.
- **Nada grava sem confirmação**, inclusive em pedido composto, roteiro, lembrança e desfazer.
- A trava de saúde e a urgência rodam antes de tudo e em cada parte de um pedido composto.
- Lógica em `src/lib/core/`, pura, sem importar telas, sem ciclo de import novo. Gravação em `db.ts`.
- Nunca altera `db.programs` nem `src/data/templates/ppl.ts`.
- Texto para a pessoa sem jargão ("referência", "entidade", "contexto", "intenção" não aparecem na tela) e sem se
  dizer IA.
- Se os limiares não forem atingidos só com regras, **pare e me mostre os erros**. Não inclua modelo de significado
  no aparelho por conta própria: é decisão minha, depois de ver os números.

### Ordem e entrega

| Bloco | Conteúdo                                                         | Antes de seguir                                      |
| ----- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| A     | medição de partida, registro, apelidos, campos em qualquer ordem | tabela de partida × depois                           |
| B     | composto, contexto longo, desfazer                               | tabela + 5 conversas de exemplo                      |
| C     | por quê, e se                                                    | tabela + uma resposta de cada tipo com os meus dados |
| D     | roteiros, lembranças                                             | tabela + fotos dos roteiros                          |
| E     | mais respostas, tela, auditoria                                  | tabela final, fotos em 320 a 768 px, 130% e WebKit   |

No fim de cada bloco: `npm run check`, `CLAUDE.md` atualizado, `graphify update .`. Sem commit.
