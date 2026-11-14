# Núcleo ao vivo e chat amplo: análise e prompts mestres

Dois pedidos do dono em 14/11/2026: (1) o motor acompanhar o treino ao vivo, com precisão e de forma orgânica, como um
assistente pessoal; (2) o chat sem chave responder muito mais coisa, no estilo da Siri, reaproveitando o que já existe
na internet.

Como usar: a Parte 1 é a análise (leia e corte o que não quiser). As Partes 2 e 3 são prompts independentes: abra uma
sessão nova do Opus na pasta do projeto e cole **uma** delas por sessão. O `CLAUDE.md` entra sozinho.

---

## Parte 1: o que eu encontrei

### 1.1 O motor ao vivo hoje

Conferido em `src/lib/engine.ts` (`liveNudges`), `progression.ts` e `SessionScreen.tsx`:

- O motor **reage**, não antecipa. `liveNudges` olha a última série feita de **um** exercício e devolve recados (8
  regras ao vivo). Não existe um estado da sessão inteira: o que aconteceu no supino não muda nada no crucifixo.
- A carga da próxima série vem da sessão anterior (`suggestNext`). Dentro do treino, a única correção é a regra
  "menos-15", que só age **depois** que a série já caiu abaixo do piso.
- A previsão de reps usa a mesma fórmula para todo mundo e todo exercício (`predictReps`: Epley com constante 30).
- O descanso é fixo: `defaultRest(ex.rest)`. Não importa se a série foi à falha ou sobrou 4.
- O RIR que a pessoa marca é aceito como verdade. Ninguém confere se o "sobrou 2" dela é 2 mesmo.
- Os recados saem como lista no cartão e como toast. Não há fila, prioridade entre exercícios, limite por treino nem
  memória do que já foi dito. A frase é sempre a mesma.
- Não há voz (M15 ficou adiado) e ninguém mede se as previsões do motor acertam.

O AUG.CORE (`operator.ts`, `planner.ts`) já aprende entre sessões (recuperação, articulação, ritmo de descanso). O
buraco é **dentro** da sessão.

### 1.2 O que faz um assistente parecer vivo

Não é falar mais. É: saber o que vem agora, falar uma coisa só, na hora certa, com o número da pessoa, e ficar quieto
quando está tudo no alvo. Em ordem de valor:

1. **Antecipar**: dizer a meta da série antes dela ("8 com 80; da última vez foram 7") e corrigir a carga antes do
   erro, não depois.
2. **Ler o dia**: juntar as primeiras séries de todos os exercícios e concluir "hoje você está 5% abaixo" ou "acima",
   com confiança, e deixar isso valer para o resto do treino.
3. **Conhecer a pessoa**: curva própria de carga × reps, queda própria entre séries, erro próprio no RIR.
4. **Uma voz só**: uma linha no HUD, com fila, prioridade, limite e variação de frase.
5. **Provar**: medir o erro das previsões num teste, antes e depois de cada mudança.

### 1.3 A Siri, de verdade (corrige a premissa)

- A Siri saiu como app em 2010 e no iPhone 4S em outubro de 2011, não em 2007. Ela veio do projeto CALO, do SRI.
- Ela **usava** aprendizado de máquina: reconhecimento de voz e entendimento estatístico, tudo nos servidores da
  Apple. O que ela não tinha era um modelo que escreve texto.
- "Responder qualquer coisa" era, na prática: comandos do aparelho + serviços de terceiros (Wolfram Alpha, Yelp) +
  algumas centenas de respostas de personalidade escritas à mão + a saída "achei isto na web".
- Os projetos de engenharia reversa (Applidium "Cracking Siri", SiriProxy) abriram só o **protocolo** entre o iPhone e
  o servidor. O cérebro nunca esteve no aparelho, então **não existe código da Siri para copiar**. O que dá para
  copiar é a arquitetura e o material aberto abaixo.

