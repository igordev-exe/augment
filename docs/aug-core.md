# AUG.CORE — Arquitetura do Cérebro Determinístico do AUGMENT

O **AUG.CORE** é o sistema nervoso central do AUGMENT: um motor 100% local, offline, gratuito e determinístico que acompanha quem treina do Dia 0 ao fechamento de cada mesociclo. Ele percebe como o corpo responde, calibra um **gêmeo digital** da pessoa no próprio aparelho, replaneja a semana como um GPS quando a rotina muda, explica cada carga em um toque e só aciona modelos de linguagem para redigir ou interpretar texto livre.

---

## Princípios Inegociáveis

1. **Celular como fonte única da verdade**: tudo roda no navegador/app sobre o IndexedDB (`db.sessions`, `db.kv`). Sem custo por uso, sem depender de sinal na academia.
2. **Separação entre Memória e Estado Derivado**:
   - **Fatos brutos** (`sessions`, `bodyLog`, `settings`) e **Memória declarada** (`OperatorMemory` em `db.kv["operator-memory"]`) são persistidos e entram no backup `.json`.
   - **Estado do gêmeo** (`OperatorState`) é uma função pura `operatorState(sessions, bodyLog, settings, memory, today)` calculada em `O(N)` sobre o histórico. Se um treino passado for editado ou apagado, o gêmeo se recalibra na hora, sem risco de viés congelado.
3. **Programa salvo é sagrado**: o planejador **nunca** altera o programa salvo (`ppl-v2` ou qualquer outro em `db.programs`) sem confirmação explícita. Ajustes de rotina ("hoje só tenho 40 min", "só tenho halteres") geram uma `SessionAdaptation` efêmera ao montar a sessão do dia; mudanças permanentes na ficha continuam passando por `Proposal` confirmada pela pessoa.
4. **Identidade por exercício da biblioteca (`libId`)**: toda curva de responsividade e sensibilidade articular é indexada por `exOf(entry)?.lib ?? entry.exId`, não apenas pelo `exId` do dia. Assim, quando a pessoa troca de programa ou gira um acessório no deload, o histórico biomecânico do movimento acompanha.

---

## (a) Modelo do Operador ("Gêmeo Digital") — `src/lib/core/operator.ts`

### 1. `OperatorMemory` (persistido em `db.kv["operator-memory"]` + `Backup`)

Guarda apenas o que **não** pode ser deduzido das séries feitas:

- `calibrationUntil?: string`: data ISO até quando o gêmeo está na janela inicial de calibração (definida no `Onboarding` para os primeiros 7 dias).
- `constraints: Constraint[]`: restrições temporárias declaradas pela pessoa no chat ou na tela, todas com `expiresAt` (data ISO) para expirarem sozinhas:
  - `kind: "time-cap"` (`minutes: number`) — ex.: _"hoje só tenho 40 min"_ ou _"semana corrida"_.
  - `kind: "equipment"` (`allowed: ("halteres" | "barra" | "maquina" | "cabo" | "peso-corporal")[]`) — ex.: _"viajando, só tenho halteres até domingo"_.
  - `kind: "pain"` (`muscle?: MuscleId`, `libId?: string`, `severity: "leve" | "forte"`) — ex.: _"ombro incomodando"_.
  - `kind: "schedule"` (`note: string`, `reduceVolume?: boolean`) — ex.: _"semana de prova"_.
- `mesoHistory: MesoSummary[]`: resumo compacto de cada mesociclo concluído (`start`, `end`, `adherencePct`, `prsCount`, `avgWeeklySets`, `bestRespondingMuscles`).

### 2. Variáveis de `OperatorState` (calculadas por `operatorState()`)

