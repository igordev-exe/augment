# Prompt mestre: treinador que responde sem chave

Como usar: abra uma sessão nova do Opus na pasta do projeto e cole tudo o que está abaixo da linha. O `CLAUDE.md` do
projeto já entra sozinho na sessão; este texto só acrescenta o que ele não diz.

---

## O que eu quero

Hoje o treinador (`#/treinador`) só conversa de verdade com quem tem chave da Anthropic. Sem chave, ele responde 6
pedidos por palavra-chave (`src/lib/core/intents.ts`) e, para o resto, não responde nada (`Coach.tsx`, função `send`:
`if (!config?.apiKey) return`).

Quero que **qualquer pessoa, sem chave, sem conta e sem internet**, consiga tirar dúvidas simples de treino,
alimentação, recuperação e uso do app, e perguntar sobre os próprios dados ("qual meu recorde no supino?"). Não é um
modelo de linguagem: é um buscador de respostas prontas, escritas por nós, mais respostas montadas com os dados que o
app já guarda. Nenhum texto é inventado na hora. Quando não souber, ele diz que não sabe.

O público é leigo. Vale mais responder bem 150 perguntas comuns do que responder mal qualquer coisa.

## Decisões já tomadas (não reabra)

- **Nada de modelo no aparelho.** Pesquisei: modelo pequeno pesa de 250 MB a 1 GB, o WebGPU no WebView do Android não
  é garantido, e modelos abaixo de 7B usam mal o texto que recebem para se apoiar (arXiv 2603.11513). Para conselho de
  saúde, resposta inventada é pior que "não sei".
- **Nada de embeddings no aparelho.** O menor modelo multilíngue bom passa de 100 MB. Com poucas centenas de respostas,
  busca por palavras com radical, sinônimos e tolerância a erro de digitação resolve, e dá para medir.
- **A fase 1 não usa rede.** Zero chamadas novas ao servidor. O modelo online é a fase 2 (no fim deste texto) e só
  começa quando a fase 1 passar na medição: ele depende do buscador e é a reserva quando a cota acaba.
- As 6 intenções atuais continuam valendo e **vêm primeiro**. Não mude o comportamento delas.
- Quem tem chave continua com o fluxo de hoje: resposta local primeiro, com "Perguntar ao treinador mesmo assim".

## O que já existe e deve ser reaproveitado

Use o graphify (`graphify explain "nome()"`) antes de abrir arquivo. Pontos de partida:

- Conhecimento: `PRINCIPLES` (48, com `EvidenceLevel`), `AUDITS` e `EXERCISE_EVIDENCE` em `src/data/science.ts`;
  `ENGINE_RULES` e `DIET` em `src/lib/engine.ts`; `WEEK_RULES` em `src/lib/mesocycle.ts`; a biblioteca (34 curados +
  569 estendidos, nome em português e em inglês).
- Dados da pessoa, já prontos para consulta: `toolPlan`, `toolWeekReport`, `toolMesoReport`, `toolBodyLog`,
  `toolExerciseHistory`, `toolSessions` em `src/lib/coach/context.ts`; `recordsOf`, `entryE1rm` (modo "recorde"),
  `weeklyVolume`, `planAhead`, `weekFor`, `muscleStatus`/`readiness`, `weightTrend`, `goalStatus`, `bodyAdvice`,
  `weekStreaks`, `rankProgress`, `operatorState`.
- Texto: `norm`, `hasWord`, `detectMuscle` em `intents.ts` (exporte o que precisar em vez de copiar).
- Saída de emergência: `coachHandoffText` (documento para colar em outro chat).

Atenção: o conteúdo de **alimentação é ralo** hoje (o princípio `proteina`, um trecho sobre recomposição e as
constantes de `DIET`). A maior parte das respostas de alimentação vai ser escrita agora.

## O que construir

### 1. Base de respostas (`src/data/answers.ts`)

Um registro por resposta. Sugestão de formato (ajuste aos tipos reais):

