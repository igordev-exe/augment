# Plano de refino visual do AUGMENT

Plano em módulos para outro modelo executar (Opus 5.5 ou Sonnet 5.5). Cada módulo é um prompt pronto para colar numa
sessão nova. O objetivo é **refinar o que está pesado e manter o que já é bom**: nada de reestruturar o app.

- Escrito em 12 nov 2026, sobre o commit `2c40bf2`.
- Referência do Figma (perfil e amigos): `Sci-fi UI Kit (Free) (Community) (9)/figma-perfil/` (`index.css.txt`,
  `App.tsx.txt` e as duas capturas). Pasta fora do git.
- Fotos do estado atual ("antes"), 390 px: `tools/verify/out/plano-antes/` (fora do git).

## 1. Como usar

1. Uma sessão nova por módulo. O `CLAUDE.md` já é carregado sozinho, então o prompt do módulo basta.
2. Ordem: **M0 → MC0 → M1 → M2 → M3 → M4 → M5 → MC1 → MC2 → M6**. M0, MC0 e M1 criam o padrão e as peças que os
   outros reaproveitam. M2 e M5 são independentes entre si; M4 depende de M3. **Aprove a vitrine do MC0 antes de
   seguir**: é ela que define a cara de jogo do resto.
3. Cole o prompt do módulo inteiro. Todos mandam ler as seções 2, 3 e 3A deste arquivo antes de começar.
4. Nenhum módulo faz commit. Revise as fotos de antes e depois e peça o commit você mesmo.

| Módulo | O que resolve                                               | Modelo sugerido | Tamanho |
| ------ | ----------------------------------------------------------- | --------------- | ------- |
| M0     | Tokens de espaço + regras de design no `CLAUDE.md`          | Sonnet 5.5      | pequeno |
| MC0    | Kit de peças de jogo + vitrine em `#/kit` para aprovar      | Opus 5.5        | grande  |
| M1     | Ajustes: a pilha de 9 barras vira 3 painéis                 | Opus 5.5        | médio   |
| M2     | Exercícios e Guia: filtros e atalhos sem linhas quebradas   | Sonnet 5.5      | médio   |
| M3     | Perfil (conta online) fiel ao Figma                         | Opus 5.5        | grande  |
| M4     | Amigos (esquadrão) fiel ao Figma                            | Opus 5.5        | médio   |
| M5     | Programas: 8 cartões com 8 botões iguais viram uma lista    | Sonnet 5.5      | pequeno |
| MC1    | Movimento: troca de tela, números que contam, coreografia   | Opus 5.5        | médio   |
| MC2    | Momentos de jogo: posto e progresso, conquistas, fotos      | Opus 5.5        | médio   |
| M6     | Passada geral: vermelho, Orbitron, recolhíveis, espaçamento | Sonnet 5.5      | médio   |

## 2. Diagnóstico (medido, não "no olho")

O que foi medido no app rodando, em 390 px:

| Tela         | Medida                                                                                             | Problema                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Ajustes      | 9 blocos `.set-group` de 64 px, com 22 px entre todos; página com 1.933 px                         | Cada linha é um cartão completo. O vão é igual dentro e fora dos grupos             |
| Ajustes      | "Som ao terminar" e "Vibrar ao terminar" são botões vermelhos cheios                               | Liga/desliga parece ação principal                                                  |
| Conta online | 2.583 px; o perfil termina perto de 1.570 px e o resto é administração da conta                    | Identidade e burocracia na mesma rolagem                                            |
| Conta online | 3 jeitos de recolher: `.set-group` (seta), `<details>` nativo (triângulo ▶), cartão solto         | Mesma função, três aparências                                                       |
| Conta online | 2 botões vermelhos cheios + zona de perigo vermelha na mesma tela                                  | Vermelho significa marca, ação e perigo ao mesmo tempo                              |
| Conta online | Os 3 treinos do perfil têm borda âmbar inteira (todos têm recorde)                                 | Se tudo é destaque, nada é destaque                                                 |
| Amigos       | Mais de 3.600 px; 14+ cartões de treino iguais em sequência; o ranking fica depois do feed inteiro | Parede de cartões; o resumo mais útil está enterrado                                |
| Amigos       | "Recrutar para o esquadrão" ocupa ~220 px com um botão vermelho de largura total                   | Tarefa secundária com peso de principal                                             |
| Exercícios   | 5 fileiras de controles antes do 1º exercício; grade de músculos 3 + 3 + 1 ("CORE" sozinho)        | Órfão na grade; dois estilos de "selecionado" lado a lado (branco cheio e ciano)    |
| Guia         | 15 atalhos em 4 linhas de larguras diferentes, cada um com caixa e chanfro próprios                | Borda irregular à direita; 15 caixas competindo                                     |
| Programas    | 8 modelos, cada um com um botão "Usar este modelo" de largura total                                | 8 botões idênticos empilhados                                                       |
| Todas        | Todo `.card` tem o traço vermelho de 34 × 2 px no canto                                            | Em telas com 9–12 cartões o vermelho vira ruído                                     |
| Todas        | Orbitron em maiúsculas em títulos de linha, nomes de pessoa e nomes de treino                      | Fonte de vitrine usada como fonte de lista: é o que mais dá a sensação de "massudo" |

**O que já é bom e serve de modelo interno** (não mexer, só copiar o jeito):

- Hoje → "Módulos do protocolo": **um painel só, linhas com filete de 1 px, número discreto à esquerda**. É a lista
  mais bonita do app e é exatamente o padrão que falta em Ajustes, Programas e Conta.
- Histórico → "Treinos de novembro": mesma ideia, com a barra lateral colorida no item.
- Banner de missão do Hoje, mapa de fadiga, boot, calendário do Histórico, zona de perigo.

**Sobre o Figma**: boa parte dele já foi trazida (`components/OperatorProfile.tsx`, `styles/14-rede.css`). O que falta
é o que o faz parecer mais leve: cartão de identidade limpo (sem botões dentro), dados do treino numa caixa única com
filetes em vez de três caixas com barra ciano, Orbitron só em poucos lugares, nomes de pessoa em Exo 2, ações pequenas
de contorno em vez de barras vermelhas, e listas curtas. As capturas PNG do Figma saíram com fonte reserva (não é
Orbitron nem Share Tech Mono): **o `index.css.txt` é a fonte da verdade, não a letra das imagens**.