| Variável                          | O que mede                                                                                                   | Fonte do dado                                                                                                                                                                                                                                                                                                           | Como é aprendida                                                                                                                                                                                                                        | Confiança mínima (`0..1`)                             | Valor padrão (sem dados / baixa confiança)                                    |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- | :---------------------------------------------------------------------------- |
| `calibration.stage`               | Fase do gêmeo (`"calibrando"` \| `"aprendendo"` \| `"calibrado"`)                                            | Contagem de sessões concluídas (`done`)                                                                                                                                                                                                                                                                                 | `< 4` sessões = `"calibrando"`; `4..11` = `"aprendendo"`; `>= 12` = `"calibrado"`. Confiança global `min(1, done / 12)`.                                                                                                                | `0` (sempre visível como status)                      | `"calibrando"` (confiança `0`)                                                |
| `muscles[m].recoveryMultiplier`   | Velocidade de recuperação do músculo (`0.75` = recupera 25% mais rápido; `1.35` = precisa de 35% mais horas) | Pares consecutivos de sessões que treinam o músculo `m` (`Δt` em horas via `finishedAt`), desempenho da 1ª série vs. meta de reps e `entry.feedback.volume` (`"pesado"`), descontando dia de sono ruim (`checkin.sleep === "ruim"`), subida de carga (`loadIncreased`) e semanas de pico (`week === 5 \|\| week === 6`) | Encolhimento bayesiano empírico `(k * 1.0 + sum) / (k + n)` com `k = 2.5` puxando estimativas com poucas amostras para o prior `1.0` e confiança sensível à dispersão `(n / (n + k)) * (1 / (1 + 6 * var))`, limitado a `[0.75, 1.35]`. | `>= 0.50` (`>= 4` exposições consistentes do músculo) | `1.00` (usa exatamente `recoveryHours(sets)` de `visual.ts`: 36h / 48h / 72h) |
| `muscles[m].volumeTolerance`      | Teto prático semanal tolerado pelo músculo                                                                   | `weeklyVolume(fractional)` cruzado com `entry.feedback.volume` e progressão de `e1rm`                                                                                                                                                                                                                                   | Sobe `+1` a `+2` séries quando o músculo progride com feedback `"leve"`/`"ok"`; cai `−2` séries quando acumula `"pesado"` ou regressão de reps.                                                                                         | `>= 0.50` (`>= 3` semanas com o músculo)              | `SCIENCE.volume.efficient[1]` (`20` séries fracionadas/sem)                   |
| `exercises[libId].responsiveness` | Resposta do exercício (`"alta"` \| `"normal"` \| `"estagnado"` \| `"desgastante"`)                           | Histórico do movimento (`libId`) via `bestE1rm`, `workSets` e `feedback`                                                                                                                                                                                                                                                | Taxa de ganho de 1RM estimado por sessão + frequência de queixas (`feedback.joint === "incomodou"` ou `volume === "pesado"`). Se cansa sem subir 1RM por `>= 3` sessões, marca `"desgastante"` ou `"estagnado"`.                        | `>= 0.50` (`>= 3` sessões do movimento)               | `"normal"`                                                                    |
| `exercises[libId].jointRisk`      | Sensibilidade articular no movimento (`0..1`)                                                                | `entry.feedback?.joint === "incomodou"` nas últimas 6 exposições do `libId`                                                                                                                                                                                                                                             | Proporção ponderada de queixas articulares recentes (mais peso para as últimas 3 sessões).                                                                                                                                              | `>= 0.33` (`>= 2` sessões do movimento)               | `0` (sem risco detectado)                                                     |
| `behavior.weekdayMissRate[0..6]`  | Probabilidade de faltar em cada dia da semana (`0..1`)                                                       | Datas das sessões concluídas vs. `settings.trainingDays` nas últimas 6 semanas                                                                                                                                                                                                                                          | Em cada semana fechada, compara os dias planejados em `trainingDays` com os dias treinados.                                                                                                                                             | `>= 0.50` (`>= 3` semanas fechadas)                   | `0` para todos os dias                                                        |
| `behavior.preferredHour`          | Horário típico em que a pessoa treina (`0..23` h)                                                            | `new Date(s.startedAt).getHours()` das sessões concluídas                                                                                                                                                                                                                                                               | Mediana da hora de início dos últimos 12 treinos.                                                                                                                                                                                       | `>= 0.40` (`>= 4` sessões)                            | `null`                                                                        |
| `behavior.restRatio`              | Razão entre descanso real (via `doneAt`) e o mínimo da ficha (`ex.rest[0]`)                                  | `restsBefore(entry)` em exercícios sem superset com `rest[0] >= 60`                                                                                                                                                                                                                                                     | Mediana de `restReal / ex.rest[0]` nas últimas 10 sessões. `< 0.65` indica que a pessoa corta o descanso.                                                                                                                               | `>= 0.40` (`>= 6` intervalos medidos)                 | `1.0`                                                                         |
| `behavior.loadAcceptanceRate`     | Taxa de aceitação da carga sugerida pelo motor (`0..1`)                                                      | Comparação entre `suggest()` da sessão anterior e o peso usado na 1ª série de trabalho                                                                                                                                                                                                                                  | Proporção de exposições em que a pessoa aceitou a carga sugerida (`±0,5` un.).                                                                                                                                                          | `>= 3` transições medidas                             | `1.0`                                                                         |

---

## (b) Regras do Planejador — `src/lib/core/planner.ts`

O planejador recebe `(dayId, week, settings, sessions, operator, memory, today)` e devolve duas estruturas puras:

