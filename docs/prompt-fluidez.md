# Fluidez: por que app feito por IA parece "travadinho" e como tirar isso do AUGMENT

Análise de 16/11/2026 + prompt mestre. **Implementado em 18–19/11/2026**: números e conclusões na seção 8.

O que foi conferido no código está marcado **[visto]**. O que é suspeita a confirmar medindo está marcado
**[hipótese]**. A Fase 0 do prompt existe para transformar hipótese em número antes de mexer em qualquer coisa.

## 1. O problema, em uma frase

Nenhum desses engasgos é lentidão de verdade. É a tela mostrando **um estado intermediário por 1 a 30 quadros**:
o valor padrão antes do valor real, o painel vazio antes do painel cheio, o bloco invisível esperando a vez na
animação. Cada um dura pouco, mas o olho percebe qualquer troca acima de ~1 quadro (16 ms), e dez trocas pequenas por
tela somam a sensação de "travadinho".

## 2. Por que isso aparece em todo app feito por IA

Seis causas, da mais importante para a menos. As três primeiras valem para qualquer IA e qualquer projeto.

1. **Ninguém olha os quadros do meio.** O agente confere o teste, o tipo e a foto da tela **parada**. Piscada não
   quebra teste, não quebra o TypeScript e não aparece em captura de tela. O que não é medido não é consertado. É a
   causa raiz: as outras cinco sobrevivem por causa dela.
2. **O padrão de tutorial.** O jeito mais comum de carregar dado em React nos exemplos da internet é
   `useState(padrão)` + `useEffect(buscar)`. O efeito roda **depois** de a tela pintar, então esse padrão garante pelo
   menos um quadro com o valor errado. O modelo reproduz o que mais viu.
3. **Cada peça é escrita sozinha.** Cada pedido gera um componente que busca o próprio dado. Sem uma camada de dados
   única, a tela monta em "pipoca": cada painel chega no seu tempo e empurra os outros.
4. **Carregando de enfeite.** Spinner e esqueleto entram por padrão, inclusive para dado que chega em 20 ms. Um
   indicador que aparece e some em 2 quadros é pior do que nenhum.
5. **Animação de entrada em tudo.** "Deixa mais vivo" vira fade e cascata em cada bloco. Enquanto espera a vez, o
   bloco fica invisível: a pessoa lê isso como atraso, não como efeito.
6. **Máquina boa, modo de desenvolvimento.** O agente testa no computador, sem limitar a CPU. No celular a mesma tela
   custa 4 a 6 vezes mais.

Um time com designer e gente sênior tira isso no polimento, porque alguém **usa** o app e reclama. No app feito por
IA esse passo não existe, a não ser que vire regra escrita e portão automático. É o que este documento propõe.

## 3. O que as fontes dizem (e o quanto confiar)

| Tema                          | O que se sabe                                                                                                                                                                                                               | Confiança                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Valor padrão que pisca        | Ler o dado num efeito pinta o padrão primeiro. Saída: ter o valor **antes** do primeiro quadro (inicializador do `useState`, `useSyncExternalStore` com leitura síncrona) ou ajustar em `useLayoutEffect`, antes da pintura | Alta (documentação do React, TkDodo)                                                           |
| IndexedDB/Dexie               | É assíncrono: `useLiveQuery` devolve o padrão no 1º render e não tem valor síncrono. Quem quer dado no 1º quadro precisa de um cache próprio em memória, alimentado por uma assinatura única                                | Alta (documentação e discussões do Dexie)                                                      |
| Troca de tela com código lazy | Sem transição, o `Suspense` mostra o fallback. Com `startTransition`, o React mantém a tela antiga até a nova estar pronta. Pré-carregar o pedaço no toque/foco ou em tempo ocioso                                          | Alta (react.dev)                                                                               |
| Imagem que pisca              | O navegador pode pintar antes de decodificar. `decoding="async"` permite pintar **sem** a imagem; `img.decode()` antes de mostrar e `decoding="sync"` em imagem pequena e crítica evitam                                    | Média (bugs do Firefox e do WebKit; é dica, o navegador pode ignorar)                          |
| Indicador de carregando       | Só mostrar se passar de ~200 ms; se mostrou, manter por ~300 ms. Evita o pisca-pisca                                                                                                                                        | Média (consenso de prática, pouca pesquisa)                                                    |
| Esqueleto                     | Não é comprovado que pareça mais rápido: o único teste controlado achado (Viget, 2017) deu o esqueleto como o **pior**. Serve para segurar o layout, não para "acelerar"                                                    | Baixa para "esqueleto acelera"; num app offline, dado local não deve ter carregando **nenhum** |
| Limites de percepção          | Até ~100 ms entre toque e resposta parece instantâneo; a meta do Google para interação (INP) é ≤ 200 ms                                                                                                                     | Alta (Nielsen; web.dev), citado de memória                                                     |
| Listas, re-render, CSS-in-JS  | Causas comuns em apps gerados, mas a maioria das fontes é blog de fornecedor                                                                                                                                                | Baixa; e o AUGMENT não usa CSS-in-JS                                                           |

Fontes no fim (seção 7).

## 4. Diagnóstico do AUGMENT

### 4.1 Já existe uma primeira passada, sem commit