## 3. Regras de design (valem para todos os módulos)

Cada regra tem a origem e o que ela quer dizer aqui. Na dúvida entre duas soluções, vence a que obedece mais regras.

| #   | Regra                                          | Origem                                                                                                                     | Aqui significa                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Agrupar por proximidade e região comum**     | Gestalt (NN/g: proximidade e região comum)                                                                                 | Vão dentro de um grupo ≤ metade do vão entre grupos. Itens do mesmo tipo moram num painel só. Hoje tudo usa 22 px (`.stack-lg`)                                                                                                                                         |
| R2  | **Menos bordas**                               | Refactoring UI ("use fewer borders"); Tufte (tinta só para dado)                                                           | Linha de lista não é cartão. Um contêiner com chanfro + filetes `--line-2` entre as linhas. Chanfro e traço vermelho ficam no contêiner                                                                                                                                 |
| R3  | **Hierarquia por luz e peso, não por tamanho** | `Dark_Futurism.md` do kit ("hierarchy through luminance"); Refactoring UI ("emphasize by de-emphasizing")                  | Três tintas: `--ink` (o dado), `--ink-2` (apoio), `--ink-3` (rótulo). Rótulo é pequeno, mono, apagado; o valor é que brilha. Para destacar algo, apague o vizinho                                                                                                       |
| R4  | **Vermelho é sinal**                           | Efeito de isolamento (von Restorff); críticas ao HUD do Cyberpunk 2077 (vermelho em excesso, sem código de cor)            | No máximo **1 botão de ação vermelho cheio por tela visível** (a regra é sobre botões: blocos de cor na moldura são bem-vindos, ver 3A). Âmbar = recorde, só como etiqueta. Ciano = informação e seleção. Verde = estado ok. Perigo já tem as listras da zona de perigo |
| R5  | **Orbitron é tempero**                         | Guias de tipografia de jogo (fonte de vitrine não serve para rótulo e lista); o próprio Figma do dono                      | Orbitron só em: título da página, nome de cartão curto (≤ 3 palavras), números de destaque. Título de linha, nome de pessoa e nome de treino em lista: **Exo 2 600**, caixa normal. Rótulos: Share Tech Mono                                                            |
| R6  | **Uma aparência por função**                   | Lei de Jakob; Gestalt (semelhança)                                                                                         | Um só recolhível (seta à direita que gira). Um só "selecionado" por tipo: modo sempre ligado = cheio claro; filtro opcional = ciano. Um só liga/desliga (interruptor)                                                                                                   |
| R7  | **Grade sem órfão**                            | `Dark_Futurism.md` ("rigid grid alignment", "horizontal scanning rhythm")                                                  | Nenhuma fileira termina com um item sozinho. Chips não quebram em linhas de larguras diferentes: ou cabem numa grade exata ou rolam numa linha só com pista de rolagem                                                                                                  |
| R8  | **Denso, mas com escala**                      | Refactoring UI (sistema de espaçamento); `Dark_Futurism.md` (denso por natureza, borda fina no lugar de respiro grande)    | Só os passos `--sp-1..6` (4, 8, 12, 16, 24, 32 px). Não inventar 10, 14, 18, 22                                                                                                                                                                                         |
| R9  | **Enfeite tem que sugerir função**             | `Dark_Futurism.md` ("every decorative element should suggest function"); Mark Coleran (FUI)                                | Código, colchete, LED e varredura só onde dizem algo. Os números 02…09 dos Ajustes não informam nada: saem. Número de ordem numa lista ordenada (módulos do treino, índice do Guia) fica                                                                                |
| R10 | **Recolher com honestidade**                   | NN/g (acordeão no celular: bom quando a pessoa precisa de poucas partes; nunca aninhar; conteúdo escondido é menos achado) | O resumo sempre mostra o valor atual (já é assim, manter). Nunca recolhível dentro de recolhível. O que a pessoa precisa toda vez não fica escondido                                                                                                                    |
| R11 | **Limites que não mudam**                      | `CLAUDE.md` seções 2 e 7; WCAG                                                                                             | Alvo de toque ≥ 44 px; fonte mínima `--fs-1` (11 px): o Figma usa 8–10 px, **suba para 11**; contraste AA; 320 px até tablet; texto do sistema a 130%; `prefers-reduced-motion`; orçamento de 400 hex (use tokens)                                                      |

Proibido em todos os módulos:

- Inventar dado que o servidor não tem: seguidores, seguindo, curtidas, comentários, "verificado", bio, cidade,
  desafio com contagem de atletas. Do Figma vem o **desenho**, não esses números.
- Mexer no banner de missão do Hoje, no treino em andamento (`SessionView`), no boot, na barra de abas, nas personas,
  em `src/data/templates/ppl.ts` e no contrato do servidor (`server/src/protocol.ts`).
- Trocar textos por jargão, adicionar fonte nova, adicionar dependência.
- Commit, push ou incluir `.claude/launch.json`.

Como provar que ficou pronto (todo módulo):

1. `npm run check` inteiro.
2. `npm run verify:layout` (precisa do `npm run dev` na 5173) e de novo com texto a 130% (veja `tools/verify/README.md`).
3. Foto de antes e depois em 390 px com `node tools/verify/shots.mjs http://localhost:5173 tools/verify/out/<pasta> <rotas>`.
   No Git Bash, passe as rotas com `MSYS_NO_PATHCONV=1`.
4. Os números de aceite do módulo, medidos no navegador com `getBoundingClientRect`, não estimados.
5. `graphify update .` no fim.

## 3A. Direção criativa: "interface de jogo, não formulário"

As regras da seção 3 arrumam a **estrutura** (o que agrupa, o que pesa, o que repete). Esta seção cuida da **cara**: o
app tem que parecer o menu de um jogo cyberpunk, não um site escuro com cantos cortados. As duas andam juntas: os jogos
de referência são cheios de forma, cor e movimento e mesmo assim se leem bem, porque cada enfeite tem um papel fixo.

O problema hoje: Hoje, Progresso e o mapa de fadiga já têm essa cara. Ajustes, Guia, Programas, Exercícios, Conta e
Amigos são caixas iguais com texto dentro: o mesmo retângulo chanfrado repetido, sempre cinza, sempre parado.

