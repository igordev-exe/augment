# AUGMENT: plano de mudanças Fable + Argon

Data: 11/11/2026. Ponto de partida: o dossiê do Gemini "Argon" (8 bugs + 85 melhorias). Cada alegação foi conferida no
código atual antes de entrar aqui, e a lista foi completada com o que o dossiê não viu.

Nada neste documento foi implementado ainda. É a lista do que mudar, em que ordem e por quê.

## 1. Em resumo

- **O dossiê acerta o tema central e erra muito detalhe.** O melhor achado dele é real: o app calcula o 1RM estimado de
  jeitos diferentes em lugares diferentes. Mas dos 8 "bugs", só 2 se confirmam como descritos, 4 são verdade pela metade
  e 2 são falsos. Várias funções, arquivos e números citados não existem.
- **Cerca de 20 das 85 melhorias já estão no app**, inteiras ou em boa parte (aquecimento calculado, anilhas por lado,
  "por que essa carga?", fluxo de superset, resumo de fim de treino, exportar CSV, restrição temporária de equipamento,
  força relativa entre amigos…).
- **Umas 15 batem de frente com regras do projeto**: jargão na tela de um app para leigo, servidor sobrescrevendo o
  celular, constantes fisiológicas inventadas sem dado nenhum do próprio app.
- **O que sobra é uma lista curta e boa**: 15 mudanças em 4 ondas (seção 5). A onda 1 é só lógica e teste, cabe numa
  sessão e conserta os números que hoje podem estar errados na tela.

## 2. Placar dos 8 bugs

| Bug    | Alegação                                                    | Veredito                   | O que o código mostra                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BUG-01 | Drop-set e reps altas geram recorde falso de 1RM            | **Confirmado**             | `recordsOf` (`progression.ts:461`), `evaluateSessionPRs` (`:506`) e o gráfico de `ExerciseDetail.tsx:316` contam drop-set e não têm teto de reps. O online já faz certo: sem drop e só até 15 reps (`sync.ts:58`, `:72`, `:75`). O exemplo do dossiê (80 kg × 20 num drop) é improvável; o caso real é a série de trabalho longa (panturrilha, 20 reps). `bestE1rm` (`:620`) já exclui drop, ao contrário do que o dossiê diz. |
| BUG-02 | `mesoReport` mistura variante e ignora as reps que sobraram | **Confirmado, e pior**     | `report.ts:403` casa só por `exId`, sem olhar `alt`; `:420` e `:424` calculam o 1RM sem as reps que sobraram. O corte de série dispara com queda de 3% (`engine.ts:524`), não 5% como o dossiê diz. Então um único treino final na alternativa mais leve já basta para o relatório sugerir tirar série (se houver 3 retornos de "como bateu").                                                                                 |
| BUG-03 | Recuperação aprendida ignora dia só de trabalho indireto    | **Parcial**                | A linha existe (`core/operator.ts:487`), dentro de `operatorState` (a função `learnMuscleRecovery` citada não existe). O efeito é um viés: o intervalo é medido desde o último treino _direto_, então um supino pesado no meio não conta e o app pode concluir "recupera devagar". A correção sugerida não basta: os sinais de queda e de teto só são marcados para músculos diretos (`:468-477`).                             |
| BUG-04 | Mapa de fadiga não usa a recuperação aprendida              | **Metade falso**           | `muscleStatus` já recebe os multiplicadores aprendidos (`visual.ts:81`, `:126`) e o Progresso já passa (`Progress.tsx:59-61`). O Hoje nem chama `muscleStatus`. Só a parte "a recuperação é uma reta" é verdade (`visual.ts:129`).                                                                                                                                                                                             |
| BUG-05 | Só os treinos sincronizam entre aparelhos                   | **Verdade, mas é decisão** | Peso corporal, ajustes e memória só viajam dentro do backup. Isso está escrito como regra ("o celular é a fonte da verdade"). A correção proposta (última escrita vence nos ajustes) quebra essa regra. Há um caminho mais barato: ver M13.                                                                                                                                                                                    |
| BUG-06 | Tendência de peso dá saltos                                 | **Parcial**                | A linha do gráfico é a média dos 7 últimos _registros_, não dos últimos 7 dias (`BodyLab.tsx:32-35`): com pesagens espaçadas, mistura semanas diferentes. Isso é real. Já o ritmo semanal (`weightTrend`, regressão de 28 ou 56 dias, `visual.ts:324-353`) funciona; o "efeito penhasco" precisa ser medido antes de trocar a conta.                                                                                           |
| BUG-07 | Check-in dentro do treino não muda o treino                 | **Parcial**                | Muda sim: pede +1 rep de sobra (`ExerciseBlock.tsx:128`), baixa 1 rep da meta (`:174`), desliga intensificadores (`SessionScreen.tsx:157`) e mostra o aviso (`mesocycle.ts:130`). O que não faz é tirar séries, e o `planDay` roda no Hoje, antes de o check-in existir.                                                                                                                                                       |
| BUG-08 | Superset não alterna nem ajusta o descanso                  | **Falso**                  | `SessionScreen.tsx:239-271`: depois do A1 vai direto para o A2 sem timer; depois do A2 descansa 60 s e volta ao A1; aquecimento descansa 60 s. Existe um defeito vizinho que o dossiê não viu: ver F2.                                                                                                                                                                                                                         |

