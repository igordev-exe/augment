# Avaliação de UI/UX — AUGMENT (nov/2026)

> Laudo de um agente avaliador, com base na _Enciclopédia de Princípios de Design_: ISO 9241-110:2020, WCAG 2.2, APCA,
> leis de UX e tokens DTCG. Foi complementado com heurísticas de Nielsen, guias de movimento e o contexto da academia.
> Junta-se ao mapa de jornadas em [jornada-do-operador.md](jornada-do-operador.md).
>
> **Como foi medido.** O avaliador não conseguiu abrir o app no navegador e trabalhou a partir do código e do CSS.
> Contrastes (WCAG 2 e APCA-W3) e larguras de número (métricas das fontes) foram calculados. Posições e tamanhos de
> layout estão marcados como _estimado_. Conferi no código os achados 1, 3, 5 e 14: estão corretos.

## Veredito

A identidade cyberpunk é coesa, e o núcleo do treino é muito bom:

- O ✓ grava a sugestão.
- O PlanCard tem números de 30 px.
- Descartar exige segurar o botão.
- A roda radial tem alvos grandes.
- O app inteiro respeita "reduzir movimento".

O texto principal tem contraste excelente (15,6:1). Os problemas estão na **camada apagada**:

- o peso sugerido aparece a 2,38:1;
- o botão vermelho tem 4,09:1;
- os rótulos de 9–10 px do Progresso ficam em 3,6–4,6:1.

Há também números que não cabem no campo de peso em 360 px, um "Concluir" de um toque que descarta as séries
pendentes e 18 animações infinitas sem pausa. **A estética não é o problema: falta um piso de legibilidade e de
movimento por baixo dela.**

## Notas por eixo (0–10)

| Eixo                         | Nota | Por quê                                                                                    |
| ---------------------------- | ---- | ------------------------------------------------------------------------------------------ |
| Hierarquia visual            | 6,5  | No treino é ótima; na Home o "Iniciar" fica abaixo de conteúdo decorativo e de avisos      |
| Legibilidade / contraste     | 4,5  | Núcleo 15,6:1; placeholder, botão primário e textos de 9–10 px falham                      |
| Ergonomia de toque           | 6,5  | Nav, ✓ e roda excelentes; ×, "sobra N" e células do mapa do ano pequenos                   |
| Carga cognitiva              | 6,0  | O motor decide por você; a Home acumula decisões e o Progresso abre denso                  |
| Feedback e estado do sistema | 7,5  | HUD, timer e toasts bons; toasts com 3,6 s fixos e relógio que "treme"                     |
| Prevenção e recuperação      | 6,0  | Segurar para descartar e pontos de restauração; Concluir, × e excluir medição sem desfazer |
| Consistência / design system | 5,0  | 280 cores hex soltas, 28 tamanhos de fonte, o "perigo" fica azul no deload                 |
| Movimento / animação         | 5,5  | Reduced-motion exemplar; 18 loops infinitos e cascata de 700 ms                            |
| Acessibilidade               | 5,5  | ARIA cuidadoso; anel de foco cortado pelo recorte chanfrado, mapa do ano sem teclado       |
| Adequação à academia         | 6,5  | Registro rápido; contraste sob luz forte e alvos de 36–38 px nos toques mais frequentes    |

## Lista única de melhorias (laudo + jornadas)

### Prioridade 1 — corrigir já