### O que os exemplos do kit fazem (e o app ainda não)

| Referência no kit                                        | O que ela ensina                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `cyberpunk-2077-breach-protocol.png`                     | **Cor em bloco**: a faixa de título é cheia (lima), com texto escuro e microtexto na ponta. Moldura dupla com cantoneiras ciano por fora   |
| `cyberpunk-2077-cyberware.png`                           | **Slots**: caixas com cantoneiras em L, hachura diagonal e "+" quando vazias. Linhas ligando o corpo aos slots. Contadores em bloco cheio  |
| `cyberpunk-2077-perks.png`                               | **Formas com papel**: hexágonos entalhados para atributos, trilhas de circuito ligando as peças, painel de detalhe ao lado, "segure para…" |
| `Random Elements.png`, `Decals.png`, `MECH - SCREEN.png` | **Blocos de número cheios** ("-03"), placas de perigo com listras, triângulos, pares de traços diagonais (branco + vermelho) como acento   |
| `HUD Pack v1.png`                                        | **Barras com corpo**: trilho, enchimento e uma ponta mais clara, dentro de uma moldura assimétrica com rótulo e ícone                      |
| `cyberpunk-2077-glitch-button/`                          | **Botão com entalhe e etiqueta**: recorte assimétrico, etiqueta minúscula no canto, falha rápida no toque                                  |
| Jogo inteiro                                             | **Código de cor fixo**: vermelho é a moldura, ciano é o que está selecionado, amarelo é valor, verde é nível. A tela inteira tem um tom    |

### Os cinco pilares

1. **Vocabulário de formas, cada uma com um papel.** Hoje só existe uma (o cartão com dois cantos cortados). Passam a
   existir seis, e nenhuma é usada fora do papel dela:

   | Peça                      | Papel                                                                    | De onde vem     |
   | ------------------------- | ------------------------------------------------------------------------ | --------------- |
   | Painel com faixa cheia    | O bloco principal de cada tela (1 ou 2 por tela)                         | breach-protocol |
   | Painel simples com linhas | Listas (é o painel do M1)                                                | Hoje → módulos  |
   | Slot com cantoneiras      | Coisa a preencher ou moldura de imagem: vazio, foto, avatar, "adicionar" | cyberware       |
   | Hexágono entalhado        | Coisa que se conquista ou evolui: posto, atributo, conquista, sigla      | perks           |
   | Bloco de número cheio     | Contagem ou código curto: semana, dia, total, posição                    | Random Elements |
   | Placa de aviso            | Perigo, deload, alerta: listras diagonais e triângulo                    | Decals, MECH    |

2. **Cor em bloco e por setor.** Fio fino colorido sobre cinza é o que deixa tudo com cara de site. Use áreas cheias
   pequenas (faixa de título, bloco de número, ponta da barra) e dê um tom a cada área do app, pela variável `--sector`:

   | Setor      | Telas                                             | Cor                             |
   | ---------- | ------------------------------------------------- | ------------------------------- |
   | Operação   | Hoje, treino, Programas, Ajustes                  | vermelho `--red`                |
   | Telemetria | Histórico, Progresso, Relatório, Exercícios, Guia | ciano `--cyan`                  |
   | Rede       | Conta online, Amigos                              | violeta `--violet`              |
   | Treinador  | Treinador                                         | lima (o `.mode-terminal` atual) |

   O setor pinta o marcador do título, a faixa cheia do painel principal, as cantoneiras e o brilho do horizonte no
   rodapé. O significado das cores de estado não muda em nenhum setor: ciano = selecionado, âmbar = recorde, verde =
   ok, vermelho cheio em botão = a ação principal. No deload, o vermelho continua virando azul-aço.

3. **Moldura viva com dado real.** Microtexto, seriais, réguas e códigos de barra entram, mas sempre mostrando algo
   verdadeiro: id do operador, semana do meso, data, versão do app, contagem. Um por painel, em mono 11 px, `--ink-3`.
   Nada de texto falso tipo "BW7F1 1A1T1" (R9).

4. **Movimento coreografado.** O app já tem cerca de 60 animações soltas. O que falta é um sistema: toda animação
   pertence a uma destas famílias, com tempo e gatilho definidos.

   | Família     | Gatilho                                        | Como                                                                                            | Tempo                                |
   | ----------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ |
   | Ligar       | Tela ou painel entra                           | A moldura "desenha" (linhas crescem com `scaleX`), depois o conteúdo aparece, em cascata        | 180–260 ms; 40 ms entre itens, até 6 |
   | Toque       | Dedo encosta                                   | Resposta na hora: luz que varre o botão (`.btn.zap` já existe), cantoneiras fecham no item      | até 100 ms para começar              |
   | Travar mira | Seleção muda (filtro, aba, dia, semana)        | As cantoneiras ciano saltam para o novo item; o anterior apaga                                  | 120–160 ms                           |
   | Leitura     | Um número ou barra muda                        | Número conta até o valor; barra segmentada enche segmento por segmento                          | 400–600 ms                           |
   | Recompensa  | Recorde, meta batida, posto novo, meso fechado | Falha (glitch) + clarão + vibração. Já existe para recorde; **só nesses quatro momentos**       | 300–450 ms                           |
   | Ambiente    | Sempre                                         | Varredura, LED respirando, horizonte. No máximo 2 laços visíveis por tela; pausam fora da vista | lento (3 s ou mais)                  |

   Movimento mecânico, não elástico: curvas secas (`cubic-bezier(.2,.8,.2,1)` ou `steps()` nas linhas da moldura), sem
   quique. "Segurar para confirmar" (`HoldButton`) é a assinatura do app para ação séria, como o "hold to acquire" do
   jogo: mantenha e dê a ele a barra que enche.

5. **Momentos de jogo com dado real.** O que já é progressão vira progressão visível: o posto (`rankOf`) ganha barra
   até o próximo, as conquistas (`computeAchievements`) viram grade de hexágonos travados e acesos, os atributos já têm
   a roda. Nada de pontos, moedas ou níveis inventados.

### Limites da direção criativa

- **No treino em andamento, calma.** Mão suada, pressa, pouca atenção: a tela de treino não ganha enfeite novo nem
  animação nova. Ela já tem o nível `fx-gym`.