## 3. O que o dossiê propõe e o app já tem

| Item do dossiê                      | Onde já está                                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A01 aquecimento calculado           | `warmupSpec` (50% × 8, 75% × 4 ou 65% × 6), usado em `ExerciseBlock.tsx:581`                             |
| A02 anilhas por lado                | `platesForBarbell`, `ExerciseBlock.tsx:143`. Falta só o peso da barra ajustável (M8)                     |
| A04 / BUG-08 superset               | `SessionScreen.tsx:239-271`                                                                              |
| A07 "por que esta meta?"            | `explainLoad` e a lista `.why-load` na dobra do PlanCard                                                 |
| A09 descanso conforme a série       | aquecimento 60 s, A2 60 s. O "+30 s depois de falha" não existe                                          |
| A13 fechamento do treino            | `TerminalLog` + recordes + `ShareWorkoutCard` em `finish()`                                              |
| B06 semana pelo que foi feito       | `reentryFor`: propõe recomeçar ou repetir a semana, com a pessoa decidindo                               |
| B07 deload antecipado               | `fatigueDeloadFor` / `fatigueAlert`. O deload só de um grupo muscular não existe                         |
| C08 modo viagem                     | restrição `equipment` com validade na memória do operador (`core/intents.ts:253`), sem mexer no programa |
| D03 tocar no músculo                | `FatigueMap` já seleciona a zona e mostra o painel (`FatigueMap.tsx:186`)                                |
| D05 faixa do mesociclo              | `WeekStrip` no Hoje                                                                                      |
| E04 gravação a cada tecla           | já espera 300 ms depois da última tecla (`SetRow.tsx:138`, `:158`)                                       |
| E05 duas abas                       | o Dexie 4 já avisa as outras abas pelas `liveQuery`                                                      |
| E06 exportar CSV                    | Ajustes → "Exportar séries (.csv)" (`SettingsScreen.tsx:89`)                                             |
| E09 histórico pesado                | o Histórico já navega por mês                                                                            |
| F02 recorde de reps na mesma carga  | PR do tipo `reps` em `evaluateSessionPRs`                                                                |
| F05 comparação justa entre amigos   | força relativa e faixa de sexo e peso no `CommunityCard`                                                 |
| G03 série-âncora + séries de volume | `Suggestion.volumeWeight` já sustenta esse formato                                                       |
| G05 modelos por número de dias      | 8 modelos: fb-3, ul-4, ul-forca, ppl-v2, ppl-6 e as 3 versões de glúteo                                  |
| G08 filtro por equipamento          | tela Exercícios                                                                                          |

**Erros de fato no dossiê** (para não herdar): o mesociclo tem 7 semanas (6 de carga + deload), não 6, e os rótulos "S1
BASE … S6 DELOAD" não existem; os arquivos `src/data/exercises.ts`, `06-telas.css` e `11-utilitarios.css` não existem;
as funções `learnMuscleRecovery`, `proteinTarget` e `detectIntent` não existem (a de intenções é `matchIntent`); `e1rm`
tem 2 argumentos, não 3; o servidor não tem proxy de IA (o treinador usa a chave da própria pessoa).

## 4. O que o dossiê não viu (análise própria)

**F1. São quatro réguas de 1RM estimado, não duas.** O dossiê compara só o online com o local. Na verdade:

| Régua                                  | Onde                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Com drop-set, qualquer número de reps  | recordes e PRs (`progression.ts:461`, `:506`), gráfico do exercício (`ExerciseDetail.tsx:316`) |
| Sem drop, qualquer número de reps      | força relativa (`visual.ts:423`), mini-histórico (`ExerciseBlock.tsx:151`), `mesoReport`       |
| Sem drop, somando as reps que sobraram | `bestE1rm` (`progression.ts:620`): estagnação e regressão                                      |
| Sem drop, só até 15 reps               | o que sobe para o servidor (`sync.ts:75`)                                                      |