| #   | Problema                                                                                                                               | Princípio                               | Correção que mantém o visual                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | O peso/reps sugerido (o que o ✓ grava) aparece como placeholder a **2,38:1** (`styles.css` `.field input::placeholder`, opacidade 0,5) | WCAG 1.4.3, APCA, ISO autodescrição     | Sugestão "fantasma" em ciano `#3fd8e0b3` (5,9:1): ciano já significa "o sistema sugere"                   |
| 2   | "Concluir protocolo" é de um toque e **apaga as séries não marcadas** (`SessionScreen.tsx` `finish`), enquanto descartar exige segurar | ISO robustez contra erro, Nielsen #3/#5 | Se houver pendentes: "Faltam N séries — concluir assim?" e depois um toast "Concluído · DESFAZER" por 8 s |
| 3   | Branco sobre o vermelho do botão primário: **4,09:1** (falha o AA em texto de 12–16 px)                                                | WCAG 1.4.3 + APCA                       | Preenchimento `#d42a26` (5,05:1); o `#ef302c` neon fica na borda e no glow                                |
| 4   | Rótulos de 9–10 px do Progresso em `#4f6f78…#5f808a`: **3,6–4,6:1**, Lc 25–32                                                          | WCAG 1.4.3, APCA, luz forte             | Piso de 11 px e `--fm-dim:#8fb3bc` (8,8:1), no mesmo tom petróleo                                         |
| 5   | "82,5" a 20 px em Orbitron mede ~55 px, e o campo útil em 360 px tem ~49 px (_estimado_): o número é cortado                           | Legibilidade, Fitts                     | Unidade "kg" no cabeçalho, padding menor, `clamp(16px,5.2vw,20px)`, colunas assimétricas                  |
| 6   | No deload, o `--red` vira azul e **"Descartar treino" fica azul-claro**: o perigo perde o vermelho                                     | Tokens DTCG, uma cor = um significado   | Separar `color.action` (muda por modo) de `color.danger` (sempre vermelho)                                |

### Prioridade 2 — próxima rodada

| #   | Problema                                                                                                                                          | Correção                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 7   | 18 animações infinitas (≈10 ao mesmo tempo no Progresso), várias que repintam a tela (`stroke-dashoffset`, `top`, `left`), sem pausa (WCAG 2.2.2) | Loops decorativos com 3 iterações, pausa fora da tela e ajuste "Efeitos: Máximo / Academia / Mínimo" ("Academia" no treino) |
| 8   | Cascata de entrada de tela leva até 0,7 s (Doherty: 0,4 s); o feixe roda em toda troca de aba                                                     | Cascata ≤ 300 ms; feixe só no boot e no "Iniciar protocolo"                                                                 |
| 9   | O relógio do timer "treme": a Orbitron não tem algarismos de largura fixa (o "1" é bem mais estreito que o "0")                                   | Cada dígito numa caixa de largura fixa, ou Share Tech Mono só no relógio                                                    |
| 10  | RIR: botões de 38×36 px, o toque mais frequente depois de cada série; o "sobra N" para corrigir tem ~14 px de altura                              | RIR com 48 px e "ALVO" escrito (não só pela cor); tocar na série abre o RIR                                                 |
| 11  | × de remover série com 20×20 px, destrutivo e sem desfazer                                                                                        | Remover (a roda já tem essa ação) ou dar 44 px + "Desfazer"                                                                 |
| 12  | A roda radial reordena as fatias conforme o estado da série: a memória muscular se perde                                                          | Posições fixas; fatia indisponível vira "SLOT OFFLINE" hachurada                                                            |
| 13  | Ações da série (falhou, −15%, intensificador) só existem na roda, por toque longo                                                                 | Botão "⋯" visível de 44 px; a roda vira atalho                                                                              |
| 14  | Anel de foco cortado pelo recorte chanfrado (augmented-ui usa `clip-path`)                                                                        | No foco, a própria borda chanfrada fica ciano com 2 px                                                                      |
| 15  | "Iniciar protocolo" fica perto ou abaixo da dobra em 375×812 (_estimado_), atrás do hero e de até 4 avisos                                        | CTA no topo do cartão de missão; avisos juntos numa faixa "N AVISOS ▸"                                                      |
| 16  | Toasts com 3,6 s fixos, alguns com decisão de treino ("última série vai com −15%")                                                                | Duração pelo tamanho do texto (4–10 s), pausa ao tocar, vibração nos avisos                                                 |
| 17  | Formulários de cardio e notas ficam antes do "Concluir" (jornada J1·7)                                                                            | Concluir primeiro; cardio e notas recolhidos                                                                                |

### Prioridade 3 — sistema e polimento