**[visto]** Na árvore de trabalho (`git diff`: `App.tsx`, `hooks.tsx`, `db.ts`, `sync.ts`, `coach/chat.ts`,
`Coach.tsx`) já há:

- cache em memória por dado (`peekSettings`, `peekSessions`, `peekPrograms`, `peekBodyLog`, `peekOperatorMemory`,
  `peekChatAliases`, `onlineSnap`, `peekCoach*`), usado como valor inicial do `useLiveQuery`;
- `App` só monta o `Shell` depois de carregar tudo em paralelo;
- avatar e herói da persona decodificados antes de montar (teto de 350 ms);
- o pedaço do treinador e o histórico dele aquecidos em tempo ocioso;
- rolagem, deload, nível de efeitos e setor aplicados em `useLayoutEffect` no `Shell`.

O relatório dessa passada diz "zero flicker", mas a verificação foi só `npm run check` e `npm run build`: nenhum
quadro foi medido.

Isso ataca direto a foto que pisca do padrão para a atual na **abertura**. Não foi medido. O que segue é o que essa
passada não cobre.

### 4.2 O que sobra

**A. Cada tela renderiza duas vezes ao abrir. [hipótese forte]**
`useLiveQuery(consulta, [], peek())` devolve o cache no 1º render, **refaz a consulta no banco a cada montagem** e, ao
resolver, entrega um objeto novo. `useSessions` ainda passa por `rememberSessionsSnap(await db.sessions.toArray())`:
vetor novo a cada tela. Resultado: poucos milissegundos depois do 1º quadro, toda conta em `useMemo` que depende de
`sessions` ou `settings` é refeita e a tela inteira renderiza de novo, **no meio da animação de entrada**. Não muda
o que se vê, mas rouba quadros justamente na hora em que a tela está animando. `useSettings` é chamado em 35 lugares.

**B. A cascata de entrada segura os blocos invisíveis. [visto]**
`15-pecas.css`, "MC1": `.app > .stack-lg > *` anima `pc-ligar` (220 ms) com atraso de 40 ms por bloco e preenchimento
`backwards` (opacidade 0 enquanto espera). O 6º bloco só termina de aparecer **420 ms** depois da troca de tela. O
conteúdo do painel com faixa espera mais 140 ms. Isso toca **em toda troca de aba**, inclusive ao voltar para uma tela
vista há 2 segundos. Por cima, o Progresso tem as próprias entradas (`vb-row-in`, `aw-*`, `sysmod-load`,
`mod-card-in`) e o `<Ticker>` conta de 0 até o valor em 500 ms. É exatamente "um painel que demora uns microssegundos
para aparecer". É decisão de design, não defeito, mas é a maior parcela do que se sente.

**C. Toda troca de aba desmonta e remonta a tela inteira. [hipótese]**
`Today`, `Progress`, `Report` refazem na montagem contas sobre o histórico todo (`operatorState`, `muscleStatus`,
`attributes`, `weeklyVolume`). Se isso passar de ~50 ms no celular, o toque na aba demora a responder. Depende de A:
enquanto o vetor de sessões mudar de identidade a cada tela, não dá para guardar o resultado.

**D. O herói do Hoje pode pintar um quadro atrasado. [hipótese]**
`Today.tsx:333` usa `decoding="async"` no herói. Ao remontar o Hoje, o navegador pode pintar o banner sem a imagem e
encaixá-la no quadro seguinte. `Coach.tsx:763` não tem `width`/`height` no avatar. Miniaturas de `Exercises.tsx:181`
vêm da rede com `loading="lazy"`: sem fundo reservado, entram em "pipoca" ao rolar.

**E. Painéis de rede aparecem depois e empurram o resto. [visto]**
`CommunityCard` (ranking começa `null` e chega depois), backups da nuvem em `Online.tsx:491`, `theirs` em
`Friends.tsx:501`, lista de bloqueados. Amigos e feed já usam o cache `online.social`: é o modelo a copiar.
`ProgramEditor.tsx:547` e `RestorePoints.tsx:21` usam `useLiveQuery` sem valor inicial.

**F. O Shell renderiza tudo de novo por qualquer mudança. [hipótese]**
`Shell` assina `useSettings`, `useSessions`, `useOnline`, `useToday` e o timer. Qualquer gravação re-renderiza a barra
de abas e a rota inteira.

**G. Medir no lugar certo. [visto]**
`main.tsx` usa `StrictMode`: no desenvolvimento, toda tela monta duas vezes e todo efeito roda duas vezes. O Vite em
desenvolvimento serve os módulos soltos. **Metade do que se sente em `npm run dev` não existe no APK.** Toda medição
tem de ser no build de produção (`npm run build` + `vite preview`), com a CPU limitada em 4×.

**H. Fontes. [hipótese fraca]** `@fontsource` usa `font-display: swap`. O boot cobre a troca na abertura; conferir
se `document.fonts.ready` entra na espera do boot.

### 4.3 O que não é problema aqui

Sem CSS-in-JS, sem lista gigante sem janela (a biblioteca tem 603 itens: conferir na Fase 0, não presumir), sem
servidor no caminho dos dados. Os avatares têm 192 px e ~60 KB: tamanho certo.