Consequência prática: o recorde que a pessoa vê na página do exercício pode ser diferente do que os amigos veem dela.
Consertar um ponto de cada vez, como o dossiê sugere, deixa as outras três divergindo. A correção certa é uma régua só
(M1).

**F2. Superset com número diferente de séries.** Quando o A1 tem mais séries pendentes que o A2 (ajuste de fim de
mesociclo, série removida, programa montado pela pessoa), marcar a série do A1 não inicia descanso nenhum e joga o foco
para o A2 já completo (`SessionScreen.tsx:241-243` e `:260-263` não olham se o parceiro ainda tem série). O PPL padrão
não cai nisso (3 e 3), mas qualquer ajuste cai.

**F3. Não existe limite de digitação.** `parseNum` (`SetRow.tsx:6-11`) aceita qualquer número ≥ 0. Digitar 800 em vez de
80 vira "Carga máxima: 800 kg" e fica no recorde local até a pessoa achar e corrigir a série. O servidor corta pelo
`LIMITS.maxKg`; o celular não. O dossiê cita isso (A12), mas como melhoria de conforto. É correção de dado.

**F4. Trocar a fórmula do 1RM quebra mais do que conserta.** O dossiê propõe uma curva híbrida acima de 10 reps. Só que
`predictReps` (`progression.ts:138`) é o Epley invertido e decide se um salto de carga cabe; mudar um sem o outro
desalinha a sugestão de carga. Além disso, os recordes no servidor foram calculados com Epley puro e deixariam de ser
comparáveis. Um teto de reps resolve o mesmo problema sem esses dois efeitos.

**F5. Constantes inventadas.** Expoente 1,35 na curva de recuperação, 0,40 de barra para halter, 0,93 do peso corporal
na barra fixa, α de 0,15 no peso: nenhuma vem de dado do app. O AUG.CORE já tem o padrão certo para isso: aprender do
histórico da pessoa com um grau de confiança, e ficar calado enquanto não souber. Onde não dá para aprender, é melhor
mostrar a referência crua ("no titular você usou 80 kg") do que um número calculado com cara de certeza.

**F6. Voz não é "grátis e local" no APK.** O reconhecimento de fala do navegador não existe dentro do WebView do Android
(que é onde o app roda no APK), e no Chrome ele manda o áudio para o Google. Para funcionar no celular precisa de um
plugin nativo do Capacitor. É viável e sem custo, mas é outro tamanho de tarefa. (Confirmar na documentação antes de
começar.)

**F7. Jargão.** SFR, MEV/MAV/MRV, carga axial, DOTS, "telemetria", "gêmeo digital": o projeto tem a regra de texto sem
jargão para a pessoa, e o público é leigo. Essas ideias podem até alimentar o motor por dentro, mas não viram rótulo de
tela.

**F8. Recorde não vibra.** A vibração só sai em aviso e erro (`hooks.tsx:147`) e no fim do descanso. O momento de
recorde, que é o pico do treino, só pisca na tela. É a melhoria mais barata da lista inteira (M7).

**F9. Restaurar da nuvem só substitui, mas juntar já existe.** `restoreCloudBackup` chama
`importBackup(parsed, "replace")` (`sync.ts:275`), e `importBackup` já tem o modo `"merge"` que junta peso corporal,
programas e memória do operador (`db.ts:481-552`). Um botão "Juntar com este aparelho" resolve quase todo o BUG-05 sem
tabela nova no servidor e sem o servidor mexer em nada sozinho.

## 5. Plano de mudanças

Critério de ordem: primeiro o que pode estar mostrando número errado hoje; depois o que tira toque e conta de cabeça no
meio do treino; depois o resto. Toda mudança de lógica vem com teste ao lado; toda mudança visual passa pela auditoria
de larguras (320 a 820 px, texto a 130%, WebKit).

### Onda 1: números certos (só lógica e teste, 1 sessão)

**M1. Uma régua só para o 1RM estimado.** _(BUG-01, B01, F1)_

- Em `progression.ts`: exportar `E1RM_MAX_REPS = 15` e uma função única que devolve o 1RM de uma entrada (sem drop-set,
  só séries de até 15 reps), com a opção de somar as reps que sobraram.
- Trocar por ela: `recordsOf`, `evaluateSessionPRs`, `ExerciseDetail.tsx:316`, `visual.ts:423`,
  `ExerciseBlock.tsx:151`, `report.ts:420/424`, e `sync.ts` passa a importar a constante.