```ts
interface Answer {
  id: string;
  topic: "treino" | "alimentacao" | "recuperacao" | "exercicio" | "app";
  asks: string[]; // 4 a 8 jeitos de perguntar, do jeito que um leigo digita
  keys?: string[]; // termos e sinônimos que não aparecem nas perguntas
  answer: string; // 2 a 5 frases curtas, sem jargão, em pt-BR
  level?: EvidenceLevel; // obrigatório em treino, alimentação e recuperação
  principle?: string; // id em PRINCIPLES: vira "Ler mais" no Guia
  route?: string; // atalho para uma tela do app
  related?: string[]; // ids de outras respostas, viram sugestões
}
```

- **Não duplique texto**: resposta que já existe em `PRINCIPLES`, `AUDITS` ou `ENGINE_RULES` aponta para a origem; o
  registro só acrescenta as `asks` e, se o texto original for técnico demais, uma versão curta em linguagem simples.
- Meta: **150 a 200 respostas**. Divisão aproximada: treino 60, alimentação 40, recuperação e sono 20, uso do app 30,
  dúvidas de iniciante ("quanto tempo até ver resultado", "posso treinar todo dia") 20.
- Alimentação fica no geral: proteína por kg, superávit e déficit, ritmo de ganho e perda, creatina, cafeína, água,
  refeição antes e depois do treino, álcool, suplementos comuns. Sempre faixa, nunca cardápio. Cada resposta nova de
  alimentação leva `level` honesto e entra numa lista para **eu revisar** antes de publicar (ver "Entrega").
- **Assuntos que não se respondem**: dor forte, lesão, tontura, remédio, dose de anabolizante ou hormônio, transtorno
  alimentar, gravidez, doença, dieta muito restritiva, menor de idade. Para esses, uma resposta fixa e gentil que
  manda procurar profissional. A detecção desses assuntos vem **antes** da busca e ganha dela.
- Respostas sobre exercício ("como faz", "o que trabalha", "o que troco por") saem da biblioteca em tempo de execução,
  não de registros escritos à mão.

### 2. Buscador (`src/lib/core/answers.ts`, puro, sem importar telas)

- Normalização (`norm`), lista de palavras vazias em português, radical leve (plural, gênero, conjugações comuns: não
  precisa ser o RSLP inteiro) e uma tabela de sinônimos e gírias ("massa" e "hipertrofia", "secar" e "perder gordura",
  "perna" e "quadríceps", "supino" e "bench").
- Pontuação BM25 com peso por campo (`asks` > `keys` > `answer`) e tolerância a 1 erro de digitação em palavras com 5
  letras ou mais.
- Implementação própria (umas 200 linhas) ou a biblioteca MiniSearch (MIT, sem dependências). Escolha **medindo** o
  acerto no conjunto de teste e o peso no pacote; registre a escolha num comentário.
- Reconhecimento de entidade: exercício (nome em pt ou en, do programa ativo primeiro, depois da biblioteca) e músculo
  (`detectMuscle`). Guarde a última entidade da conversa para continuações ("e no agachamento?").
- Três saídas, com limiares **calibrados no conjunto de teste**, não chutados:
  1. confiante: responde;
  2. em dúvida (primeiro e segundo colocados próximos): "Você quis dizer…" com 2 ou 3 opções tocáveis;
  3. não achou: diz que não sabe, sugere 3 perguntas próximas e oferece levar a pergunta para outro chat.
- O índice é montado na primeira abertura do treinador (a tela já é lazy). Confira no `vite build` que o pacote
  inicial não cresceu.

### 3. Respostas com os dados da pessoa

Perguntas que o buscador encaminha para uma função, com resposta montada por modelo de frase. Mínimo:

| Pergunta                            | De onde vem                                               |
| ----------------------------------- | --------------------------------------------------------- |
| recorde ou 1RM num exercício        | `recordsOf`, `entryE1rm` modo "recorde"                   |
| última vez e evolução num exercício | `toolExerciseHistory`                                     |
| séries da semana por músculo        | `weeklyVolume`                                            |
| próximo treino, "quando treino X"   | `planAhead`                                               |
| em que semana estou e o que muda    | `weekFor`, `WEEK_RULES`                                   |
| "posso treinar X hoje?"             | `muscleStatus`, `readiness`                               |
| peso: tendência e meta              | `weightTrend`, `goalStatus`, `bodyAdvice`                 |
| "quanta proteína eu devo comer?"    | último peso do `bodyLog` × a faixa do princípio           |
| "como foi minha semana?"            | `weeklyReport`                                            |
| sequência e posto                   | `weekStreaks`, `rankProgress`                             |
| "o que troco pelo exercício X?"     | biblioteca: mesmos músculos, equipamento que a pessoa tem |
| "como faz o exercício X?"           | biblioteca + atalho para `#/exercicios/:libId`            |