- **Só `transform` e `opacity` em movimento.** Nada de animar `filter`, `clip-path`, `mask`, `box-shadow` ou medidas em
  bloco grande: já deixou a tela sem pintar (veja "Atmosfera" no `CLAUDE.md`). Desfoque de fundo só em barra fixa
  pequena.
- Tudo desliga em `fx-min`/`fx-gym` e com "reduzir movimento"; o estado final continua visível sem a animação.
- Leitura continua mandando: as regras R1–R11 valem. Peça nova não aumenta o número de caixas com borda numa tela;
  ela substitui caixas genéricas.
- Fotos de execução na página do exercício continuam nítidas (servem para aprender o movimento). Tratamento de cor só
  nas miniaturas.
- Os módulos M1–M5 montam as telas **com as peças do MC0**. Onde um prompt disser "cartão" ou "painel", use a peça
  certa da tabela acima.

## 4. Módulos

### M0 — Fundação: escala de espaço e regras no CLAUDE.md

```text
Tarefa: M0 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo.

1. Em src/styles/01-base.css, no :root, crie a escala de espaço: --sp-1: 4px; --sp-2: 8px; --sp-3: 12px;
   --sp-4: 16px; --sp-5: 24px; --sp-6: 32px. Não troque nenhum valor existente ainda.
2. No CLAUDE.md, seção 7 ("Sistema visual"), acrescente um bloco curto "Regras de design" com as regras R1 a R11
   da seção 3 do plano, uma linha cada, e um ponteiro para docs/plano-refino-visual.md. Atualize a lista de tokens.
3. Não mude nenhuma tela neste módulo.

Aceite: npm run check passa; o CSS gerado pelo vite build só ganha as 6 variáveis. Não faça commit.
```

### MC0 — Kit de peças de jogo e vitrine

Este é o módulo que decide a cara do resto. Ele não muda nenhuma tela: constrói as peças e uma rota de vitrine para o
dono aprovar olhando.

```text
Tarefa: MC0 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo. Depois abra, na
pasta "Sci-fi UI Kit (Free) (Community) (9)/": cyberpunk-2077-breach-protocol.png, cyberpunk-2077-cyberware.png,
cyberpunk-2077-perks.png, Random Elements.png, Decals.png, HUD Pack v1.png, Button.png e
cyberpunk-2077-glitch-button/src/style.css. Eles são a referência de forma, cor e movimento.

Passo 0: faça o inventário do que já existe antes de criar. Liste as @keyframes de src/styles (são cerca de 60), as
variantes de .card, e o que o augmented-ui já oferece de recorte. Reaproveite e renomeie; não duplique.

Construa, num arquivo novo src/styles/15-pecas.css (último da ordem), usando augmented-ui e os tokens existentes:
1. --sector no :root (padrão var(--red)) e uma classe por setor no <html> ou no <main>, definida pela rota, conforme a
   tabela de setores da seção 3A. O deload continua trocando o vermelho por azul-aço.
2. As seis peças da seção 3A: painel com faixa cheia (título em texto escuro sobre a cor do setor + microtexto real
   na ponta), painel simples com linhas, slot com cantoneiras em L (com estado vazio: hachura e "+"), hexágono
   entalhado (apagado, aceso, selecionado), bloco de número cheio, placa de aviso.
3. Barra segmentada com trilho, enchimento e ponta mais clara (HUD Pack), em três alturas.
4. Cantoneiras de seleção ciano reutilizáveis (a "mira") para qualquer item selecionável.
5. Tokens de movimento no :root: durações (--t-toque, --t-mira, --t-ligar, --t-leitura, --t-recompensa) e curvas
   (--ease-seco). As seis famílias da seção 3A como classes ou atributos utilitários (ligar em cascata, mira, leitura).
6. Um componente <Ticker value> que conta até o número, e respeita "reduzir movimento".
7. Textura: ruído fino fixo sobre a página (o Figma do dono usa um SVG de ruído a 3,5% de opacidade) só no nível de
   efeitos máximo.
8. Rota de vitrine #/kit, só em desenvolvimento (import.meta.env.DEV; não entra no build de produção): mostra cada
   peça nos quatro setores e no deload, com botões para disparar cada família de movimento. Sem dados pessoais.

Regras: só transform e opacity em movimento; tudo desliga em fx-min/fx-gym e com reduzir movimento; fonte mínima
var(--fs-1); alvos ≥ 44 px; orçamento de 400 hex (derive as variações do setor com color-mix ou opacidade, não com hex
novo). Nenhuma tela existente muda neste módulo.

Aceite:
- #/kit abre em 320, 390 e 768 px sem texto cortado, a 100% e a 130%.
- Um script simples confirma que nenhuma @keyframes nova anima propriedade fora de transform, opacity e cor.
- Com reduzir movimento ligado, nenhuma peça se move e todas mostram o estado final.
- A rota #/kit não aparece no vite build de produção.
- npm run check passa; o CSS das telas existentes não muda (compare o build antes e depois, fora o arquivo novo).
- Atualize a seção 7 do CLAUDE.md com o arquivo 15-pecas, os setores e as famílias de movimento.
Entregue fotos de #/kit em 390 px nos quatro setores e pare: o dono aprova antes dos próximos módulos. Não faça commit.
```

### M1 — Ajustes: de 9 barras para 3 painéis

Arquivos: `src/screens/SettingsScreen.tsx` (`SetGroup`, linhas 22–36, usado 9 vezes) e
`src/styles/13-atmosfera.css` (bloco "Ajustes: blocos recolhidos", linhas 411–480).