A arquitetura, que serve para nós: frase → intenção + campos (exercício, músculo, período, número) → função que
consulta ou age → frase montada por modelo. Quando nada bate: saída honesta.

### 1.4 O que existe pronto e o que vale aproveitar

| Projeto                                                 | O que é                                                                                                | Licença                             | Veredito                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OHF-Voice/hassil` + `home-assistant/intents`           | O "Siri sem modelo" do Home Assistant: frases-modelo com `[opcional]`, `(a\|b)`, `{campo}` e `<regra>` | hassil Apache-2.0; frases CC-BY-4.0 | **Aproveitar a ideia e a sintaxe.** O interpretador é Python: reescreva em TS (pequeno). Existe a pasta `sentences/pt-BR` (hora, data, timers, listas): serve de referência de como brasileiro fala |
| Conversa fiada da Microsoft (`botframework-cli`)        | ~100 situações de papo ("quem é você", "conta uma piada", "você é burro"), com variações, em português | não declarada na página             | **Usar como lista de situações.** Escreva as nossas respostas, na voz do app. Não copie o texto                                                                                                     |
| `aichaos/rivescript-js`                                 | Linguagem de roteiro de chatbot (linha do AIML/ALICE), roda no navegador                               | MIT                                 | Não adotar: acento é "experimental" e o nosso buscador + frases-modelo cobrem o mesmo                                                                                                               |
| `axa-group/nlp.js`                                      | Classificador de intenção treinável, com português                                                     | MIT                                 | Não adotar: pesa no pacote e o BM25 já passa da meta medida                                                                                                                                         |
| `microsoft/Recognizers-Text`                            | Lê números, unidades e datas por extenso, com português, em JS                                         | MIT                                 | Medir o peso. Se passar de ~60 kB no pacote do treinador, escreva um leitor só de pt (número por extenso, kg/lb, "há 2 semanas") e use os casos deles como teste                                    |
| Mycroft Adapt/Padatious, OVOS, Rhasspy, Snips NLU, Leon | Assistentes de voz abertos                                                                             | várias                              | Só ideia: são Python ou servidor                                                                                                                                                                    |
| `@capacitor-community/text-to-speech`                   | Fala do sistema (grátis, offline)                                                                      | MIT                                 | Tem versão 8.0.0 (linha do Capacitor 8)                                                                                                                                                             |
| `@capacitor-community/speech-recognition`               | Ditado do sistema, com resultado parcial e escolha de idioma                                           | MIT                                 | **Conferir** no `package.json` se aceita `@capacitor/core` 8 e testar offline num aparelho: depende do pacote de idioma do celular                                                                  |

Fontes: [Cracking Siri](https://github.com/applidium/Cracking-Siri), [SiriProxy](https://github.com/davidu/SiriProxy),
[CALO no SRI](https://www.sri.com/75-years-of-innovation/75-years-of-innovation-calo-cognitive-assistant-that-learns-and-organizes/),
[hassil](https://github.com/OHF-Voice/hassil), [intents](https://github.com/home-assistant/intents),
[conversa fiada](https://github.com/microsoft/botframework-cli/blob/main/packages/qnamaker/docs/chit-chat-dataset.md),
[rivescript-js](https://github.com/aichaos/rivescript-js), [nlp.js](https://github.com/axa-group/nlp.js),
[Recognizers-Text](https://github.com/microsoft/Recognizers-Text),
[speech-recognition](https://github.com/capacitor-community/speech-recognition),
[text-to-speech](https://npmjs.com/package/@capacitor-community/text-to-speech).

### 1.5 Minha recomendação

- Comece pela **Parte 2, fases 0 a 2** (medição, previsão da próxima série, linha única no HUD). É o que mais muda o
  treino e não depende de nada novo.
- A **Parte 3** é independente e pode rodar em outra sessão. O maior ganho dela não é escrever mais respostas: é a
  **gramática de consultas** (métrica × exercício ou músculo × período × conta), que transforma 12 tipos de pergunta
  sobre os dados em mais de mil, com uma função só.
- Voz adiada: as amostras testadas (Kokoro e Chatterbox pt-BR) não agradaram. Por enquanto, tudo em texto.
- No app, nada de "Jarvis" ou "Siri" (são marcas) nem de "IA": é "o núcleo" e "respostas prontas".

---

## Parte 2: prompt mestre do núcleo ao vivo

### O que eu quero

Durante o treino, o app deve se comportar como um assistente que acompanha cada série: sabe o que vem agora, diz a
meta antes, lê o resultado depois, ajusta descanso e carga com base no que **eu** costumo fazer, e fala pouco. Tudo
local, determinístico, sem rede e sem modelo de linguagem.

### O que já existe (reaproveite; use `graphify explain "nome()"` antes de abrir arquivo)

- `liveNudges`, `restsBefore`, `intensifierPlan`, `ENGINE_RULES` em `src/lib/engine.ts`.
- `suggestNext`, `suggest`, `predictReps`, `overloadOptions`, `backoffWeight`, `entryE1rm`, `historyOf`, `workSets`
  em `src/lib/progression.ts`.
- `operatorState` (`restRatio`, `loadAcceptanceRate`, confiança por variável), `simulateOperator` em
  `src/lib/core/operator.ts`; `explainLoad`, `planDay`, `trimIsolatesForLowDay`, `setFloor` em `planner.ts`.
- `afterSet` (`superset.ts`), `defaultRest`, `rirRange`, `stopFor` (`mesocycle.ts`), `suspiciousSet` (`sanity.ts`).
- Tela: `SessionScreen.onSetDone`, `SessionHud`, `PlanCard`, `ExerciseBlock`, `TimerBar`, `TerminalLog`.

### Fase 0: medir antes de mexer

`src/lib/core/backtest.ts` (puro) + teste. Para cada sessão do histórico, na ordem, o motor só enxerga o passado e
prevê; depois compara com o que aconteceu:

- erro médio (em reps) da 1ª série de cada exercício;
- erro médio das séries 2 em diante;
- quantas vezes a carga sugerida foi a usada (±1 passo).

Rode nos operadores de `simulateOperator` e, por um script (`npm run backtest -- backup.json`, no molde de
`scripts/coach.ts`), num backup real. Guarde os números de hoje como linha de base num comentário do teste. **Toda
fase seguinte só entra se não piorar esses números**; as fases 1 e 4 precisam melhorar o delas.

### Fase 1: prever a próxima série

`src/lib/core/live.ts`, função pura `liveState(session, history, operator, settings, now)` → `LiveState`:

```ts
interface LiveState {
  next?: {
    exId: string;
    setId: string;
    weight: number | null;
    target: [number, number]; // faixa da ficha
    predicted: number | null; // reps previstas nesta carga, hoje
    confidence: number; // 0..1
    restSec: number;
    restWhy?: string; // só quando difere do padrão da ficha
    adjust?: { weight: number; why: string }; // proposta de baixar ANTES da série
  };
  form: { value: number; confidence: number; basis: string[] }; // leitura do dia, −1..+1
  clock: { elapsedMin: number; endsAt: number | null; overCapMin: number | null };
  cue: Cue | null; // fase 2
}
```

- **Queda entre séries**: do histórico do exercício (mesma carga, descanso parecido), aprenda quanto as reps caem da
  série n para a n+1. Poucos dados: use a mediana de todos os exercícios do mesmo tipo (composto ou isolado) e, sem
  isso, um padrão fixo. Mesma técnica de encolhimento que `operator.ts` já usa.
- **Carga antes do erro**: se a previsão cair abaixo do piso da faixa, proponha baixar agora (`backoffWeight`,
  `snapWeight`), como botão no PlanCard. Nunca aplique sozinho. A regra "menos-15" continua como rede de segurança.
- **Descanso que acompanha a série**: dentro da faixa `ex.rest` da ficha. Série até a falha, ou queda de 2+ reps: topo
  da faixa. Isolado com 3+ sobrando: piso da faixa. Nunca abaixo do mínimo da ficha, nunca mais de 30 s acima do topo.
  Quando mudar, o timer mostra o motivo em 4 palavras ("+30 s: foi à falha").
- **Relógio**: previsão de término pelo ritmo real da pessoa (tempo por série e descanso medidos na sessão). Com
  restrição de tempo ativa e atraso, ofereça o corte de `trimIsolatesForLowDay` (pisos e "Desfazer" já existem).

### Fase 2: uma voz só

- `Cue { id, moment: "abertura" | "antes" | "depois" | "descanso" | "troca" | "fim", priority: 0 | 1 | 2 | 3, text,
why? }`. Prioridade: 0 segurança (dor, carga suspeita), 1 correção, 2 meta, 3 registro de fato bom.
- Um **diretor** (`pickCue`) recebe os candidatos (os recados de `liveNudges` viram candidatos, mais os novos) e
  devolve **no máximo um**. Regras: 1 fala por série; teto por treino (calibre nos simulados; ponto de partida: 8);
  o mesmo `id` não repete no treino; conselho ignorado 2 vezes seguidas na mesma sessão não volta nela.
- **Silêncio é o padrão**: série dentro da faixa e do RIR da semana não gera fala nenhuma além da meta da próxima.
- **Variação**: 3 ou 4 jeitos de dizer cada regra, escolhidos por semente (`session.id` + contagem), para o mesmo
  estado dar sempre a mesma frase (determinístico e testável). Toda frase cita um número da pessoa. Tom de
  `docs/aug-core.md`: curto, sem adjetivo vazio, sem jargão.
- `Session.liveLog?: { id: string; at: number; setId?: string; acted?: boolean }[]` guarda o que foi dito e se a
  pessoa seguiu (entra no backup; passe pelo sanitizador). É a memória do diretor e a base da taxa de aceitação.
- Tela: a fala vira **uma linha no `SessionHud`** (setor Operação), com `aria-live="polite"`. Os toasts de recado
  saem; recorde continua com a recompensa de hoje. A lista no cartão vira o histórico do que foi dito, recolhida.
- Momentos: abertura (1 linha: dia, semana, o que muda hoje), antes da série (meta e última vez), depois (só fora do
  alvo), troca de exercício, fim (3 fatos e 1 coisa para a próxima, no `TerminalLog`).

### Fase 3: leitura do dia

- Depois das primeiras séries de trabalho, compare o que saiu com o previsto (reps + sobra) em cada exercício e junte
  num valor só, com confiança que cresce a cada exercício. O check-in entra como ponto de partida.
- Efeito, sempre para o lado seguro: dia abaixo (com confiança ≥ 0,5) → mantém carga nos próximos exercícios do mesmo
  grupo, sem intensificador, e oferece o corte de isolados; dia acima → libera "pode passar do topo", nunca sobe
  carga além da regra de progressão.
- Substitui o recado "abaixo-do-normal" por exercício, que hoje não conversa com o resto do treino.

### Fase 4: conhecer a pessoa

- **Curva própria de carga × reps** por exercício: ajuste a constante de `predictReps` com os pares do histórico,
  encolhendo para 30 com poucos dados. Vale só para **previsão**. A régua de 1RM (`entryE1rm`, recordes, ranking)
  não muda.
- **Erro próprio no RIR**: quando uma série marcada com sobra é seguida, na mesma carga, por uma série até a falha,
  dá para conferir a sobra declarada. Vira `behavior.rirBias` no `OperatorState`, com confiança. Usos: a soma da sobra
  no modo "comparacao" e o limiar do recado "longe-da-falha".
- **Aprender com o que foi ignorado**: taxa de aceitação por tipo de fala (do `liveLog`). Fala que a pessoa nunca
  segue sai do treino e vai para o relatório semanal, uma vez.

### Fase 5: voz (adiada, não implemente)

Decisão do dono em 14/11/2026: a voz fica fora até ele escolher um motor. Foram ouvidas amostras do Kokoro (`pm_alex`)
e do Chatterbox pt-BR e as duas soaram robóticas. Não instale plugin de fala nem de ditado e não gere áudio. As falas
do núcleo são só texto no HUD.

### Ciência

Cada regra nova aponta para um princípio de `science.ts` (`why`). Se o princípio não existir, escreva-o com nível de
evidência honesto e liste em `docs/respostas-para-revisar.md` para eu aprovar. Confira as fontes antes de citar; eu
parti destas, de memória: descanso mais longo rende mais reps e um pouco mais de hipertrofia, com ganho pequeno acima
de ~90 s (meta-análise de Singer e colegas, 2024); as pessoas erram a sobra em cerca de 1 rep, menos perto da falha
(Halperin e colegas, 2022); o número de reps num mesmo percentual do 1RM varia entre pessoas e exercícios (Nuzzo e
colegas, 2024).

### Garantias (teste no molde de `guarantees.test.ts`)

Sob os operadores simulados e muitas combinações: nunca sobe carga além da regra de progressão; descanso nunca abaixo
do mínimo da ficha; no máximo 1 fala por série e o teto por treino; treino todo no alvo → zero falas além das metas;
mesma entrada → mesma saída; pisos de séries respeitados; nada grava em `db.programs`; `ppl.ts` intocado.

### Ordem e entrega

Fases 0 → 1 → 2 primeiro; pare e me mostre a tabela do backtest e as fotos do HUD (320 a 768 px, texto a 130%,
WebKit) antes das fases 3 e 4 (a 5, voz, está adiada). No fim: `npm run check`, `CLAUDE.md` atualizado, `graphify update .`, sem commit.

---

## Parte 3: prompt mestre do chat amplo

### O que eu quero

O chat sem chave (`#/treinador`) hoje responde 6 intenções, 12 tipos de pergunta sobre os dados e 136 respostas
prontas. Quero que ele pareça um assistente: entenda **comandos**, responda **qualquer combinação** de pergunta sobre
os meus dados, tenha **personalidade** no papo e uma **saída honesta** para o resto. Continua sem modelo de linguagem,
sem rede e sem texto inventado. As decisões de `docs/prompt-chat-local.md` continuam valendo.