Sem dado suficiente, a resposta diz o que falta ("registre o peso em Progresso para eu calcular"), nunca um número
inventado. Use sempre a régua de 1RM do projeto; nada de `e1rm` direto.

### 4. Tela (`src/screens/Coach.tsx`)

- Sem chave, o chat passa a ser a tela principal; a configuração da chave vira um convite discreto ("Ligar o treinador
  completo"), não uma barreira.
- Cada resposta mostra: o texto, a etiqueta do nível de evidência quando houver, "Ler mais" (Guia ou tela) e até 3
  sugestões relacionadas.
- Tela vazia: 6 a 8 perguntas de exemplo tocáveis, misturando conhecimento e dados da pessoa.
- Seja honesto no rótulo: é resposta pronta, não inteligência artificial. Nada de "IA", "modelo", "base de
  conhecimento" no texto para a pessoa.
- As respostas entram no histórico do chat no mesmo formato das intenções de hoje.
- Regras R1 a R11, setor do treinador, kit Figma como referência. Meça em 320, 360, 375, 390, 412 e 768 px, com texto
  a 130% e no WebKit (`tools/verify`).

### 5. Medição (é o que decide se está pronto)

- `src/lib/core/answers.golden.ts`: pelo menos **150 perguntas dentro do escopo**, cada uma com o id esperado, e **40
  fora do escopo** (piada, capital de país, assunto médico, pergunta vaga). Escreva como leigo digita no celular: sem
  acento, com erro, com gíria, curtas ("creatina?"). **Nenhuma pode ser cópia de uma `asks`**: copiar mede decoreba.
- Se existir `docs/perguntas-reais.md` (perguntas que eu coletei com amigos), elas entram no conjunto e têm prioridade.
- Teste vitest que calcula e exige: acerto na primeira posição ≥ 85%, entre as três primeiras ≥ 95%, resposta errada
  para pergunta fora do escopo ≤ 5%, assunto proibido respondido = 0.
- Testes das respostas com dados usando os operadores fictícios de `simulateOperator`, incluindo o caso sem dados.
- Mostre no fim a tabela com os números e a lista das perguntas que erraram.

## Regras duras

- Tudo do `CLAUDE.md` vale: não commitar, não tocar em `ppl.ts`, não gastar, sem texto pessoal, medir antes de dizer
  pronto, `npm run check` inteiro.
- Nenhuma dependência nova além de, no máximo, o MiniSearch. Nenhum download em tempo de execução.
- Nada grava em `db.programs` nem muda configuração sem confirmação (mesma regra das propostas atuais).
- Lógica em `src/lib/core/` sem importar telas; sem ciclo de import novo.
- No fim: atualize o `CLAUDE.md` (mapa do código, número de testes) e rode `graphify update .`.

## Ordem de trabalho

1. Leia `intents.ts`, a função `send` do `Coach.tsx` e os tipos de `science.ts`. Me devolva um plano curto com os nomes
   de arquivo e o formato final de `Answer` antes de escrever conteúdo.
2. Buscador + 30 respostas + 40 perguntas de teste: prove que a medição funciona de ponta a ponta.
3. Respostas com dados da pessoa e seus testes.
4. Complete a base até 150–200 e o conjunto de teste até 190. Ajuste sinônimos e limiares olhando os erros.
5. Tela, auditoria de layout, `npm run check`.

## Entrega

- Tabela de acerto e lista de erros restantes.
- `docs/respostas-para-revisar.md`: todas as respostas novas de alimentação e recuperação, com o nível de evidência,
  para eu ler e aprovar.
- O que ficou de fora e por quê.

---

## Fase 2: treinador online grátis (começa quando a fase 1 passar na medição)

Com internet, um modelo no nosso Worker **escreve** a resposta, mas só com os trechos da nossa base que o buscador
achou e um resumo dos dados da pessoa. Sem internet, sem cota ou com erro, vale a resposta local da fase 1. A pessoa
nunca fica sem resposta e nunca vê erro de cota.

### Quando o modelo é chamado

- Intenção ou pergunta só de dados ("qual meu recorde?"): resposta local, sempre.
- Busca confiante numa resposta única: resposta local na hora, com o botão "Explicar melhor", que chama o modelo.
- Busca em dúvida, pergunta que mistura assuntos ou continuação da conversa: modelo.
- Busca que não achou nada: **não** chama o modelo. Sem trecho de apoio não há resposta.

### Rota `POST /coach/ask` (Workers AI, `env.AI`)

- Entrada: a pergunta (até 500 caracteres), os **ids** de até 4 trechos, as 2 últimas trocas da conversa (até 600
  caracteres) e, se a pessoa aceitou, um resumo numérico dos dados (até 800 caracteres, sem nome).
- O servidor monta o texto dos trechos pelos ids, a partir de uma cópia da base gerada no build. **O app nunca manda
  texto de apoio**: isso impede que alguém use a rota como modelo grátis para qualquer assunto.
- Instrução fixa do sistema: português simples, 2 a 5 frases, só o que está nos trechos; se os trechos não cobrem a
  pergunta, devolver exatamente `NAO_SEI` (o app mostra a saída "não sei" da fase 1); nunca dose, diagnóstico ou
  cardápio; terminar com `[fonte: id]` do trecho usado, que o app transforma em "Ler mais".
- Temperatura baixa e no máximo 300 tokens de saída. Sem streaming na primeira versão: mostre "escrevendo…".
- Os assuntos proibidos são barrados no app **e** no servidor, antes do modelo.
- Exige a conta online (grátis), para o limite valer por pessoa.
- No servidor Node não existe `env.AI`: a rota devolve 503 e o app segue local.

### Modelo e cota (conferido em 13/11/2026 na página oficial de preços; confira de novo)

- O plano grátis dá 10.000 neurons por dia e, ao acabar, **as chamadas falham em vez de cobrar**.
- Use modelo de 8B para cima: abaixo de 7B eles usam mal o texto de apoio (arXiv 2603.11513).
- Uma resposta gasta perto de 1.500 tokens de entrada e 250 de saída. Pela tabela do dia, `qwen3-30b-a3b-fp8` e
  `llama-3.1-8b-instruct-fp8-fast` saem por cerca de 15 neurons cada (umas 650 respostas por dia); o
  `llama-3.3-70b-instruct-fp8-fast` sai por cerca de 90 (umas 110 por dia).
- Compare 2 ou 3 modelos no conjunto de teste e escolha pelo resultado em português. O nome do modelo fica numa
  variável de ambiente, para trocar sem publicar o app de novo.

### Travas de cota

- Contador diário global no D1, que para em 9.000 neurons.
- Limite por pessoa: 20 respostas do modelo por dia (o `rateLimit` que já existe).
- Cache no D1 para pergunta sem dados pessoais: chave = hash da pergunta normalizada + ids dos trechos + versão da
  base, por 30 dias. Pergunta repetida custa zero.
- Estourou qualquer limite: o app responde local e mostra uma linha discreta ("respostas completas voltam amanhã").
- Tabela nova com `user_id` entra em `wipeUser`; SQL novo em migração nova, valendo no D1 e no `node:sqlite`.

### Privacidade

- Na primeira vez, um cartão de um toque explica o que sai do aparelho (a pergunta e, se a pessoa quiser, o resumo
  numérico) e guarda a escolha. Dá para desligar em Ajustes.
- Atualize `docs/privacidade.md` e a tela de privacidade. O servidor não guarda a pergunta junto com a conta.

### Medição da fase 2

- As 40 perguntas fora do escopo: pelo menos 90% terminam em "não sei".
- 60 perguntas dentro do escopo: toda resposta cita uma fonte que existe, e eu recebo a lista (pergunta, trechos,
  resposta) em `docs/respostas-do-modelo.md` para conferir se alguma diz algo que não está nos trechos.
- Testes do servidor com `env.AI` simulado: cota global, limite por pessoa, cache, 503 no Node, assunto proibido.

### Se o uso crescer (decisão minha, não faça sem eu pedir)

- Workers Paid: US$ 5 por mês mais US$ 0,011 por 1.000 neurons acima da cota. Mil respostas por dia dariam cerca de
  US$ 7 por mês no total.
- Um segundo provedor grátis como transbordo: exige conta em terceiro.
