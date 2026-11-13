# Movimento do AUGMENT: animação → família → onde dispara

Inventário do MC1 (`docs/plano-refino-visual.md`, seção 3A). Toda `@keyframes` de `src/styles/` pertence a uma família.
Tempos e curvas novos usam os tokens de `15-pecas.css` (`--t-toque`, `--t-mira`, `--t-ligar`, `--t-cascata`,
`--t-leitura`, `--t-recompensa`, `--ease-seco`). Regra: só `transform`, `opacity` e cor nas `@keyframes`
(`npm run verify:keyframes`); tudo para com "reduzir movimento", `fx-min` e `fx-gym` (`node tools/verify/motion.mjs`).

| Família    | Animação                                                                                                                        | Onde dispara                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Ligar      | `pc-ligar`, `pc-desenha`                                                                                                        | Toda troca de tela (`.app > .stack-lg > *`, cascata de 40 ms, só os 6 primeiros blocos) e `.fx-ligar` nas peças  |
| Ligar      | `route-beam`                                                                                                                    | Feixe ao abrir o app e ao iniciar um protocolo (`fx-boot`)                                                       |
| Ligar      | `vb-row-in`, `aw-core-in`, `aw-node-in`, `aw-hex-spin`, `aw-panel-in`, `fm-callout-in`, `holo-fade`, `holo-draw`, `mod-card-in` | Painéis do Progresso entrando (séries da semana, roda de atributos, mapa de fadiga, gráfico)                     |
| Ligar      | `sysmod-load`, `sysmod-scan`                                                                                                    | Módulo de sistema abrindo (Hoje, Progresso)                                                                      |
| Ligar      | `nav-bar-in`, `dock-drop`, `term-appear`, `term-boot`                                                                           | Barra de abas, botão do banner do Hoje, log de fim de treino (áreas protegidas: não mexer)                       |
| Toque      | `tapfx`, `zap`, `btn-charge`, `radial-in`                                                                                       | Retícula no ponto tocado, luz que varre o botão (`.btn.zap`), menu circular do treino                            |
| Toque      | `nav-glitch`, `nav-light`                                                                                                       | Aba tocada na barra de abas (protegida)                                                                          |
| Mira       | (transição, sem `@keyframes`) `.aim::after`                                                                                     | Filtro de músculo em Exercícios, abas do perfil, abas do Guia, hexágono selecionado; `hud-next` no HUD do treino |
| Leitura    | `pc-seg-fill`, `pc-seg-pat`, `<Ticker>` (JS)                                                                                    | Barra segmentada (`SegBar read`) e números do perfil e do Progresso, só na 1ª vez que aparecem                   |
| Leitura    | `vb-fill`, `aw-seg`, `aw-lock`, `toast-life`, `term-fill`, `term-type`                                                          | Barras de séries, segmentos da roda, valor que trava, tempo do aviso, log de fim de treino                       |
| Recompensa | `glitch-main`, `glitch-a`, `glitch-b`, `pc-clarao`                                                                              | Aviso de recorde e de meta batida (`toast(…, "glitch")` + `RECORD_BUZZ`), posto novo (`RankRow`, `playReward`)   |
| Ambiente   | `led-breathe`, `scan-pass`, `scan-pass-card`                                                                                    | LED do título e da lista, varredura do banner do Hoje                                                            |
| Ambiente   | `fm-signal-flow`, `fm-anatomy-scan` (ficam); `fm-orbit`, `fm-ring-flow`, `fm-reticle` (param no Progresso)                      | Mapa de fadiga                                                                                                   |
| Ambiente   | `aw-flow`, `aw-ring`, `aw-rail`, `sysmod-led`, `holo-ping`, `hm-sweep`, `hm-today`                                              | Roda de atributos, módulos, gráfico e mapa do ano do Progresso                                                   |
| Ambiente   | `scan-beam`, `bm-sweep`, `id-scan`, `id-ring`, `op-scan`, `term-led`, `term-sweep`                                              | Treinador pensando, foto do corpo, portão de login, capa do perfil, log de fim de treino                         |
| Boot       | `boot-draw`, `boot-show`, `boot-reveal`, `boot-bar`, `boot-glitch`                                                              | Abertura do app (protegida: não mexer)                                                                           |

## O que mudou no MC1

- **Entrada de tela única**: `route-rise` (08) e `route-power` (13) concorriam, e a segunda anulava a cascata da
  primeira. As duas saíram; ficou `pc-ligar` com os tokens, em cascata de até 6 blocos. Do 7º bloco em diante não anima.
- **Convertidas para `transform`/`opacity`**: `fm-ring-flow`, `fm-signal-flow`, `aw-flow`, `aw-ring`, `aw-rail` (o traço
  que corria virou pulso de luz); `glitch-a`/`glitch-b` (sem recorte); `aw-lock`, `aw-seg`, `aw-panel-in`, `holo-draw`,
  `zap`, `hm-today`; `scan-beam`, `bm-sweep` e `id-scan` (deslizam por `translate`, não por `left`/`top`/posição do
  fundo).
- **Saiu**: `horizon-drift` (o horizonte do rodapé ficou parado: repintava a grade inteira o tempo todo).
- **Exceções declaradas** em `tools/verify/keyframes.mjs`: `boot-*`, `nav-*` e `term-*`, áreas que o plano proíbe mexer.
- **Ambiente por tela** (laços visíveis ao mesmo tempo, medidos rolando a 390 px): Hoje 1, Histórico 2, Progresso 2,
  demais telas 1.
- **Bug corrigido**: em `13-atmosfera.css`, a regra que parava o LED da lista no modo academia tinha um pseudo-elemento
  dentro de `:is()`, e o navegador descartava a regra inteira. Agora é uma linha para cada.