1. **`DecisionTrace`** (`explainLoad()`): o rastro auditável de cada carga sugerida (_"Por que 42,5 kg?"_), contendo:
   - `summary`: 1 linha direta para o HUD (ex.: _"Subiu +2,5 kg: 3/3 no topo (10 reps) na última sessão."_).
   - `factors`: lista ordenada dos fatores que atuaram (`historico`, `dupla-progressao`, `salto-grande`, `deload`, `fadiga-muscular`, `sono-energia`, `sensibilidade-articular`).
   - `confidence`: confiança do modelo na recomendação (`0..1`).
2. **`SessionAdaptation`** (`planDay()`): adaptação efêmera para o treino de hoje quando há restrições ativas em `OperatorMemory` ou sinais agudos no `OperatorState`:
   - **Cenário 1 — Tempo curto (`"time-cap"`, ex.: 40 min)**: mantém todos os compostos na íntegra; ativa pareamento agonista-antagonista quando possível e corta `1` série dos isolados do fim da sessão até a duração estimada caber no limite.
   - **Cenário 2 — Equipamento restrito (`"equipment"`, ex.: só halteres/peso corporal)**: para cada exercício cujo equipamento não está disponível, seleciona automaticamente a alternativa compatível de `LIB_BY_ID[ex.lib]?.alternatives` como troca efêmera da sessão (`alt`), preservando os músculos-alvo.
   - **Cenário 3 — Dor ou sensibilidade articular alta (`"pain"` ou `jointRisk >= 0.5`)**: sugere na hora a alternativa biomecânica mais amigável da biblioteca e reduz a parada de falha (`F`) para falha técnica (`T`) no grupo afetado.
   - **Cenário 4 — Semana de prova / estresse alto (`"schedule"` com `reduceVolume`) ou fadiga aguda**: corta `1` série de cada exercício (piso de `2` séries nos compostos, `1` nos isolados), mantendo a carga na barra para preservar estímulo neural (dose mínima efetiva — Pelland 2026).
   - **Cenário 5 — Padrão de falta em dia da semana (`weekdayMissRate >= 0.65`)**: avisa no plano semanal qual dia de `trainingDays` costuma falhar e sugere redistribuir na agenda.

### O que o Planejador NUNCA faz

- **Nunca** sobrescreve `db.programs` nem altera `ppl-v2`.
- **Nunca** inventa carga fora da regra de dupla progressão + `snapWeight` / `nextAvailableWeight`.
- **Nunca** empurra para falha em exercício com `stop === "R"` ou quando há queixa articular ativa.
- **Nunca** apaga histórico ou muda `mesoStart` sozinho sem ação da pessoa.

---

## (c) Presença e Tom

### Momentos de Presença

1. **Ao abrir o app (`Hoje`)**: resumo de 1 linha do estado do gêmeo e, se houver restrição ativa (ex.: tempo curto, equipamento, calibração na Semana 1), mostra o aviso conciso do núcleo.
2. **Durante o treino (`SessionHud` / cartão do exercício)**:
   - Explicação instantânea da carga (_"Por que essa carga?"_) a partir do `DecisionTrace`.
   - Telemetria passiva de descanso e RIR sem popups bloqueantes.
3. **Relatório (`Relatório` → aba `Motor`)**: diagnóstico do gêmeo digital (curva de recuperação aprendida, responsividade por movimento, aderência e ritmo de descanso).

### Orçamento de Atenção (Anti-Spam)

- No máximo **1** intervenção proativa fora do treino por dia.
- Se não houver desvio relevante (recuperação normal, sem restrição ativa, sem estagnação), o núcleo fica em silêncio.

### Tom de Voz

- Curto, técnico, em português claro, sem adjetivos vazios (_"Mandou muito bem!"_ é proibido).
- Sempre cita o dado concreto da pessoa: _"Tríceps testa: 2 queixas no cotovelo em 3 treinos. Alternativa sugerida hoje: tríceps na corda."_

---

## (d) Intenções do Chat Guiado — `src/lib/core/intents.ts`

Antes de chamar qualquer modelo de linguagem na nuvem, o texto da pessoa passa por `matchIntent(text, context)`. Se bater em uma das 6 intenções operacionais, o AUG.CORE responde **na hora, offline e em 0 ms**, além de gravar a restrição temporária quando aplicável:

| Intenção (`IntentKind`) | Exemplos de frases que acionam                                               | O que o tratador determinístico faz                                                                                                                                                                              |
| :---------------------- | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `explicar_carga`        | _"por que 42,5?"_, _"explica a carga do supino"_, _"por que baixou o peso?"_ | Roda `explainLoad()` no exercício citado (ou no próximo exercício do dia) e devolve o `DecisionTrace` completo.                                                                                                  |
| `tempo_curto`           | _"só tenho 40 minutos hoje"_, _"treino rápido de 35 min"_                    | Cria uma `Constraint` `"time-cap"` para hoje e mostra quais séries de isolados cortar com `planDay()` para caber no relógio sem perder os compostos.                                                             |
| `equipamento_restrito`  | _"só tenho halteres"_, _"academia de hotel sem polia"_                       | Cria uma `Constraint` `"equipment"` e lista as substituições automáticas da biblioteca para o treino do dia.                                                                                                     |
| `dor_articular`         | _"dor no ombro"_, _"cotovelo incomodando no supino"_                         | Registra `Constraint` `"pain"` para o músculo/exercício citado e devolve as alternativas seguras de `LIB_BY_ID` + recomendação de margem de RIR.                                                                 |
| `faltei_treino`         | _"faltei ontem"_, _"perdi 2 treinos essa semana"_                            | Consulta `planAhead()` e `reentryFor()` para mostrar exatamente como a sequência segue sem pular dia (ou se vale repetir a semana).                                                                              |
| `travou_exercicio`      | _"travei no desenvolvimento"_, _"supino estagnou"_                           | Consulta `OperatorState.exercises[libId]` e o histórico das últimas 3 sessões; explica se a causa é descanso curto (`restRatio`), salto grande de pino/halter ou estagnação real (−10% ou rotação de acessório). |

Se a mensagem não bater em nenhuma intenção determinística (ou se a pessoa pedir uma análise aberta), ela segue normalmente para o treinador com o resumo do `OperatorState` injetado no contexto.

---

## (e) Roadmap em Etapas e Mapa de Reaproveitamento

### O que muda em cada módulo existente

- [`src/lib/db.ts`](file:///c:/Users/igora/augment/src/lib/db.ts): ganha `loadOperatorMemory()`, `saveOperatorMemory()`, `upsertConstraint()`, `clearExpiredConstraints()` e inclui `operatorMemory?: OperatorMemory` em `Backup`, `exportBackup()` e `importBackup()` (`"replace"` e `"merge"`).
- [`src/lib/hooks.tsx`](file:///c:/Users/igora/augment/src/lib/hooks.tsx): ganha `useOperatorMemory()` e `useOperatorState()`.
- [`src/lib/visual.ts`](file:///c:/Users/igora/augment/src/lib/visual.ts): `muscleStatus()` aceita multiplicadores opcionais por músculo vindos do gêmeo (`recoveryMultipliers?: Partial<Record<MuscleId, number>>`), mantendo `recoveryHours()` como padrão quando a confiança ainda é baixa.
- [`src/lib/diagnostics.ts`](file:///c:/Users/igora/augment/src/lib/diagnostics.ts): inclui diagnósticos do gêmeo digital (fase de calibração, músculos de recuperação rápida/lenta, ritmo real de descanso e restrições ativas) na aba **Motor** do `Relatório`.
- [`src/lib/onboarding.ts`](file:///c:/Users/igora/augment/src/lib/onboarding.ts) e [`src/screens/Onboarding.tsx`](file:///c:/Users/igora/augment/src/screens/Onboarding.tsx): ao concluir o primeiro uso, inicializa `OperatorMemory` com a primeira semana marcada como janela de calibração (`calibrationUntil = addDays(today, 7)`).
- [`src/screens/Today.tsx`](file:///c:/Users/igora/augment/src/screens/Today.tsx): exibe a linha de telemetria do núcleo (`operatorBrief`) e respeita adaptações ativas quando houver restrição declarada.
- [`src/lib/coach/context.ts`](file:///c:/Users/igora/augment/src/lib/coach/context.ts): expõe o resumo do `OperatorState` em `toolPlan()` para que o treinador conheça a curva aprendida da pessoa.

### Etapas de Entrega

1. **Etapa 1 (hoje)**: `docs/aug-core.md` + `src/lib/core/operator.ts` (`OperatorMemory`, `operatorState()`, `effectiveRecoveryHours()`, `operatorBrief()`) + persistência em `db.ts` + suíte `src/lib/core/operator.test.ts` com 3 operadores fictícios + ligação em `Onboarding`, `Today`, `Report`/`diagnostics` e `visual.ts`.
2. **Etapa 2 (hoje)**: `src/lib/core/planner.ts` (`explainLoad()` com `DecisionTrace` + `planDay()` com `SessionAdaptation`) + `src/lib/core/planner.test.ts` + `src/lib/core/intents.ts` (`matchIntent()`, `handleIntent()`) + `src/lib/core/intents.test.ts`.
3. **Etapa 3 (próxima)**: chips de intenção rápida e resposta instantânea na tela `Coach.tsx` + botão de 1 toque _"Por que essa carga?"_ na `SessionScreen.tsx`.
4. **Etapa 4 (experimental)**: sensores opcionais (cadência por acelerômetro, passos nativos) e retrospectiva multi-mesociclo.
