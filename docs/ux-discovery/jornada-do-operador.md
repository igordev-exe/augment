# Jornada do operador — AUGMENT

> Mapa de jornada (skill `user-journey`). Persona: **Igor**, único usuário. Treina hipertrofia 5×/semana com uma ficha
> fixa (Push/Pull/Lower), registra no celular entre as séries e revisa o progresso em casa.
> Tipo de software: PWA mobile offline (dados só no IndexedDB do aparelho).
>
> **Base:** tirado do código e das telas atuais (nov/2026), não de observação em campo. Duração e sentimentos são
> **hipóteses** para você confirmar ou corrigir; o laudo do avaliador está em
> [avaliacao-ui-ux.md](avaliacao-ui-ux.md).

## Contexto de uso que pesa em todas as fases

- Uma mão só, às vezes suada ou de luva. Luz forte e branca da academia. Celular apoiado no banco ou no bolso.
- Janela de atenção: o descanso de 1 a 3 min entre séries. Cada toque compete com recuperar o fôlego.
- Ruído e distração: o som do timer pode não ser ouvido, e a vibração ajuda mais.
- Em casa, a revisão é longa e sem pressa: aqui a densidade de informação ajuda.

---

## J1 · Treino na academia (jornada principal)

### Estado atual

| Fase          | Ação                                                                                               | Ponto de contato                                                         | Pensando                                    | Sentimento (hipótese)  | Atritos                                                                                                                                                     | Duração            |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1. Gatilho    | Chega na academia e abre o app                                                                     | Ícone PWA → **Treino** (Today)                                           | "Qual é o treino de hoje?"                  | neutro → confiante     | Hero grande com arte e sticker: o nome do protocolo aparece, mas o botão de iniciar fica abaixo da dobra em telas pequenas                                  | ~10 s              |
| 2. Decidir    | Confere o protocolo ou troca o do dia                                                              | Card "Iniciar protocolo", "Trocar o protocolo de hoje", lista de módulos | "Dá para fazer hoje? A máquina está livre?" | confiante              | Trocar o protocolo abre uma lista longa; não há aviso de quanto a troca bagunça a semana                                                                    | 10–30 s            |
| 3. Check-in   | Sono, energia, dor (ou "pular")                                                                    | Bloco de check-in no topo da sessão                                      | "Mais uma pergunta antes de começar"        | levemente impaciente   | São três perguntas em sequência antes da primeira série; pular é um link pequeno                                                                            | 5–15 s             |
| 4. Séries     | Aquecimento, depois as séries de trabalho: carga, reps e RIR, marcar feita                         | `SetRow`, `PlanCard` (sugestão de carga), timer                          | "Quanto coloco? Bati a faixa?"              | focado                 | Inputs numéricos pequenos para dedo suado; o RIR é marcado depois da série (um toque extra por série); toasts de nudge aparecem justo quando o timer começa | 45–70 min no total |
| 5. Descanso   | Timer conta, nudge de carga, próxima série                                                         | `TimerBar` fixo, HUD                                                     | "Quanto falta? O que vem agora?"            | ansioso → pronto       | A informação da próxima série está no PlanCard, que pode ter saído da tela com a rolagem; o fim do descanso depende de som/vibração                         | 1–3 min por série  |
| 6. Imprevisto | Máquina ocupada, dor, superset                                                                     | Menu radial (trocar exercício, nota, vídeo), toasts                      | "Troco ou espero?"                          | frustrado              | O menu radial é descoberto só por quem já sabe que existe; a alternativa da biblioteca muda a carga sugerida                                                | variável           |
| 7. Encerrar   | Feedback por exercício (pump, volume, articulação), cardio opcional, notas, **Concluir protocolo** | Fim da sessão, botão vermelho grande + "segurar para descartar"          | "Acabou, quero ir embora"                   | cansado                | O formulário de cardio/notas fica antes do botão de concluir; o feedback por exercício pede muitos toques no fim                                            | 1–3 min            |
| 8. Recompensa | Log em terminal digitando, recordes com glitch, card de compartilhar                               | `TerminalLog`, `ShareWorkoutCard`                                        | "Bati recorde?"                             | satisfeito / encantado | Animação longa se só quer fechar o app                                                                                                                      | 5–15 s             |

### Momentos da verdade

**Decidem se o registro continua**

- **Primeira série do dia (fase 4):** se marcar carga e reps exigir precisão de mira ou várias correções, o registro vira tarefa. Lei de Fitts e contexto de uma mão só.
- **Fim do descanso (fase 5):** se o timer não chama a atenção, o próximo set começa sem registrar o anterior, e os dados ficam furados.
- **Concluir (fase 7):** é o pico-fim da sessão (lei do pico-fim). Um final arrastado contamina a memória do treino inteiro.

**Picos de atrito**

- Sequência check-in → primeira série: três decisões antes de qualquer peso.
- RIR como toque extra em toda série.
- Recuperar o contexto ("qual série é esta?") depois de rolar a tela durante o descanso.

**Momentos de encanto (preservar)**

- Sugestão de carga com a regra explicada (dupla progressão, deload), que dá confiança sem pensar.
- "Segurar para confirmar" no descarte: o erro grave é evitado sem diálogo modal.
- Log de terminal e glitch de recorde: a recompensa é forte e combina com a identidade.
- Etiqueta do protocolo e o HUD: a sensação de "sistema" pedida pela estética.

### Estado desejado