- Regra de uso: **recorde** não soma sobra (é o que foi feito); **comparação entre semanas** soma (semana 1 para com 2–3
  sobrando, semana 6 vai à falha).
- Não mexer na fórmula de Epley nem em `predictReps`. "Carga máxima" e "recorde de reps" continuam como estão.
- Testes: drop de 80 × 20 depois de 100 × 8 não gera PR de 1RM; série de 20 reps não gera PR de 1RM; o melhor 1RM local
  bate com o de `libraryBests`.
- Efeito colateral aceito: recordes de 1RM antigos que vieram de séries com mais de 15 reps somem da lista. Nenhum
  dado é apagado (os PRs são recalculados na hora).

**M2. Relatório do mesociclo compara a mesma variante.** _(BUG-02, B08)_

- Em `mesoReport` (`report.ts:400-428`): comparar primeira e última sessão **da mesma variante**: a titular se tiver
  pelo menos 2 sessões no ciclo, senão a variante mais usada. Usar a régua do M1 com sobra.
- Teste em `report.test.ts`: último treino feito na alternativa mais leve não gera queda nem sugestão de tirar série.

**M3. Trava contra erro de digitação.** _(A12, F3)_

- Ao marcar a série (`ExerciseBlock.tsx:213`): se a carga passar de 1,5× a maior já registrada no exercício (com
  histórico de 20 kg ou mais), ou as reps passarem de 50, a série é marcada, mas sai um aviso com o botão "Corrigir" (o
  toast já aceita ação, como no "Desfazer" do fim do treino).
- Teste: a regra fica numa função pura em `lib/` (800 depois de 80 dispara; 82,5 depois de 80 não; primeira vez não).

**M4. Superset com séries desiguais.** _(F2)_

- Em `onSetDone` (`SessionScreen.tsx:241`, `:260`): se o parceiro não tem série pendente, o A1 segue o caminho normal
  (descanso do exercício, foco na próxima série dele).
- Teste: tirar a decisão "para onde vai o foco e quanto descansa" para uma função pura e cobrir os três casos (par
  igual, A1 maior, A2 maior).

### Onda 2: menos toque no meio do treino (visual, 1–2 sessões)

**M5. Botões − e + na próxima série.** _(A03)_

- Peso anda pelo passo do exercício (`increaseStep` / `nextAvailableWeight`, respeitando os pesos da máquina); reps
  andam de 1 em 1.
- Colocar no **PlanCard** (onde a próxima série já aparece grande e já existem os botões de "Superar a última vez"), não
  na linha da série: em 320 px a linha não tem largura para mais quatro alvos de 44 px.

**M6. Check-in que age, com um toque.** _(BUG-07, C01)_

- Quando o check-in marca dia de baixa ou dor e ainda há séries pendentes: oferecer "Tirar 1 série dos isolados hoje".
  Usa os pisos que o planejador já garante (2 séries em composto, 1 em isolado), só mexe na sessão aberta, tem
  "Desfazer". O programa não muda.
- Teste em `guarantees.test.ts`: nunca abaixo do piso, nunca remove série já feita.

**M7. Recorde vibra.** _(E03, F8)_

- Padrão próprio para recorde e meta batida (os toasts com efeito `glitch`), diferente do fim de descanso. Respeita o
  ajuste de vibração.

**M8. Peso da barra nos Ajustes.** _(A02)_

- `settings.barWeight` (padrão 20 kg / 45 lb), passado para `platesForBarbell`, que já aceita o parâmetro.

**M9. Primeira vez numa alternativa.** _(A10, F5)_

- Hoje a primeira troca para uma alternativa começa sem referência. Mostrar a carga do titular como referência em texto
  ("No titular você usou 80 kg. Comece mais leve e ajuste: daqui em diante o app lembra."). Sem fator de conversão.

### Onda 3: corpo e recuperação (1 sessão)

**M10. Linha do peso pelo tempo, não pela contagem.** _(BUG-06, D02)_

- `BodyLab`: média ponderada pelos dias entre as pesagens, com os pontos brutos mais apagados por baixo.
- `weightTrend`: antes de trocar a conta, escrever o teste do "pico na borda da janela" e medir o salto. Se for
  pequeno, fica como está (os limites de `bodyAdvice` foram calibrados com ela).

**M11. Recuperação conta o trabalho indireto.** _(BUG-03)_

- Em `operatorState`: sessão só com trabalho indireto relevante vira um "ponto de estresse" que reinicia o relógio do
  intervalo, sem gerar sinal de rápido ou lento.