## 5. Regras de fluidez (F1–F9)

Servem para o AUGMENT e para qualquer app feito por IA. Depois da implementação, entram no `CLAUDE.md` (seção 7).

- **F1 Primeiro quadro certo.** Dado que já está no aparelho aparece no 1º quadro da tela. Proibido
  `useState(padrão)` + `useEffect(carregar)` para dado local.
- **F2 Uma assinatura por dado.** Cada dado tem uma fonte em memória, assinada uma vez no app. Tela lê; tela não
  consulta o banco ao montar. O mesmo dado sem mudança devolve **o mesmo objeto**.
- **F3 Sem "carregando" para dado local.** Indicador só para rede, só depois de 200 ms, e por no mínimo 300 ms.
- **F4 Rede: mostra o que já tinha.** Painel que depende do servidor mostra o último valor guardado na hora e troca
  quando o novo chega, sem mudar de altura. Sem valor guardado, reserva o espaço.
- **F5 Nada muda de lugar depois de pintar.** Toda imagem tem `width` e `height`; nenhum painel nasce depois e empurra
  os outros.
- **F6 Imagem crítica já decodificada.** Avatar, herói e ícone: pré-decodificados e sem `decoding="async"`.
- **F7 Entrada não é espera.** Animação de entrada nunca esconde conteúdo por mais de 150 ms e não repete em tela já
  vista na mesma abertura do app.
- **F8 Toque responde em 100 ms.** Entre tocar e a tela nova pintar: ≤ 100 ms com CPU 4×, sem tarefa longa (> 50 ms).
- **F9 Aparência muda antes de pintar.** Classe de tema ou setor no `<html>`, rolagem para o topo e variável de estilo
  medida no DOM vão em `useLayoutEffect`, nunca em `useEffect` (a primeira passada já fez isso no `Shell`).

## 6. Prompt mestre

Copie daqui até o fim da seção para o agente que vai implementar (Opus).

---

**Tarefa**: tirar do AUGMENT os engasgos visuais de carregamento (piscadas, painéis que chegam atrasados, telas que
renderizam duas vezes), medindo antes e depois. Leia `CLAUDE.md` inteiro e as seções 4 e 5 de
`docs/prompt-fluidez.md` antes de abrir código. Use `graphify explain "<símbolo>"` para localizar.

**Regras que não mudam**

- Não faça commit nem push. Não inclua `.claude/launch.json`. Não toque em `src/data/templates/ppl.ts`.
- Há uma primeira passada **sem commit** na árvore de trabalho (`git diff`). Não descarte: meça e construa em cima.
- Toda medição é no **build de produção** (`npm run build` e `npx vite preview`), CPU limitada em 4×, viewport de
  390 px, com os dados de `tools/verify/seed.js`. Nunca em `npm run dev`.
- Cada fase termina com `npm run check` verde e a tabela de números atualizada no fim deste documento. **Fase que
  piorar um número não entra.**
- Áreas protegidas de `docs/movimento.md` (boot, barra de abas, log de fim de treino, botão do banner): não mexer.
- Não acrescente dependência. Não mude a assinatura pública dos hooks de `lib/hooks.tsx` (35 usos de `useSettings`).
- Rode uma ferramenta de navegador por vez (`frames.mjs` avisa que em paralelo os números distorcem).

**Fase 0. Medir (não muda o app)**

Crie `tools/verify/flicker.mjs` no padrão das outras ferramentas (`browser.mjs`, `seed.js`, `login.mjs`). Ele abre o
app, espera o boot, e para cada transição da lista (as 5 abas em sequência, ida e volta; Hoje → treino; Exercícios →
detalhe; Progresso → Relatório; Ajustes; Treinador; com `AUDIT_API`, Perfil e Amigos) registra:

1. `toque→pintura`: ms entre o clique e o primeiro quadro com a tela nova (`PerformanceObserver` de `event` ou
   `requestAnimationFrame` depois da mudança de rota).
2. `tarefa longa`: maior `longtask` nos 600 ms seguintes.
3. `deslocamento`: soma de `layout-shift` nos 1.500 ms seguintes.
4. `troca de imagem`: quantas vezes um `<img>` mudou de `src` ou passou de não decodificado (`!complete` ou
   `naturalWidth === 0`) para decodificado **depois** do 1º quadro (`MutationObserver` + checagem por quadro).
5. `chegou depois`: elementos inseridos em `.app` mais de 1 quadro depois do 1º (lista de seletores), separando rede
   de dado local.
6. `último bloco visível`: ms até o último filho de `.app > .stack-lg` dentro da tela ter opacidade 1.
7. `renders`: quantas vezes a tela renderizou nos primeiros 500 ms (um `<Profiler>` em volta de `<Routes>`, ligado só
   com `?perf=1` ou variável de build; não pode ir ligado para produção).

Saída: tabela em texto e JSON em `tools/verify/out/`. Rode 3 vezes e use a mediana. Rode também no WebKit.

Com os números, escreva em 10 linhas no fim deste documento: quais hipóteses A–H da seção 4.2 se confirmaram, com o
número, e quais caíram. **Hipótese que não se confirmou não vira trabalho.** Confira também se a lista de Exercícios
(603 itens) monta tudo de uma vez e quanto custa.