| Fase          | Ação (melhorada)                                                   | Oportunidade de design                                                                                                  | Métrica                                                     |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1. Gatilho    | Abre e o "Iniciar" está na primeira dobra                          | Hero compacto em telas < 700 px de altura; o botão fica sempre visível                                                  | Tempo até o 1º toque em Iniciar < 5 s                       |
| 3. Check-in   | Uma tela, três chips de toque grande, padrão "ok" pré-selecionado  | Check-in em uma linha com padrões; responder é opcional e não bloqueia a 1ª série                                       | % de check-ins respondidos (não pulados)                    |
| 4. Séries     | Toque único "feita" que copia carga/reps sugeridos; ajuste por +/− | Botões grandes (≥ 44 px) e entrada por incremento; RIR em chips logo após marcar, com o último valor já pré-selecionado | Séries registradas / séries planejadas; correções por série |
| 5. Descanso   | O timer mostra a próxima série (exercício, carga e reps)           | HUD fixo com o "próximo" e vibração no fim; rolar até a série atual ao terminar o descanso                              | Séries iniciadas sem registrar a anterior → 0               |
| 6. Imprevisto | "Trocar exercício" visível no bloco do exercício                   | Ação visível além do radial (o radial vira atalho, não o único caminho)                                                 | Trocas feitas sem abrir a ajuda                             |
| 7. Encerrar   | Concluir primeiro; o feedback é opcional e rápido                  | Botão Concluir fixo no fim da lista de exercícios; cardio e notas recolhidos                                            | Tempo do último set até concluído < 30 s                    |
| 8. Recompensa | Recompensa curta, com opção de pular                               | Toque para pular o log; o glitch só em recordes                                                                         | —                                                           |

---

## J2 · Revisão semanal em casa

| Fase            | Atual                                               | Atrito                                                                                            | Desejado                                                                                            | Prioridade |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Entrar          | Progresso → longa sequência de painéis              | Antes desta rodada, a tela era muito extensa; hoje os subsistemas ficam recolhidos                | Manter recolhidos e mostrar o resumo na barra                                                       | — (feito)  |
| Ler o estado    | Mapa de fadiga, roda de atributos, séries da semana | Três visualizações densas seguidas, cada uma com vocabulário próprio (nível, índice, fracionadas) | Um resumo de 3 linhas no topo: "faltam X séries em Y músculos; atributo mais baixo; próximo treino" | Alta       |
| Decidir         | Relatório da semana / Treinador                     | O que fazer está espalhado entre nudges, relatório e treinador                                    | Cada painel termina com uma ação ("ver no relatório", "perguntar ao treinador")                     | Média      |
| Registrar corpo | Biometria → + Registrar                             | O formulário fica dentro do módulo; o peso é digitado com vírgula ou ponto (aceita os dois)       | Atalho "registrar peso" na barra do módulo                                                          | Média      |

## J3 · Caminhos de erro

| Situação                           | O que acontece hoje                                                                               | Risco                                                                          | Desejado                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Esqueceu de concluir o treino      | O treino fica aberto; a duração é cortada pela última série, com um aviso                         | Baixo: já tratado                                                              | Manter                                                                       |
| Marcou série errada                | Desmarcar e editar no próprio `SetRow` (inputs numéricos, sem botões +/−)                         | Médio: depende de mirar no campo certo                                         | Desfazer no toast ("Série 3 marcada · desfazer")                             |
| Perdeu o celular / limpou os dados | Lembrete de backup na tela Treino a cada 14 dias (com backup em um toque) e pontos de restauração | Médio: os dados só existem no aparelho, e 14 dias de treino podem ser perdidos | Encurtar para 7 dias, ou oferecer o backup no fim do último treino da semana |
| Dia perdido                        | A sequência continua de onde parou                                                                | Baixo                                                                          | Manter                                                                       |
| Treinador sem internet             | Tela do treinador                                                                                 | Médio                                                                          | Mensagem clara de offline, e o restante do app funciona                      |

## Análise de lacunas

| Fase            | Estado atual                        | Estado desejado                     | Lacuna                                          | Prioridade |
| --------------- | ----------------------------------- | ----------------------------------- | ----------------------------------------------- | ---------- |
| J1·4 Séries     | Inputs + RIR depois                 | Toque único e +/− grandes           | Ergonomia de toque e número de toques por série | **Alta**   |
| J1·5 Descanso   | Timer + PlanCard que rola para fora | HUD com "próxima série" e vibração  | Visibilidade do estado do sistema               | **Alta**   |
| J1·7 Encerrar   | Formulários antes do Concluir       | Concluir primeiro, o resto opcional | Pico-fim e carga no fim                         | **Alta**   |
| J1·3 Check-in   | 3 perguntas bloqueando o topo       | Uma linha com padrões               | Fricção antes da 1ª série                       | Média      |
| J1·6 Imprevisto | Só pelo menu radial                 | Ação visível + radial como atalho   | Descoberta                                      | Média      |
| J2 Ler o estado | 3 visualizações densas              | Resumo acionável no topo            | Carga cognitiva                                 | Média      |
| J3 Backup       | Lembrete a cada 14 dias             | Oferta de backup no fim da semana   | Janela de perda de dados                        | Baixa      |
| J1·1 Gatilho    | Iniciar abaixo da dobra             | Iniciar sempre visível              | Lei de Fitts e hierarquia                       | Média      |

## Para validar com você

1. Quanto tempo leva, de verdade, do último set até tocar em **Concluir protocolo**?
2. Você marca o RIR em toda série ou pula?
3. Já começou uma série sem ter registrado a anterior? Com que frequência?
4. O check-in parece útil ou burocrático?
5. O lembrete de backup a cada 14 dias aparece num bom momento ou atrapalha?