- Teste com `simulateOperator`: empurrar pesado entre dois treinos de tríceps não pode mais ensinar "tríceps recupera
  devagar".

**M12. Semana justificada não quebra a sequência.** _(F01)_

- `weekStreaks`: semana coberta por uma ausência declarada (doença, viagem) fica congelada em vez de zerar.
- Hoje a intenção "faltei treino" só responde, não grava nada (`core/intents.ts:313`). Precisa passar a propor uma
  ausência com datas na memória do operador (com confirmação, como as outras restrições), e `weekStreaks` passa a
  receber essas datas.

### Onda 4: segundo aparelho e chegada de quem vem de outro app (1–2 sessões)

**M13. "Juntar com este aparelho" nos backups da nuvem.** _(BUG-05, E01, F9)_

- Segundo botão ao lado de "Restaurar", chamando `importBackup(parsed, "merge")`. Cria o ponto de restauração antes,
  como o restaurar já faz. A pessoa toca; o servidor continua sem sobrescrever nada sozinho.

**M14. Importar histórico do Hevy / Strong (CSV).** _(E07)_

- É a mudança com mais efeito para o app ir a público: quem chega com anos de treino não começa do zero. Tudo no
  aparelho, sem custo. Suporta **ambos os formatos (Hevy e Strong)** logo na primeira entrega. Casa nomes com a
  biblioteca (que já tem nome em português e em inglês) e cria `custom-` para o resto.
- Precisa de desenho antes de código: a sessão importada precisa de um retrato de dia e de programa para o histórico
  funcionar.

**M15. Voz.** _(C02, C03, F6)_

- Só depois de confirmar o plugin nativo. Se entrar, começa pelo que as intenções já entendem ("só tenho 35 minutos",
  "o ombro incomodou"); ditar série vem depois.

## 6. Fica de fora, e por quê

| Proposta do dossiê                                                      | Motivo                                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Fórmula híbrida de 1RM (B01, segunda parte)                             | F4: desalinha `predictReps` e os recordes do servidor. O teto de reps resolve                                                        |
| Curva sigmoide de recuperação com constantes fixas (B04)                | F5. O ganho real (recuperação aprendida por músculo) já está ligado. Se um dia mudar a forma, o "100%" tem que cair na mesma hora    |
| Tabela de equivalência entre equipamentos (A10)                         | F5: fator único não vale para todo mundo. M9 cobre a dor sem inventar número                                                         |
| Sincronizar ajustes por "última escrita vence" (E01)                    | Contraria a regra de o servidor nunca sobrescrever o celular. M13 cobre o caso real                                                  |
| Semana do mesociclo mudando sozinha (B06)                               | `reentryFor` já propõe repetir ou recomeçar. Mudar a semana em silêncio tiraria o controle da pessoa                                 |
| Peso corporal na conta da barra fixa (B02)                              | Os 34 exercícios curados não têm titular de peso corporal. Vale um teste de como `suggest` se comporta com carga 0 antes de desenhar |
| Meta de proteína pela cintura (B11)                                     | A função citada não existe; o app não calcula proteína, só cita no texto                                                             |
| SFR, carga axial, marcos MEV/MAV/MRV, DOTS (B09, B10, D07, F05)         | F7. A força relativa entre amigos já existe em linguagem simples                                                                     |
| Proxy de IA com limite por conta (H03)                                  | Não existe proxy; o treinador usa a chave da pessoa                                                                                  |
| Orçamento de cores de 400 para 200 (D10)                                | Cita arquivos que não existem; o lint passa hoje; não muda nada para quem usa                                                        |
| Lembretes por notificação fora do treino (C04)                          | Decisão do dono: manter o app quieto por padrão, notificando apenas o fim do descanso                                                |
| E04, E05, E09                                                           | Já resolvidos (seção 3)                                                                                                              |
| Missões de dupla, retrospectiva anual, conquistas de maestria (F04–F07) | Ideias de produto válidas, sem urgência. Voltam depois das 4 ondas                                                                   |

## 7. Decisões do dono (fechadas em 11/11/2026)

1. **M1**: **Sim**, recalcular com teto de 15 reps e sem drop-set (recordes de 1RM antigos vindos de séries acima de 15 reps deixam de aparecer na lista, sem apagar dados).
2. **M5**: Os botões `−` e `+` ficam no **PlanCard** (onde a próxima série já aparece grande e cabe em 320 px).
3. **Lembretes por notificação (C04)**: **Fica de fora** (manter o app quieto, só notificando fim de descanso).
4. **M14**: Importar de **ambos (Hevy e Strong)** na primeira entrega.