**Fase 1. Uma fonte por dado (F1, F2)**

- Crie `src/lib/store.ts`: para cada dado (ajustes, sessões, programas, corpo, memória do operador, apelidos, estado
  online) uma única assinatura `liveQuery` do Dexie, iniciada no `App` antes de montar o `Shell`, que guarda o último
  valor em memória e avisa os assinantes. Os `peek*` e `*Snap` de hoje viram esse estoque (um lugar só).
- Os hooks de `hooks.tsx` passam a ler com `useSyncExternalStore` (leitura síncrona; a mesma referência enquanto o
  dado não muda). `useSession(id)` lê do estoque de sessões.
- Quem grava (`saveSettings` etc.) atualiza o estoque na hora, sem esperar o banco responder, e o `liveQuery` confirma.
- `ProgramEditor.tsx:547` e `RestorePoints.tsx:21`: mesmo tratamento ou valor inicial síncrono.
- Não crie ciclo de import novo (`db.ts` ↔ `restore.ts` já existe).
- Teste vitest: montar duas telas seguidas não refaz consulta; a referência não muda sem gravação; gravação chega a
  todos os assinantes; importar backup e restaurar ponto atualizam o estoque.
- Meta: `renders` = 1 por troca de tela; nenhuma consulta ao IndexedDB na montagem de tela.

**Fase 2. Contas pesadas uma vez só (F8)**

- Com a identidade estável da Fase 1, guarde por identidade (módulo, `WeakMap` na chave do vetor de sessões + os
  outros argumentos) os resultados de `operatorState`, `muscleStatus`, `attributes`, `weeklyVolume` e do que a Fase 0
  mostrar acima de 8 ms. Função pura continua pura; o cache fica num embrulho, não dentro dela.
- Tire do `Shell` o que não é dele: a barra de abas não pode re-renderizar quando uma sessão é gravada (componente
  próprio que assina só `persona` e os pedidos pendentes).
- Tela que ainda passar de 50 ms de tarefa longa: `content-visibility: auto` com `contain-intrinsic-size` nos blocos
  abaixo da dobra, ou `useDeferredValue` no bloco pesado. Sem esqueleto.
- Se a lista de Exercícios pesar, janela de renderização feita à mão (sem biblioteca) ou `content-visibility`.
- Meta: `toque→pintura` ≤ 100 ms e `tarefa longa` ≤ 50 ms em todas as transições.

**Fase 2b. Usar o boot como tela de pré-carregamento (igual a jogo)**

O `BootScreen` já cobre o app por ~1,5 s (curto) ou ~3,6 s (completo). Esse tempo hoje só carrega os dados e duas
imagens. Aproveite-o inteiro, **sem aumentar a duração**:

- esperar `document.fonts.ready` (com teto) antes de liberar;
- decodificar e manter vivas as imagens das duas personas, não só a ativa;
- rodar uma vez as contas pesadas da Fase 2 (`operatorState`, `muscleStatus`, `attributes`), para as abas já acharem
  o resultado guardado;
- depois do Hoje pintar, em tempo ocioso e ainda sob o boot quando couber, montar as outras 4 abas uma vez fora da
  tela (contêiner `hidden`, sem animação) e desmontar: aquece o código, o estilo e o cache de contas.
- O boot termina no tempo dele; o que não coube segue em tempo ocioso depois. Com reduzir movimento não há boot:
  tudo vai para o tempo ocioso. Nunca segure o app fechado esperando o pré-carregamento.
- Não crie tela de carregamento entre abas nem entre telas: só o boot.
- Meta: a 1ª visita a cada aba com os mesmos números da 2ª (`toque→pintura` e `tarefa longa`).

**Fase 3. Entrada que não atrasa (F7)**

Decisão de gosto do dono; implemente o padrão abaixo com os tempos em tokens, para ele reverter numa linha.

- Primeira visita a uma tela na abertura do app: a cascata fica, mas com o último bloco visível em ≤ 150 ms
  (`--t-ligar` da entrada de tela 120 ms, `--t-cascata` 15 ms, ou só os 3 primeiros blocos em cascata). Crie tokens
  próprios da entrada de tela; não mude `--t-ligar` global (balão e peças usam).
- Tela já vista nesta abertura (voltar de aba): sem cascata; no máximo um fade de `--t-toque` (90 ms) no contêiner,
  sem atraso. Marque as rotas vistas num `Set` em memória e ponha uma classe no `<html>` ou no `.app`.
- O mesmo vale para as entradas internas do Progresso e para o `<Ticker>` e o `SegBar read`: contam só na 1ª vez na
  abertura; depois mostram o valor final direto.
- Tudo segue desligando em `fx-gym`, `fx-min` e reduzir movimento. Rode `npm run verify:keyframes` e
  `node tools/verify/motion.mjs`. Atualize `docs/movimento.md`.
- Meta: `último bloco visível` ≤ 150 ms na 1ª visita e ≤ 100 ms na volta.

**Fase 4. Imagens (F5, F6)**

- `width` e `height` em todo `<img>` (falta em `Coach.tsx:763`, `Kit.tsx:186`, `Exercises.tsx:181`, fotos do corpo:
  nestas, `aspect-ratio` no contêiner).