```text
Tarefa: M1 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo e olhe
tools/verify/out/plano-antes/ajustes.png e ajustes-aberto.png. O modelo interno a copiar é a lista "Módulos do
protocolo" da tela Hoje (um painel, linhas com filete).

Problema: em Ajustes, 9 <details class="card set-group"> de 64 px empilhados com 22 px entre todos. Cada linha é um
cartão com chanfro, borda, traço vermelho e um código ciano (02…09) que não informa nada.

Faça:
1. Crie um contêiner de lista agrupada (sugestão de nome: .set-panel): UM cartão com chanfro e UM traço vermelho, com
   um rótulo mono pequeno acima (estilo do "eyebrow" das páginas). As linhas dentro dele não têm borda própria,
   chanfro nem traço: só um filete de 1 px var(--line-2) entre elas.
2. Reorganize em 3 painéis, nesta ordem (os dois cartões-link do topo entram no primeiro):
   - OPERADOR: Operador (com o avatar), Conta online (link), Programa de treino (link).
   - TREINO: Mesociclo, Dias de treino, Timer de descanso, Incrementos e pesos, Rotação de acessórios.
   - SISTEMA: Treinador (IA), Efeitos visuais, Backup.
   "Pontos de restauração" e a zona de perigo continuam como estão, depois dos painéis.
3. Linha: altura mínima 56 px, padding 10px 16px. Título em Exo 2 600, caixa normal, var(--fs-4), cor --ink. Valor
   atual embaixo em mono var(--fs-2), cor --ink-3 (já existe, manter). Seta à direita igual à de hoje. Remova o
   .set-code (R9). Linha de link usa a mesma linha, com ">" no lugar da seta.
4. Linha aberta: o corpo abre dentro do painel, com fundo var(--surface-2) e um filete ciano de 2 px à esquerda
   marcando a região aberta. Nada de recolhível dentro de recolhível.
5. Vão: 0 entre linhas do mesmo painel; var(--sp-5) entre painéis; var(--sp-2) entre o rótulo e o painel.
6. Timer de descanso: troque os três botões de alternância (Som, Vibrar, Aviso em outra aba) por linhas com rótulo à
   esquerda e interruptor à direita (role="switch", aria-checked). Desenho do interruptor: veja _SliderToggle.png no
   kit. Ligado = ciano, não vermelho (R4). Guarde o interruptor como componente reutilizável.
7. Não mude o que cada ajuste faz, nem os textos de ajuda de dentro.

Aceite (medir em 320, 360, 390, 412 e 768 px, e a 130%):
- No máximo 3 contêineres com borda entre o título "Ajustes" e "Pontos de restauração" (hoje são 11).
- Vão entre linhas do mesmo painel = 0 px (só o filete); vão entre painéis = 24 px.
- Nenhum botão vermelho cheio na tela fora da zona de perigo.
- Todas as linhas e interruptores com alvo ≥ 44 px; nenhum texto cortado.
- npm run check e npm run verify:layout passam. Mostre antes e depois em 390 px. Não faça commit.
```

### M2 — Exercícios e Guia: filtros e atalhos

Arquivos: `src/screens/Exercises.tsx` (linhas 112–143), `src/styles/09-oficina-relatorio.css` (linhas 5–81),
`src/screens/Guide.tsx`, `.toc` em `src/styles/05-comuns.css` (linha 399) e a regra que hoje força a quebra de linha em
`src/styles/13-atmosfera.css` (linhas ~360–409).

```text
Tarefa: M2 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo e olhe
tools/verify/out/plano-antes/s-exercicios.png e s-guia.png.

Parte A, Exercícios (filtro por músculo):
1. Hoje são 7 células numa grade de 3: sobra "CORE" sozinho na última fileira. Tire a célula "TODOS": sem filtro
   ligado já é "todos", e tocar de novo no músculo ligado desliga. Ficam 6 células numa grade exata de 3 × 2.
   O total (34) já aparece em "34 módulos" logo abaixo.
2. Estado "selecionado" (R6): modo que sempre tem um ligado (Curada/Completa; Tudo/Cabo/Máquina/Halteres/Livre) =
   cheio claro, como já é. Filtro opcional (músculo) = ciano, como já é. Confirme que nenhum outro estilo aparece.
3. Aperte o bloco de controles com a escala --sp: var(--sp-2) entre os controles, var(--sp-4) antes da contagem.
4. Acessibilidade: aria-pressed correto ao desligar; leitor de tela anuncia "sem filtro" de algum jeito.

Parte B, Guia (15 atalhos):
1. Hoje são 15 caixas chanfradas quebrando em 4 linhas irregulares. Troque por UMA faixa de abas de texto numa linha
   só (mesmo desenho das abas Atividade/Telemetria do perfil: texto mono, sem caixa, filete embaixo, aba ativa com
   sublinhado de 2 px), que rola para o lado e fica fixa no topo enquanto a pessoa lê.
2. A aba ativa acompanha a seção visível (IntersectionObserver) e rola sozinha para ficar à vista.
3. A volta da rolagem lateral foi aprovada pelo dono em 12 nov 2026, com esta condição: ela nunca pode ser o único
   caminho (foi removida antes por ficar escondida): na ponta direita da
   faixa, fixo e sempre visível, um botão "Índice" que abre a lista completa das 15 seções numeradas (01–15) numa
   grade com filetes, sem caixas individuais. Tocar num item fecha e leva à seção. Use também uma máscara de
   esmaecimento na borda direita da faixa como pista.
4. Com "reduzir movimento", o pulo para a seção é instantâneo.

Aceite (320, 360, 390, 412, 768 px e 130%):
- Exercícios: nenhuma fileira de filtro com item sozinho; distância do campo de busca ao 1º cartão ≤ 280 px em
  390 px (hoje ~350).
- Guia: a navegação ocupa ≤ 52 px de altura (hoje ~190); todas as 15 seções alcançáveis sem rolagem lateral pelo
  botão Índice; alvos ≥ 44 px.
- npm run check, verify:layout e verify:e2e passam. Antes e depois em 390 px. Não faça commit.
```

### M3 — Perfil (conta online) fiel ao Figma

Arquivos: `src/components/OperatorProfile.tsx`, `src/screens/Online.tsx` (perfil nas linhas 461–488; `<details>`
nativos nas linhas 794, 846, 972 e 996; zona de perigo na 907) e `src/styles/14-rede.css`.

De-para do Figma para dados reais:

| No Figma                           | No app                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| Seguidores / Seguindo              | Recordes / Amigos (já é assim). A célula "Amigos" vira o atalho para `#/amigos`        |
| Selo "Verificado" ao lado do nome  | O posto (`rankOf`), no mesmo desenho de selo pequeno, ao lado do nome e não acima      |
| Bio e cidade                       | Não existem: a linha some. As etiquetas (programa, semana, frequência) continuam       |
| Botão vermelho "Editar perfil"     | Botão-ícone no cabeçalho da página que abre a aba Conta em "Perfil e privacidade"      |
| Curtir, comentar, compartilhar     | Não existem: o rodapé do cartão de treino some                                         |
| Cabeçalho do post (avatar + autor) | No próprio perfil não precisa (é sempre você). Entra no feed dos Amigos (M4)           |
| Anel "Desafio ativo"               | Opcional: "Meta da semana" (treinos feitos ÷ meta), dado real. Sem contagem de atletas |