- **Tokens:** 280 hex soltos, 28 tamanhos de fonte, 198 estilos inline. Proposta: três camadas (primitivo → semântico →
  componente), escala tipográfica de 6 passos (11 / 12,5 / 14 / 15,5 / 20 / 30) e um lint de cor hex fora do `:root`.
- **Mapa do ano:** células de 11 px, sem teclado, e o nível 1 contra o vazio dá 2,06:1. Proposta: alvo por semana
  (≥ 24 px), focável, com níveis ≥ 3:1 entre si.
- **Bordas pouco visíveis:** borda dos campos 1,74:1 e segmento vazio do HUD 1,42:1. Usar `#6b717b` e `#5a606a`
  (≥ 3:1).
- **Texto cinza pequeno:** `--ink-3` tem 6,1:1, mas Lc 42 no APCA. Para texto, usar `#a7b0bb`.
- **Dica "segure":** 9 px a 3,3:1. Subir para 11 px com opacidade 1.
- **Abas do relatório:** estão empilhadas sobre a nav e usam `aria-pressed` em `role=tab`. Mover para o topo e usar
  `aria-selected`.
- **Inputs:** só salvam no `onBlur`. Salvar com debounce de 300 ms, para não perder o valor se a PWA for encerrada
  durante o descanso.
- **Check-in:** mostrar as três perguntas numa linha com "ok" pré-selecionado (jornada J1·3).

## O que preservar

- ✓ que grava a sugestão e entrada que aceita vírgula ou ponto (leis de Tesler e Postel, onde a mão está suada).
- PlanCard (SOBE / MANTÉM / BAIXA + próxima série em 30 px): o melhor elemento de relance do app.
- HoldButton (800 ms, vibração, teclado) e pontos de restauração antes de apagar.
- Roda radial com anel de ~76 px.
- Log de fim de treino com glitch limitado a 2 passadas: um bom pico-fim.
- Paleta de deload como sinal da semana (só falta proteger o "perigo").
- Higiene de movimento: reduced-motion global, reduced-transparency, menos efeito no celular.
- Neon que funciona: ciano 11,2:1, verde 13,1:1.

## Validação

Medir em 3 treinos reais: erros de toque, tempo entre o ✓ e o RIR, e séries começadas sem registrar a anterior. É a
forma de não cair no viés estética-usabilidade (um visual bonito parece fácil de usar sem necessariamente ser).

## Status (6 nov 2026)

Prioridades 1 a 3 aplicadas no commit 889a0ae, com uma revisão em 360 px que corrigiu o timer, o aviso de fadiga
escondido e outros cortes. Prioridade 4:

- **Foco:** anel ciano; nos botões chanfrados o foco vira a própria borda (2 px). Navegação e timer fixos não cobrem o
  elemento focado (`scroll-padding`).
- **Mapa do ano:** nível 1 a 3,4:1 da célula vazia; setas do teclado escolhem o dia; botões ‹ › de 44 px como
  alternativa às células de 11 px.
- **Contraste:** texto terciário `#a0a8b2` (8:1), borda de campo e casa vazia como tokens (≥ 3:1), dica "segure" com
  opacidade 1. Textos em SVG medidos no tamanho real da tela: rótulos do gráfico de peso, da anatomia e o "Fechar" da
  roda passaram de ~7–8 px para ≥ 11 px; "Índice" da roda ficou em ~9,5 px (é o que cabe na pedra).
- **Tokens:** camada de componente (`--field-border`, `--track-empty`, `--focus-ring`) e escala tipográfica de 6
  passos (`--fs-1` … `--fs-6`); 190 tamanhos migrados com no máximo 0,5 px de diferença.
- **Lint:** `style/type-scale` recusa fonte abaixo de 17 px fora da escala (CSS e `fontSize` inline);
  `style/hex-budget` impede que as cores hex fora do `:root` passem de 400 (o número só pode cair).
- **ARIA:** abas do relatório com `aria-selected`, setas/Home/End e só a aba ativa na ordem do Tab.

Fica para depois: migrar as 400 cores hex soltas para tokens (o lint já impede que aumentem) e exportar os tokens no
formato DTCG `.tokens.json`.