- Avatar e herói: tirar `decoding="async"` (`Today.tsx:333`, `Onboarding.tsx:73`); `decoding="sync"` no avatar. Manter
  uma referência viva às imagens pré-decodificadas da persona (módulo), para o navegador não descartar. Ao trocar a
  persona em Ajustes, decodificar a nova antes de gravar.
- Miniaturas de exercício: fundo `--surface-2` no espaço reservado e aparição por opacidade em `--t-toque` só quando
  a imagem veio da rede (`onLoad` com `!complete` no 1º render); do cache, entra direto.
- Meta: `troca de imagem` = 0 em todas as transições; `deslocamento` = 0.

**Fase 5. Painéis de rede (F3, F4)**

- Copie o modelo de `online.social` (Amigos): último valor no kv `online`, mostrado na hora, trocado quando chega.
  Aplicar em: ranking de amigos por exercício (`CommunityCard`), backups da nuvem (`Online.tsx`), recordes do amigo
  (`Friends.tsx:501`), bloqueados. Cache com limite de tamanho; apagar no logout e ao apagar a conta.
- Sem valor guardado: o painel já nasce com a altura final (mínima) e o texto de estado dentro; nada de inserir
  depois. Indicador só depois de 200 ms, por no mínimo 300 ms (um hook `useDelayedFlag` em `lib/`, com teste).
- Nada disso sobe dado novo ao servidor nem muda `server/`.
- Meta: `chegou depois` (dado local) = 0; painéis de rede sem `deslocamento`.

**Fase 6. Não voltar atrás**

- `npm run verify:flicker` no `package.json` e um passo em `.github/workflows/verify.yml` com os orçamentos: `renders`
  ≤ 1, `troca de imagem` = 0, `deslocamento` ≤ 0,01, `chegou depois` local = 0, `toque→pintura` ≤ 100 ms (no CI, use
  folga: ≤ 200 ms), `último bloco visível` ≤ 150 ms.
- `scripts/lint.ts`: acusar `<img` sem `width`/`height` (ou `lint-ok`) e `useLiveQuery(` fora de `lib/store.ts`.
- `CLAUDE.md`: seção "Regras de fluidez" com F1–F9 (seção 5 deste documento), a ferramenta nova na seção 9, o
  `lib/store.ts` na seção 5 e, nas armadilhas, "medir fluidez só no build de produção".
- `graphify update .`

**Entrega**: tabela antes × depois por transição (mediana de 3, Chromium e WebKit) no fim deste documento; lista do
que ficou acima do orçamento e por quê; `npm run check`, `verify:layout` (1× e 1,3×), `verify:e2e` e `verify:webkit`
verdes. Nada de "ficou mais fluido" sem número.

---

## 7. Fontes