```text
Tarefa: M3 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo e a tabela de-para do M3 antes de
tudo. Referência visual: "Sci-fi UI Kit (Free) (Community) (9)/figma-perfil/" (index.css.txt é a fonte da verdade;
as capturas PNG saíram com fonte reserva). Estado atual: tools/verify/out/plano-antes/online.png.

Passo 0: tools/verify/shots.mjs não entra na conta. Dê a ele o mesmo AUDIT_API que tools/verify/audit.mjs já tem
(linhas 132–165), para fotografar #/online e #/amigos logados. Use o servidor local e node
tools/verify/seed-server.mjs.

Faça:
1. Identidade primeiro: o cartão do perfil é a primeira coisa depois do título. O aviso "Você guardou o código de
   recuperação?" desce para depois do cartão e fica compacto (uma linha de texto + duas ações pequenas).
2. Cartão limpo como no Figma (.profile-card): capa de 100 px com grade em perspectiva e luz vermelha a 75% 20%;
   avatar de 86 px subindo 41 px sobre a capa; nome em Orbitron 800 ~17 px com o posto como selo pequeno ao lado;
   @usuário em mono --ink-3; etiquetas; grade 2 × 2 de números com filetes --line-2. TIRE do cartão os botões
   "Sincronizar agora" e "Amigos": o estado da nuvem vira uma linha discreta (ponto verde + texto + "Sincronizar"
   como botão de texto, sem vermelho), e a célula "Amigos" da grade vira o atalho para #/amigos.
3. Cabeçalho da página como o .content-head do Figma: marcador, título, uma linha de apoio e, à direita, um
   botão-ícone de 44 px que leva aos dados da conta.
4. Abas: Atividade, Telemetria e uma terceira, CONTA. Mova para a aba Conta tudo o que hoje vem depois do feed:
   Backup automático, Perfil e privacidade, Comparação justa, Trocar a senha, Sair da conta, Como o online funciona,
   Política de privacidade, Servidor e, por último, a zona de perigo. Monte como a lista agrupada do M1 (um painel,
   linhas com filete, uma seta só). Os quatro <details> nativos com triângulo viram linhas desse padrão (R6).
5. Cartão de treino (Atividade) como o .post do Figma: linha de etiqueta (ciano à esquerda; à direita o recorde em
   âmbar, se houver), título em Orbitron ~16 px, data em mono, e os três números numa CAIXA ÚNICA com filetes
   (.workout-data: borda 1 px --line-2, fundo escuro translúcido, células separadas por filete), no lugar das três
   caixas com barra ciano. A borda âmbar do cartão inteiro sai: recorde é só a etiqueta (R4).
6. Tamanhos: tudo que no Figma tem 8–10 px sobe para var(--fs-1). Reaproveite os tokens que já existem (--red-hi,
   --violet, --line-2); não crie hex novo sem necessidade.
7. Tela deslogada (#/online sem conta): os dois <details> nativos também viram o padrão de linha.

Aceite (320, 360, 390, 412, 768 px e 130%, logado e deslogado):
- Na aba Atividade a página tem ≤ 1.500 px em 390 px com 3 treinos (hoje 2.583).
- No máximo 1 botão vermelho cheio visível por vez, fora da zona de perigo.
- Zero <details> com triângulo nativo na tela.
- Nenhum cartão de treino com borda âmbar inteira.
- Nenhum dado inventado; nada novo em server/.
- npm run check passa; verify:layout com AUDIT_API=http://localhost:8787 passa. Antes e depois em 390 px das três
  abas. Não faça commit.
```

### M4 — Amigos (esquadrão) fiel ao Figma

Arquivos: `src/screens/Friends.tsx` (cabeçalho na linha 131, pedidos na 171, feed nas 204–255, ranking na 257, amigos na
284, `AddFriend` na 426) e `src/styles/14-rede.css`. Depende do M3 (reaproveita o cartão de treino e a lista agrupada).

```text
Tarefa: M4 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo. Referência visual:
"Sci-fi UI Kit (Free) (Community) (9)/figma-perfil/" (cartões .side-card, .search-box, .user-row, .rank-row e .post
do index.css.txt). Estado atual: tools/verify/out/plano-antes/amigos.png. Use o cartão de treino e a lista agrupada
que o M3 deixou prontos.

Faça:
1. Ordem da tela: cabeçalho compacto (você) → pedidos de amizade, se houver → RANKING SEMANAL → transmissões →
   adicionar amigo → seus amigos → enviados e bloqueados. Sem nenhum amigo, "adicionar amigo" sobe para logo depois
   do cabeçalho.
2. Ranking como .rank-row do Figma: posição, avatar pequeno, nome, valor à direita; filete entre as linhas; a sua
   linha com fundo vermelho a 6% de ponta a ponta e a etiqueta "VOCÊ". Traço do cartão em violeta (cartões laterais
   do Figma usam violeta, não vermelho).
3. Transmissões: mostre as 5 mais recentes e um botão de contorno "Mostrar mais" (de 5 em 5). Cabeçalho do cartão
   como o .post-head (avatar ou sigla, nome em Exo 2 600 caixa normal, @ e data em mono). Mesmo cartão de treino
   do M3: caixa única de números, recorde só como etiqueta âmbar, sem borda âmbar.
4. Adicionar amigo como o .search-box do Figma: um campo de 44 px com ícone de busca, resultados em linhas
   (.user-row) com um botão pequeno de contorno "Adicionar" em cada uma. A barra vermelha de largura total
   "Enviar pedido" sai. Alvo de toque continua ≥ 44 px mesmo com o botão visualmente pequeno.
5. Pedidos de amizade: "Aceitar" pode ser o único vermelho cheio da tela; "Recusar" é texto.
6. "Seus amigos", "Pedidos enviados" e "Bloqueados": uma lista agrupada só, com rótulo por grupo; os dois últimos
   começam recolhidos com a contagem no resumo.
7. Nomes de pessoa em Exo 2 600, caixa normal (hoje estão em Orbitron).

Aceite (320, 360, 390, 412, 768 px e 130%, com os usuários do seed-server):
- Página ≤ 1.900 px em 390 px com 2 amigos e 14 treinos no feed (hoje passa de 3.600).
- O ranking aparece antes da primeira transmissão.
- No máximo 1 botão vermelho cheio visível por vez.
- Bloquear e denunciar continuam alcançáveis em cada amigo e pedido.
- npm run check passa; verify:layout com AUDIT_API passa. Antes e depois em 390 px. Não faça commit.
```