### O que já existe (não refaça)

`matchIntent`/`handleIntent` (`intents.ts`), `findAnswer`/`guardTopic`/`rank` (`answers.ts`), `detectExercise`/
`matchData`/`dataAnswer` (`data-answers.ts`), `localReply`/`isUrgent`/`personalInsight` (`localchat.ts`), `ANSWERS`
(`data/answers.ts`), o conjunto de teste `answers.golden.ts` e os limiares de `answers.test.ts`.

### Ordem das camadas (a de cima ganha)

1. Urgência e assuntos travados (já existe; não mude).
2. **Comandos** (novo).
3. Intenções (já existe).
4. **Consultas aos dados** (a gramática nova engloba os 12 tipos de hoje).
5. Respostas prontas (já existe; cresce).
6. **Papo** (novo).
7. **Saída honesta** (melhora).

### 1. Frases-modelo (`src/lib/core/templates.ts`)

Interpretador próprio, em TS, da sintaxe do hassil: `[opcional]`, `(a|b)`, `{campo}`, `<regra>`. Compila para
expressões regulares uma vez, na abertura do treinador. Campos com leitor próprio: exercício (`detectExercise`),
músculo (`detectMuscle`), número (algarismo e por extenso até 999, "meia", "e meio"), unidade, duração ("90
segundos", "um minuto e meio"), período ("hoje", "ontem", "essa semana", "mês passado", "em outubro", "últimos 30
dias", "esse ciclo", "esse ano"). Texto sempre passa por `norm` antes. Teste cada leitor com 30+ frases.

### 2. Comandos

Cada comando = frases-modelo + função + frase de retorno. Mínimo:

| Grupo      | Exemplos                                                                              | Efeito                                           |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Navegar    | "abre o histórico", "me mostra o supino", "vai pro treino"                            | atalho tocável para a rota                       |
| Timer      | "descanso de 90 segundos", "para o timer", "mais 30 segundos"                         | `useTimer`                                       |
| Treino     | "começa o treino", "anota 8 com 80", "troca o supino hoje"                            | proposta com confirmação                         |
| Corpo      | "pesei 82,4 hoje"                                                                     | proposta com confirmação (`upsertBodyEntry`)     |
| Contas     | "quanto é 80% de 120", "225 libras em quilos", "1RM de 100 por 5", "anilhas pra 87,5" | resposta na hora (`platesForBarbell`, `setE1rm`) |
| Calendário | "que dia é hoje", "quantos dias pro deload", "quando acaba o ciclo"                   | `weekFor`, `planAhead`                           |
| Ajustes    | "muda pra libras", "liga o som"                                                       | proposta com confirmação                         |

Regra dura: **nada grava sem confirmação** (mesmo formato de `IntentProposal`). Comando com campo faltando pergunta o
que falta e guarda o pedido em aberto ("anota uma série" → "Quantas reps e com quanto?").

### 3. Gramática de consultas (`data-answers.ts`)

Em vez de um tipo por pergunta, quatro eixos que se combinam:

- **métrica**: carga, reps, 1RM estimado, volume (kg), séries, treinos, tempo de treino, peso corporal, sequência;
- **alvo**: exercício, músculo, dia do programa, tudo;
- **período**: os do leitor de período; padrão por métrica (recorde = sempre; séries = esta semana);
- **conta**: último, melhor, média, total, tendência, comparação entre dois períodos, "quando foi".

Uma função `runQuery(q, data)` devolve os números e os modelos de frase montam o texto e o `DataCard`. Exemplos que
passam a funcionar: "quantas séries de peito fiz em outubro", "meu supino subiu esse mês?", "qual exercício mais
evoluiu no ciclo", "quando foi a última vez que treinei perna", "quanto tempo treinei essa semana", "meu melhor
treino do ano". Combinação sem sentido ou sem dado diz o que falta, nunca um número inventado. Use a régua de 1RM do
projeto. Os 12 tipos atuais viram casos dessa gramática e os testes deles continuam passando.

### 4. Respostas prontas: crescer com dados, não à mão

- **Glossário** (`data/glossary.ts`): ~80 termos ("RIR", "drop set", "deload", "1RM", "superset", "cutting") com
  definição de 1 ou 2 frases. Um modelo só ("o que é {termo}", "{termo} é o quê", "{termo}?") responde todos.
- **Por exercício e por músculo**, geradas da biblioteca em tempo de execução: como faz, o que trabalha, o que troca,
  qual equipamento, "exercícios para {músculo}", "quantas séries de {músculo}", "quantas vezes por semana treino
  {músculo}" (de `SCIENCE` e do programa ativo).
- **Por princípio**: cada um dos 48 `PRINCIPLES` ganha pelo menos uma resposta apontando para ele.
- Só depois disso escreva respostas novas à mão, olhando os erros do conjunto de teste. As de alimentação e
  recuperação entram em `docs/respostas-para-revisar.md`.

### 5. Papo (`data/smalltalk.ts`)

- Use a lista de ~100 situações da Microsoft como **roteiro** (saudação, despedida, obrigado, "quem é você", "você é
  um robô", "quantos anos você tem", elogio, xingamento, tédio, piada, "o que você sabe fazer", "tá aí?"). Escreva as
  **nossas** respostas: 2 ou 3 variações por situação, no tom do app (seco, com humor curto, nunca bajulador).
- Sempre que der, a resposta puxa um dado real: "Bom dia. Hoje é Pull, 5 exercícios."; "Boa noite. Peito e tríceps
  ficam prontos amanhã cedo." Sem dado, vai a versão simples.
- Variação por semente (dia + contagem), como no núcleo ao vivo.
- Papo nunca passa por cima de comando, intenção, consulta ou resposta pronta, e nunca responde assunto travado.
- Honestidade: perguntado se é IA, diz que são respostas prontas e contas com os dados do aparelho.

### 6. Saída honesta

Quando nada bate, classifique o tipo de pergunta por palavra (clima, notícia, receita, conta geral, outro app,
assunto pessoal) e responda de acordo, em uma frase, seguida de: 3 perguntas próximas que ele sabe responder; "Levar
a pergunta para outro chat" (já existe); e, com internet, **"Pesquisar na web"**, que abre o navegador do sistema com
a pergunta. Era exatamente a saída da Siri. A pergunta só sai do aparelho quando a pessoa toca, e o botão não aparece
em assunto travado.

### 7. Conversa com memória curta

Estado de até 3 trocas: último exercício, músculo, período e métrica (já há herança de tipo; estenda aos quatro
eixos); correção ("não, o inclinado"); "sim"/"não" respondendo a uma proposta; pedido em aberto esperando campo.
Expira ao trocar de assunto ou depois de 5 minutos.

### Medição (decide se está pronto)

Amplie `answers.golden.ts`, sem copiar frases-modelo nem `asks`, escrevendo como leigo digita no celular:

| Conjunto                       | Tamanho | Exigência                                                      |
| ------------------------------ | ------- | -------------------------------------------------------------- |
| Comandos                       | 80      | intenção certa ≥ 95%; campos certos ≥ 90%; gravação indevida 0 |
| Consultas                      | 100     | os quatro eixos certos ≥ 85%; número errado respondido 0       |
| Papo                           | 60      | situação certa ≥ 85%                                           |
| Respostas prontas (atual)      | 172+    | limiares de hoje: 1ª ≥ 85%, entre 3 ≥ 95%                      |
| Fora do escopo (reclassifique) | 60      | respondido como se soubesse ≤ 5%                               |
| Assuntos travados              | atual   | 100% barrado, inclusive por papo e por comando                 |

Mostre a tabela e a lista do que errou. Confira no `vite build` que o pacote inicial não cresceu: tudo isso carrega
junto com a tela do treinador (lazy).

### Regras duras

- Tudo do `CLAUDE.md`. Nenhuma dependência nova, com uma exceção possível: `Recognizers-Text`, só se pesar menos de
  ~60 kB no pacote do treinador; senão, leitor próprio.
- Frases do `home-assistant/intents` (CC-BY-4.0) servem de referência. Se copiar alguma, registre o crédito em
  `docs/` e na tela de privacidade/créditos. O conjunto da Microsoft é só roteiro: não copie texto.
- Lógica em `src/lib/core/`, sem importar telas, sem ciclo de import novo. Texto para a pessoa sem jargão e sem "IA".
- Tela: regras R1 a R11, setor do treinador, auditoria em 320 a 768 px, 130% e WebKit.

### Ordem e entrega

1. Frases-modelo + leitores + 20 comandos + 30 frases de teste: prove a medição de ponta a ponta e me mostre.
2. Gramática de consultas, mantendo os testes atuais verdes.
3. Glossário e respostas geradas da biblioteca.
4. Papo e saída honesta.
5. Memória curta, tela, auditoria, `npm run check`, `CLAUDE.md`, `graphify update .`. Sem commit.

Entregue a tabela de acerto, a lista de erros, `docs/respostas-para-revisar.md` atualizado e o que ficou de fora.