- [React: Suspense (transição mantém o conteúdo visível)](https://react.dev/reference/react/Suspense.md)
- [TkDodo: evitar o valor errado no 1º render com useSyncExternalStore](https://tkdodo.eu/blog/avoiding-hydration-mismatches-with-use-sync-external-store)
- [Dexie: useLiveQuery (valor padrão no 1º render)](<https://dexie.org/docs/dexie-react-hooks/useLiveQuery()>)
- [Dexie: liveQuery](<https://dexie.org/docs/liveQuery()>)
- [Maxime Heckel: pré-carregar telas lazy](https://blog.maximeheckel.com/posts/preloading-views-with-react/)
- [Mozilla, bug 1222711: imagem pinta antes de decodificar; `decoding` e `decode()`](https://bugzilla.mozilla.org/show_bug.cgi?id=1222711)
- [WebKit, bug 186336: `HTMLImageElement.decode()`](https://bugs.webkit.org/show_bug.cgi?id=186336)
- [Steve Kinney: esqueletos e desempenho percebido](https://stevekinney.com/courses/react-performance/skeleton-screens-perceived-performance)
- [DEV: esqueleto × spinner, atraso de 200 ms](https://dev.to/helloashish99/skeleton-screens-vs-spinners-perceived-load-time-1nlj)
- [DEV: problemas comuns em front-end gerado por IA](https://dev.to/karishma_dev/common-problems-in-ai-generated-frontend-code-and-how-to-avoid-them-4kef)
- [dejank: piscada como problema de momento de pintura](https://skillselion.com/skills/gbasin/dejank)
- [The New Stack: o erro que enfraquece todo app gerado por IA](https://thenewstack.io/the-one-mistake-that-weakens-every-ai-generated-app/)

Aviso: boa parte do que existe sobre "app de IA lento" é blog de fornecedor. As linhas de confiança alta da seção 3
vêm de documentação oficial; o resto é prática comum, e por isso o prompt manda medir antes de aplicar.

## 8. Números

Implementado em 18–19/11/2026 (fases 0 a 6). Medido com `tools/verify/flicker.mjs` no **build de produção**, 390 px,
dados de demonstração gravados direto no IndexedDB, mediana de 3 rodadas. "Antes" = o último commit (`809b1c0`, sem a
primeira passada), servido lado a lado com o "depois" na mesma máquina e na mesma hora. Chromium com a CPU 4× mais
lenta; WebKit (Playwright) sem limitar a CPU, que ele não permite.

### Fase 0: o que se confirmou

- **A (cada tela renderiza 2 vezes): confirmada.** Antes, 2 a 4 renders por troca nos dois motores; depois, 1. O build
  antigo ainda pintava a tela **vazia** primeiro (`useLiveQuery` sem valor inicial → `return null`): a piscada da
  seção 1, medida.
- **B (cascata segura os blocos): confirmada.** O último bloco visível chegava 250–400 ms depois da pintura; agora a
  1ª visita fica em ~150 ms acima da pintura e a volta, sem cascata.
- **C (contas pesadas ao trocar de aba): em parte.** O JS das contas é pouco (10–50 ms sem limitar a CPU). O peso de
  verdade era **estilo e layout forçados no meio da troca** (o mapa do ano lia `scrollWidth` ao montar; o balão media o
  rodapé a cada segundo) e **2.471 nós SVG** no mapa de fadiga (as fibras dos músculos, 54 nós por parte).
- **D (herói pinta atrasado): fraca.** 1 troca de imagem nas trocas para o Hoje e para o detalhe; agora 0.
- **E (painéis de rede): confirmada** (medida logado, com o servidor local e 2 amigos): na 1ª visita, Amigos inseria 7
  blocos depois de pintar (feed, ranking, listas), o Perfil 8 e o detalhe do exercício 5. Agora 0, menos o ranking entre
  amigos de um exercício nunca aberto (a linha de espera já ocupa o lugar; a lista que chega é maior que ela).
- **F (o Shell re-renderiza tudo): confirmada no código**; a barra de abas e o Shell não assinam mais os treinos.
- **G (medir no lugar certo): confirmada, e pior do que parecia.** Além do modo de desenvolvimento, a máquina de teste
  mentia: as ferramentas de `tools/verify` deixavam o Edge órfão no Windows (286 processos rodando o app escondido) e
  uma extensão instalada (corretor ortográfico) entrava até em perfil novo, custando ~1 s por toque. As duas coisas
  estão corrigidas em `browser.mjs` (`killBrowser` fecha pelo protocolo; `--disable-extensions`).
- **H (fontes): confirmada no código.** Cada peso só baixava quando uma tela o usava; agora o boot carrega as 11 faces.
- **Lista de Exercícios:** monta 34 itens (os curados), não 603. Não precisa de janela de renderização.

### Antes × depois

**Chromium (Edge), CPU 4× mais lenta**: antes → depois

| Transição                | toque→pintura (ms) | tarefa longa (ms) | deslocamento | troca de imagem | chegou depois | último bloco (ms) | renders |
| ------------------------ | ------------------ | ----------------- | ------------ | --------------- | ------------- | ----------------- | ------- |
| / → /historico           | 687 → 743          | 330 → 620         | 0 → 0        | 0 → 0           | 0 → 0         | 924 → 863         | 3 → 1   |
| /historico → /progresso  | 3627 → 655         | 1692 → 572        | 0 → 0        | 0 → 0           | 0 → 0         | 3627 → 1001       | 2 → 1   |
| /progresso → /exercicios | 414 → 155          | 276 → 112         | 0.011 → 0    | 16 → 0          | 0 → 0         | 630 → 295         | 2 → 1   |
| /exercicios → /perfil    | 688 → 231          | 475 → 175         | 0 → 0        | 0 → 0           | 3 → 0         | 959 → 337         | 2 → 1   |
| /perfil → /exercicios    | 869 → 241          | 595 → 144         | 0.011 → 0    | 0 → 0           | 0 → 0         | 1065 → 254        | 2 → 1   |
| /exercicios → /progresso | 2387 → 253         | 1113 → 195        | 0 → 0        | 0 → 0           | 0 → 0         | 2743 → 303        | 2 → 1   |
| /progresso → /historico  | 765 → 207          | 454 → 170         | 0 → 0        | 0 → 0           | 0 → 0         | 1001 → 262        | 3 → 1   |
| /historico → /           | 2092 → 441         | 1402 → 405        | 0 → 0        | 0 → 0           | 1 → 0         | 2904 → 504        | 2 → 1   |
| /exercicios → detalhe    | 1379 → 439         | 1182 → 356        | 0 → 0        | 1 → 0           | 1 → 0         | 1830 → 536        | 2 → 1   |
| /progresso → /relatorio  | 781 → 292          | 266 → 169         | 0 → 0        | 0 → 0           | 0 → 0         | 781 → 292         | 3 → 1   |
| / → /ajustes             | 1139 → 465         | 684 → 241         | 0 → 0        | 1 → 0           | 4 → 0         | 1139 → 465        | 4 → 1   |
| / → /treinador           | 553 → 257          | 169 → 76          | 0 → 0        | 0 → 0           | 0 → 0         | 553 → 257         | 4 → 1   |
| / → treino               | 1725 → 689         | 743 → 328         | 0 → 0        | 0 → 0           | 0 → 0         | 1725 → 689        | 2 → 2   |

**WebKit (motor do iPhone), sem limitar a CPU**: antes → depois

| Transição                | toque→pintura (ms) | troca de imagem | chegou depois | último bloco (ms) | renders |
| ------------------------ | ------------------ | --------------- | ------------- | ----------------- | ------- |
| / → /historico           | 209 → 85           | 0 → 0           | 0 → 0         | 365 → 190         | 2 → 1   |
| /historico → /progresso  | 634 → 92           | 0 → 0           | 0 → 0         | 863 → 220         | 2 → 1   |
| /progresso → /exercicios | 276 → 121          | 0 → 0           | 0 → 0         | 557 → 245         | 2 → 1   |
| /exercicios → /perfil    | 95 → 89            | 0 → 0           | 0 → 0         | 528 → 223         | 2 → 1   |
| /perfil → /exercicios    | 199 → 89           | 0 → 0           | 0 → 0         | 627 → 260         | 2 → 1   |
| /exercicios → /progresso | 476 → 230          | 0 → 0           | 0 → 0         | 694 → 392         | 2 → 1   |
| /progresso → /historico  | 245 → 104          | 0 → 0           | 0 → 0         | 442 → 245         | 2 → 1   |
| /historico → /           | 274 → 90           | 0 → 0           | 0 → 0         | 569 → 287         | 2 → 1   |
| /exercicios → detalhe    | 150 → 149          | 0 → 0           | 0 → 0         | 603 → 297         | 2 → 1   |
| /progresso → /relatorio  | 211 → 106          | 0 → 0           | 0 → 0         | 211 → 106         | 2 → 1   |
| / → /ajustes             | 72 → 106           | 0 → 0           | 0 → 0         | 410 → 232         | 3 → 1   |
| / → /treinador           | 262 → 60           | 0 → 0           | 0 → 0         | 503 → 249         | 3 → 1   |
| / → treino               | 368 → 245          | 0 → 0           | 0 → 0         | 499 → 325         | 2 → 2   |

**Uma linha piorou um pouco: a 1ª troca depois do boot** (Hoje → Histórico, 687 → 743 ms no Chromium; 515 → 632
logado). É quando a pré-montagem das outras abas ainda está terminando em tempo ocioso; em troca, a 1ª visita a cada
aba caiu (Progresso 3,6 s → 0,66 s, Perfil 0,69 → 0,23 s, Exercícios 0,41 → 0,16 s).

**Correção de 19/11 (tarde): o mapa de fadiga voltou ao desenho exato.** As tabelas acima foram medidas com as 18
fibras de cada músculo emendadas em 3 traços. A comparação pixel a pixel (3×, frente e costas) mostrou 1–1,4% dos
pixels diferentes (até 107/255): onde as fibras se cruzam, traços separados somam brilho e sombra, e um traço só não.
Agora cada fibra tem os seus 2 traços, na ordem original, sem o `<g>` vazio (36 nós por parte em vez de 54): 0 pixel
diferente. Medido lado a lado no mesmo horário (CPU 4×, média de 2 rodadas): Histórico → Progresso 766 ms com o
desenho exato × 637 ms emendado; Exercícios → Progresso 510 × 502 ms. Os valores absolutos variam entre sessões (a
mesma troca deu 253 ms na medição da noite); compare só o que foi medido junto.

**Ritmo de entrada aprovado pelo dono (19/11).** Testado no celular lado a lado com a cascata antiga (220 ms + 40 ms em
6 blocos, repetida em toda visita), ficou o ritmo novo: 120 ms + 15 ms em 3 blocos na 1ª visita e volta sem cascata.
Não reverter o bloco "Entrada de tela" do `18-fluidez.css` sem pedido.

Também entraram, já nos números acima:

- o Treinador abre com 1 render (antes 2: o histórico recarregado trocava o objeto mesmo igual);
- o treino novo entra no estoque antes de navegar (sem quadro vazio);
- o botão do Guia em Exercícios anima sozinho, não com o bloco: ele é `position: fixed`, e o `transform` da entrada no
  bloco fazia o botão nascer no topo e pular para o rodapé (deslocamento de 0,011–0,022, agora 0). Medido quadro a
  quadro: aparece 8 px abaixo e sobe até o lugar, sempre no rodapé;
- o balão do núcleo se reposiciona no mesmo quadro da troca de tela (antes esperava o ciclo de 1 s e pulava 149 px ao
  abrir o treino: deslocamento de 0,06–0,59, agora 0);
- o Perfil também é pré-montado no boot (só sem conta: com conta ele busca os backups da nuvem ao abrir);
- com conta, amigos, feed, bloqueados e backups da nuvem são buscados em tempo ocioso depois do boot, então a 1ª
  visita já abre com eles (F4); painel sem valor guardado nasce com a linha de espera (`NetWait`, texto só depois de
  200 ms).

**Logado** (Chromium, CPU 4×, servidor local com 10 usuários e 2 amigos): antes → depois

| Transição                | toque→pintura (ms) | deslocamento | troca de imagem | chegou depois | renders |
| ------------------------ | ------------------ | ------------ | --------------- | ------------- | ------- |
| / → /historico           | 515 → 632          | 0 → 0        | 0 → 0           | 0 → 0         | 3 → 1   |
| /historico → /progresso  | 2507 → 288         | 0 → 0        | 0 → 0           | 1 → 0         | 2 → 1   |
| /progresso → /exercicios | 362 → 179          | 0.011 → 0    | 16 → 0          | 0 → 0         | 2 → 1   |
| /exercicios → /perfil    | 419 → 214          | 0 → 0        | 1 → 0           | 8 → 0         | 2 → 2   |
| /perfil → /exercicios    | 450 → 213          | 0.011 → 0    | 0 → 0           | 0 → 0         | 2 → 1   |
| /exercicios → /progresso | 790 → 274          | 0 → 0        | 0 → 0           | 1 → 0         | 3 → 1   |
| /progresso → /historico  | 384 → 145          | 0 → 0        | 0 → 0           | 0 → 0         | 3 → 1   |
| /historico → /           | 457 → 402          | 0 → 0        | 1 → 0           | 2 → 0         | 4 → 1   |
| /exercicios → detalhe    | 729 → 350          | 0 → 0        | 1 → 0           | 5 → 3         | 3 → 1   |
| /progresso → /relatorio  | 612 → 248          | 0 → 0        | 0 → 0           | 0 → 0         | 3 → 1   |
| / → /ajustes             | 754 → 464          | 0.01 → 0     | 1 → 0           | 4 → 0         | 4 → 1   |
| / → /treinador           | 688 → 231          | 0 → 0        | 0 → 0           | 0 → 0         | 4 → 1   |
| /perfil → /amigos        | 314 → 247          | 0 → 0        | 0 → 0           | 7 → 0         | 6 → 3   |
| / → treino               | 928 → 676          | 0 → 0        | 0 → 0           | 0 → 0         | 2 → 2   |

### Fase 2b: a 1ª visita igual à 2ª?

Quase. Pré-montar as abas no boot e guardar as contas fez a 1ª visita ao Progresso cair de 3,6 s para ~0,66 s; a
volta fica em ~0,25 s. Perfil e Exercícios já saem iguais na 1ª e na 2ª (~0,15–0,24 s). A diferença que sobra é de propósito: a 1ª visita tem a entrada em cascata e
as animações internas (F7); a volta não tem. Com tudo parado (`fx-min`) as duas ficam próximas. Rodadas inteiras às
vezes saem 3–5× mais lentas na mesma máquina (o navegador todo, não uma tela); por isso a mediana de 3.

### Desvios do prompt (de propósito)

- **renders**: contados pelo gancho do React DevTools (`__REACT_DEVTOOLS_GLOBAL_HOOK__`, injetado pelo `flicker.mjs`
  antes do React carregar), não por um `<Profiler>` com `?perf=1`. Funciona no build de produção sem nenhum código no
  app, e conta só o componente da tela (uma lista de hooks nova = um render).
- **"montar duas telas não refaz consulta"**: o teste vitest (`store.test.ts`) confere na célula (a 2ª leitura não
  consulta o banco e devolve o mesmo objeto); não há DOM no vitest. Nas telas de verdade, quem confere é o
  `flicker.mjs` (renders = 1).
- **Perfil na pré-montagem só sem conta** (ver acima).

### O que ficou acima do orçamento, e por quê

- **toque→pintura ≤ 100 ms e último bloco ≤ 150 ms com CPU 4×: não batem.** Nessa simulação de celular lento, as
  trocas ficam em ~150–470 ms; a 1ª visita ao Progresso em ~0,66 s e o início do treino em ~0,69 s (ele grava o treino
  antes de navegar). Sem limitar a CPU (WebKit), ficam em 60–250 ms. O que resta é o custo de estilo e layout de
  telas com 500–1.300 elementos e cantos do augmented-ui (cada elemento chanfrado carrega dezenas de variáveis).
  Reduzir mais pede mexer no visual (menos elementos, menos chanfros), decisão do dono. Por isso, no CI, os tempos só
  avisam; renders, troca de imagem, deslocamento e "chegou depois" reprovam.
- **Treino: 2 renders (exceção declarada no `flicker.mjs`).** Ao abrir, o treino grava a 1ª fala do núcleo
  (`liveLog`) e a tela recebe o treino atualizado: é dado novo de verdade, não piscada.
- **Logado, Perfil e Amigos: 2–3 renders.** Quando o servidor responde, o estado online ganha o horário novo (`at`)
  e a tela renderiza de novo, sem mudar o que se vê. O CI não mede logado.
- **Fotos da rede** (miniaturas de Exercícios) chegam quando chegam; contam à parte (`imgNet`), com o espaço reservado.

- **Auditoria de layout, 1 achado intermitente**: numa das rodadas a 1×, o título "BIOMETRIA" do módulo do Progresso
  saiu com reticências em 320 px. Não se repetiu em outras 4 (nem forçando a escala do texto a 1,032 e 1,1). Fica de
  olho: se voltar, o título precisa de espaço ao lado do botão "+ Peso".

### Verificação final

`npm run check` (405 testes), `verify:layout` 1× e 1,3× (0 achados; o intermitente acima numa rodada), telas logadas
(0), `verify:e2e`, `verify:webkit` (0), `bubble.mjs` (0), `motion.mjs` e `verify:keyframes`: tudo verde.

### Como repetir

```
npm run build
npx vite preview --port 4173
npm run verify:flicker                      # Chromium, 3 rodadas
node tools/verify/flicker.mjs http://localhost:4173 webkit 3
```