### M5 — Programas: lista de modelos

Arquivo: `src/screens/Programs.tsx` (linhas 120–146). "Usar este modelo" cria o programa na hora (`create(fromTemplate(…))`),
então a ação continua explícita: só fica mais leve.

```text
Tarefa: M5 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo e olhe
tools/verify/out/plano-antes/programas.png. Modelo interno: a lista "Módulos do protocolo" da tela Hoje.

Problema: 8 cartões de modelo, cada um com um botão de contorno de largura total "Usar este modelo". São 8 botões
iguais empilhados e 8 cartões com 22 px entre eles.

Faça:
1. Cada família ("Modelos base", "Ênfase em pernas e glúteos") vira UM painel com linhas separadas por filete.
2. Linha: nome em Exo 2 600 e, à direita na mesma linha, os códigos dos dias em mono; abaixo, o nível como etiqueta
   pequena e a descrição em --ink-2; a ação vira um botão pequeno de contorno "Usar" alinhado à direita, na linha do
   nível. Tocar em "Usar" faz exatamente o que faz hoje.
3. O cartão "em uso" no topo fica como está. "Não sei qual escolher: me ajude" e "Começar do zero" ficam.
4. Não altere nenhum modelo nem src/data/templates/.

Aceite (320, 360, 390, 412, 768 px e 130%):
- Página ≤ 1.800 px em 390 px (hoje ~2.430).
- Nenhum botão de largura total dentro das linhas de modelo; alvos ≥ 44 px; nenhum código de dia cortado.
- npm run check e verify:layout passam. Antes e depois em 390 px. Não faça commit.
```

### MC1 — Movimento coreografado

```text
Tarefa: MC1 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo (principalmente a
tabela das famílias de movimento) e abra #/kit para ver as peças e os tokens que o MC0 deixou.

Não toque no treino em andamento (SessionView) nem no boot.

1. Inventário: classifique cada @keyframes existente numa das seis famílias (ligar, toque, mira, leitura, recompensa,
   ambiente). O que não couber em nenhuma, ou repetir outra, sai ou é fundido. Troque tempos e curvas soltos pelos
   tokens do MC0.
2. Ligar: toda troca de rota usa a mesma entrada (moldura desenha, conteúdo aparece em cascata de até 6 itens). Hoje
   cada tela entra de um jeito.
3. Mira: filtros de Exercícios, abas do perfil, dia e semana no Hoje, mês no Histórico e as abas do Guia usam as
   cantoneiras ciano que saltam para o item escolhido.
4. Leitura: números de destaque (grade do perfil, resumo do Progresso, totais do Relatório, meta semanal) usam o
   <Ticker>; barras de progresso usam a barra segmentada que enche por segmento. Só na primeira vez que entram na
   vista, não a cada rolagem.
5. Recompensa: confirme que a falha + clarão + vibração só dispara em recorde, meta batida, posto novo e mesociclo
   fechado. Remova de qualquer outro lugar.
6. Ambiente: no máximo 2 laços visíveis por tela, e eles pausam fora da vista (IntersectionObserver ou
   animation-play-state). Liste por tela quantos ficaram.

Aceite:
- Tabela "animação → família → onde dispara" entregue; nenhuma animação sem família.
- Nenhuma @keyframes anima propriedade fora de transform, opacity e cor (rode o script do MC0).
- Com reduzir movimento e em fx-min, nada se move e nenhum conteúdo fica invisível.
- Troca de rota no navegador com CPU reduzida em 4×: sem quadro acima de 50 ms causado pelas animações novas (grave
  com o painel de desempenho e informe o pior quadro).
- npm run check, verify:layout (100% e 130%) e verify:e2e passam; tagcheck do banner do Hoje com as mesmas medidas.
Não faça commit.
```

### MC2 — Momentos de jogo

```text
Tarefa: MC2 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo e abra #/kit.
Referências: cyberpunk-2077-perks.png e cyberpunk-2077-cyberware.png no kit. Só dados que já existem: nada de pontos,
moedas ou níveis inventados, nada novo no servidor.

1. Posto com progresso: leia rankOf em src/lib/profile.ts. No perfil, o posto vira um hexágono aceso com uma barra
   segmentada até o próximo posto e o texto "faltam N sessões". Ao subir de posto, dispara a família recompensa uma
   vez (guarde o último posto visto para não repetir).
2. Conquistas em grade de hexágonos: ache onde computeAchievements é mostrado hoje. Troque a lista por uma grade de
   hexágonos (travado = slot com hachura; conquistado = aceso na cor do setor). Tocar abre o painel de detalhe com o
   que é e o que falta, em texto simples. Leitor de tela lê nome e estado de cada um.
3. Miniaturas de exercício: na grade de Exercícios, as fotos de academia destoam do resto. Enquadre cada miniatura
   num slot com cantoneiras e aplique um tratamento só de CSS (menos saturação, mais contraste, véu na cor do setor,
   linhas de varredura bem leves), como o .post-image do Figma em figma-perfil/index.css.txt. Na página do exercício
   as fotos de execução ficam nítidas, só com a moldura.
4. Estados vazios (sem treinos, sem amigos, sem recordes, busca sem resultado): todos usam o slot vazio (hachura, "+"
   ou radar) com uma frase e uma ação. Hoje cada um tem um desenho.
5. Painel principal de cada tela: aplique o painel com faixa cheia na cor do setor ao bloco mais importante de
   Histórico (calendário), Progresso (resumo), Relatório, Programas (programa em uso), Conta (perfil) e Amigos
   (ranking). Um por tela, dois no máximo.

Aceite (320, 360, 390, 412, 768 px e 130%):
- Cada número mostrado sai de uma função existente (cite qual).
- Hexágonos com alvo ≥ 44 px e sem depender só de cor para dizer travado ou conquistado.
- Contraste do texto sobre a faixa cheia de cada setor ≥ 4,5:1 (meça).
- O número de contêineres com borda por tela não aumentou em relação ao fim do M5.
- npm run check, verify:layout e verify:e2e passam. Antes e depois em 390 px de cada tela tocada. Não faça commit.
```

### M6 — Passada geral de consistência

```text
Tarefa: M6 do docs/plano-refino-visual.md. Leia as seções 2, 3 e 3A desse arquivo antes de tudo. Este módulo não
redesenha telas: aplica as regras R1–R11 no que sobrou. Não toque no banner de missão do Hoje, no treino em
andamento, no boot nem na barra de abas.

1. Vermelho (R4): liste, por tela, quantos .btn-primary e .btn-danger ficam visíveis ao mesmo tempo. Onde houver
   mais de um vermelho cheio fora da zona de perigo, rebaixe os secundários para contorno ou texto.
2. Traço vermelho dos cartões: fica só em cartão de seção. Cartões pequenos em sequência (3 ou mais iguais seguidos)
   perdem o traço ou viram linhas de um painel.
3. Orbitron (R5): procure usos de var(--tech) em texto com mais de 3 palavras, em nomes de pessoa, em nomes de
   treino dentro de lista e em tamanhos abaixo de 13 px. Troque por Exo 2 600 (ou mono, se for rótulo). Títulos de
   página, números de destaque e nomes curtos de cartão ficam.
4. Recolhíveis (R6): Hoje (SysModule "2 avisos"), Progresso ("Grupos musculares 08") e qualquer <details> restante
   usam a mesma seta à direita que gira; a contagem, quando houver, fica antes da seta, em mono.
5. Espaço (R8, R1): troque vãos soltos por --sp-1..6 nas telas tocadas pelos módulos anteriores e garanta vão dentro
   do grupo ≤ metade do vão entre grupos. Compare o CSS do vite build antes e depois.
6. Hoje: os dois links "Trocar o protocolo de hoje" e "Editar programa" quebram em duas linhas desiguais em
   390 px. Ajuste para ficarem numa linha cada, lado a lado, ou empilhados e alinhados.
7. Opcional, se sobrar fôlego: ensine tools/verify/audit.mjs a acusar (a) mais de um botão vermelho cheio visível no
   mesmo quadro e (b) <details> sem a classe do padrão. Assim as regras deixam de depender de revisão no olho.

Aceite: npm run check, verify:layout (normal e 130%) e verify:e2e passam; tagcheck do banner do Hoje continua com
as mesmas medidas (rode-o: esta passada não pode mexer nele). Entregue uma tabela "tela → o que mudou" e fotos de
antes e depois em 390 px de todas as rotas. Não faça commit.
```

## 5. Técnicas para o app todo (resumo do que os módulos aplicam)

1. **Painel com linhas no lugar de pilha de cartões.** É a mudança de maior efeito. Vale para qualquer lista de 3 ou
   mais itens do mesmo tipo.
2. **Razão de vãos 2:1.** Dentro do grupo, 0–12 px; entre grupos, 24–32 px. A tela ganha "parágrafos".
3. **Rótulo apagado, valor aceso.** Rótulo mono 11 px em `--ink-3`; valor em `--ink`. É o que dá o ar de painel de
   instrumentos sem precisar de mais brilho.
4. **Um vermelho cheio por tela.** O resto é contorno, texto ou ciano. O vermelho volta a significar "é aqui".
5. **Orbitron em três lugares.** Título da página, número grande, nome curto de cartão. Lista lê-se em Exo 2.
6. **Caixa única com filetes para trios de números.** Três caixas com barra colorida pesam o triplo de uma caixa
   dividida por dois filetes.
7. **Ação pequena em linha de lista.** Botão de contorno pequeno à direita (com área de toque de 44 px), nunca barra
   de largura total repetida.
8. **Listas longas mostram 5 e oferecem mais.** Feed, histórico de amigos, resultados.
9. **Brilho e animação só no foco.** Um elemento com brilho por tela (o botão principal ou o dado do dia). O kit diz
   o mesmo: "quando tudo brilha, nada se destaca".
10. **Todo enfeite passa na pergunta "isso informa o quê?".** Se a resposta for "nada", sai.

## 6. Fontes

Consultadas na internet (12 nov 2026):

- NN/g, proximidade: <https://www.nngroup.com/articles/gestalt-proximity/>
- NN/g, região comum: <https://www.nngroup.com/videos/common-region-gestalt/>
- NN/g, acordeões e conteúdo complexo: <https://www.nngroup.com/articles/accordions-complex-content/>
- Refactoring UI (Wathan e Schoger): <https://refactoringui.com/>
- Análise do HUD do Cyberpunk 2077: <https://medium.com/super-jump/a-ux-analysis-of-cyberpunk-2077s-hud-f74afe6b9961>
- Crítica de UX/UI do Cyberpunk 2077: <https://interfaceingame.com/articles/cyberpunk-2077-ux-ui-critique>
- GDC, "User Interface in Cyberpunk 2077": <https://gdcvault.com/play/1034160/User-Interface-in-Cyberpunk-2077>
- Mark Coleran sobre interfaces de cinema: <https://www.pushing-pixels.org/2021/12/21/pragmatic-futurism-and-screen-graphics-interview-with-mark-coleran.html>
- Material Design, tema escuro e superfícies tonais: <https://m2.material.io/design/color/dark-theme> e
  <https://material.io/blog/tone-based-surface-color-m3>

Do kit local (`Sci-fi UI Kit (Free) (Community) (9)/`): `Cyberpunk.md` e `Dark_Futurism.md` (princípios, "Do's and
Don'ts"), `_SliderToggle.png`, `Content Switcher.png`, `Navigation Bar.png`, e o protótipo `figma-perfil/`.

De conhecimento geral, sem consulta nesta data (confira se for citar): efeito de isolamento (von Restorff, 1933), lei
de Jakob, Tufte (_The Visual Display of Quantitative Information_), WCAG 2.2.
