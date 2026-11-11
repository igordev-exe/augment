# AUGMENT: mapa do projeto para o Claude

Leia isto antes de abrir arquivos. O objetivo é **não reler o código à toa e não inventar o que não existe**.
Se algo aqui estiver desatualizado, confira no código e corrija este arquivo no mesmo commit.

## 1. Ideia central

AUGMENT é um app de **treino de hipertrofia** com estética **cyberpunk / HUD de ficção científica** (vermelho
`#ef302c` + ciano `#3fd8e0` sobre grafite). A pessoa ("operador") segue um **programa** (ficha) em **mesociclo de 7
semanas** (6 de carga + 1 de deload). O app:

- monta o treino do dia e **sugere a carga** de cada série, com base no histórico (progressão dupla);
- tem timer de descanso, check-in, RIR, feedback por exercício e recordes;
- mostra o progresso: mapa de fadiga, séries por músculo, roda de atributos, gráficos e biometria;
- traz um guia científico (48 princípios com nível de evidência) e uma biblioteca de exercícios (34 curados + 569 do
  free-exercise-db, com nome em português);
- tem um **treinador por IA** opcional (Claude via a chave de API da própria pessoa, ou um documento para colar em
  qualquer chat, sem chave).

**Offline primeiro**: o celular (IndexedDB) é a fonte da verdade e tudo funciona sem internet e sem conta. A **conta
online é opcional** (`server/` + `src/lib/online/`): com ela, cópias sobem para o servidor (backup automático,
melhores marcas, resumo dos treinos). Isso habilita amigos, feed, ranking e "você pega mais que X% dos usuários". O
servidor nunca sobrescreve o celular, a não ser que a pessoa toque em "Restaurar". Guia completo: `docs/online.md`.

- **Público**: amplo e leigo, incluindo pessoas lentas ou iniciantes. UX direta, estilo Apple, em pt-BR. O app vai a
  público como APK, então precisa funcionar em **qualquer tela** (320 px até tablet, Android/iPhone/Xiaomi, fonte
  grande do sistema).
- **Publicação**: PWA no GitHub Pages, APK Android e projeto iOS (Capacitor; `ios/`). Servidor: Cloudflare Workers + D1
  (plano grátis) ou o mesmo código no Node + SQLite.

## 2. Regras do dono (não negociáveis)

1. **Commit e push só quando o usuário pedir.** Mensagem em inglês, curta, no estilo do `git log`. Termine com a
   linha:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
2. **Nunca inclua `.claude/launch.json` no commit.** A diferença dele é local, só de fim de linha.
3. **Não altere o programa pessoal do usuário**: "PPL 5 dias", `src/data/templates/ppl.ts`, id `ppl-v2`. Ele estoura o
   teto por sessão nas semanas 4–6 de propósito; o editor só avisa.
4. **Não gaste dinheiro.** O servidor online é o do plano grátis da Cloudflare (`server/`). A chave da Anthropic é de
   cada pessoa (BYOK). Nada de serviço pago, e-mail transacional ou conta em terceiros sem o usuário pedir.
5. **Licenças dos assets já foram resolvidas** (imagens, fontes, herói, avatar). Não levante isso como pendência.
6. **Sem textos pessoais no código.** O nome do operador vem de `settings.operator` (padrão `""`).
7. **Verifique medindo, não "no olho".** Mudança visual exige auditoria em várias larguras (seção 9). O usuário já se
   frustrou com correções que só valiam para uma tela.
8. Referência de design: o kit Figma, as capturas e os MDs de estilo ficam em `Sci-fi UI Kit (Free) (Community)*/`,
   na raiz (ignorado pelo git). Consulte antes de mexer em UI.

## 3. Stack e comandos

- **Base**: React 18 + TypeScript + Vite 5. PWA com `vite-plugin-pwa` (Workbox). Rotas com `HashRouter` (`#/rota`).
- **Dados**: Dexie (IndexedDB). Testes com vitest + fake-indexeddb.
- **Estilo**: prettier; `augmented-ui` faz os cantos chanfrados. Fontes empacotadas: Orbitron, Share Tech Mono, Exo 2
  e Rajdhani.
- **Android, iOS e IA**: Capacitor 8 (`android/` e `ios/`, app id `io.github.igordevexe.augment`; o iOS usa Swift
  Package Manager, sem CocoaPods) e `@anthropic-ai/sdk`, este só na tela do treinador, por lazy import.
- **Servidor** (`server/`): sem dependências. `handle(request, env)` em `server/src/app.ts` roda no Workers
  (`worker.ts`, banco D1) e no Node (`node.ts`, `node:sqlite`).

| Comando                                                    | O que faz                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                              | Vite em `localhost:5173` (`.claude/launch.json` → preview `augment-dev`)                                                   |
| `npm run check`                                            | **portão de qualidade**: `tsc -b` + `tsc -p server` + `scripts/lint.ts` + `prettier --check .` + `vitest run` (210 testes) |
| `npm run format`                                           | prettier --write                                                                                                           |
| `npm run build`                                            | build web (base vem de `VITE_BASE`; o deploy do Pages define a dele)                                                       |
| `npm run build:android`                                    | `tsc -b && vite build --base ./ && cap sync android`                                                                       |
| `npm run android:open`                                     | abre o Android Studio                                                                                                      |
| `npm run coach -- backup.json`                             | debrief do treinador no terminal (`scripts/coach.ts`)                                                                      |
| `python -I scripts/import-exercise-db.py <exercises.json>` | regenera a biblioteca estendida (free-exercise-db)                                                                         |
| `python scripts/android-assets.py`                         | ícones e splash do Android                                                                                                 |
| `npm run server`                                           | servidor online local na porta 8787 (banco em `server/data/augment.db`; preview `augment-server`)                          |
| `npm run server:deploy`                                    | publica o Worker na Cloudflare (`cd server && npx wrangler deploy`)                                                        |
| `npm run build:ios` / `npm run ios:open`                   | build com base `./` + `cap sync ios` / abre o Xcode (só no Mac)                                                            |
| `python scripts/ios-assets.py <icone-1024.png>`            | ícone e splash do iOS                                                                                                      |

**CI** (`.github/workflows/`):

- `deploy.yml`: push na main → GitHub Pages.
- `android.yml`: gera o APK como artifact; em tag `v*`, publica uma Release. A assinatura usa os secrets
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`.
- `ios.yml`: compila o app iOS num Mac do GitHub, para o simulador e sem assinatura.
- `verify.yml`: a cada push, sobe o app e roda a auditoria de layout (`tools/verify/audit.mjs`) com texto normal e a
  130%.
- Todos usam Node 24 (os testes do servidor precisam do `node:sqlite`). O endereço do servidor entra no build pela
  variável do repositório `AUGMENT_API_URL` (→ `VITE_API_URL`). Sem ela, o app sai só offline.

**Lint próprio** (`scripts/lint.ts`):

- `font-size` abaixo de 17 px precisa usar `var(--fs-1..6)`, a não ser que a linha tenha o comentário `lint-ok`.
- Orçamento de **≤ 400 cores hex** fora do `:root`. Se estourar, crie um token no `:root`.

## 4. Desenho do app

### Navegação (rotas em `src/App.tsx`)

```
#/                      Today            Treino de hoje (missão), semana, avisos  ← aba "Treino"
#/treino/:id            SessionScreen    Treino em andamento (SessionView)
#/historico             History          Calendário e lista de sessões            ← aba "Histórico"
#/progresso             Progress         Fadiga, séries/músculo, atributos, gráficos, biometria ← aba "Progresso"
#/relatorio[/:week]     Report           Relatório semanal / do mesociclo
#/exercicios            Exercises        Biblioteca (busca, filtro por equipamento) ← aba "Exercícios"
#/exercicios/:libId     ExerciseDetail   Execução, fotos, vídeo, histórico, "Adicionar ao programa"
#/guia                  Guide            Princípios científicos com atalhos p/ exercícios ← aba "Guia"
#/ajustes               SettingsScreen   Operador, dias, unidade, som, efeitos, backup, pontos de restauração
#/programas             Programs         Lista de programas + modelos prontos (TEMPLATE_GROUPS)
#/programas/:id         ProgramEditor    Montador de programa (dias, exercícios, volume, teto/sessão)
#/treinador             Coach (lazy)     Chat com Claude (BYOK) ou documento sem chave
#/online                Online           Conta online: cadastro/login/recuperação, sync, backups da nuvem, privacidade
#/amigos                Friends          Adicionar amigo, pedidos, feed, comparação de recordes, bloquear e denunciar
#/primeiro-uso          Onboarding       Assistente (dias, experiência, foco) que sugere um programa; `inApp`
#/privacidade           PrivacyPolicy    Política de privacidade e regras de convivência
*                       Today
```

### Esqueleto da tela (celular)

```
┌──────────────────────────────┐
│ topbar: Wordmark · avatar     │  (PageHead em cada tela)
├──────────────────────────────┤
│                              │
│  <main class="app">          │  rola; .has-timer reserva espaço da TimerBar
│   conteúdo da rota           │
│                              │
├──────────────────────────────┤
│ TimerBar (só com descanso)   │  fixa, acima da nav; 2 linhas; .timer-actions quebra
├──────────────────────────────┤
│ nav: Treino Histórico        │  5 abas, --nav-h 66px
│      Progresso Exercícios Guia│
└──────────────────────────────┘
BootScreen por cima de tudo ao abrir: completo (~3,6 s) na 1ª vez do dia, curto (~1,5 s) depois, nenhum com
reduced-motion. Ver lib/brand.ts → bootModeFor/readBootMode/markBootDone.
```

**Primeiro uso**: instalação nova (zero sessões e `settings.onboarded` falso) mostra `<Onboarding/>` no lugar das
telas, menos em `/online`, `/ajustes` e `/privacidade`. A lógica fica em `lib/onboarding.ts` (`recommendTemplate`,
`applyOnboarding`, `skipOnboarding`).

**Tela quebrada**: `components/ErrorBoundary` (chave = rota) mostra "Algo deu errado nesta tela" com três saídas e
chama `lib/errors.ts` → `reportError` (guarda os 20 últimos no kv `error-log` e manda ao servidor sem dados pessoais).

### Tela Hoje (`Today.tsx`)

- **Banner de missão**: card com o capacete (herói) à direita e o texto à esquerda, sem nunca passar do meio. Embaixo,
  a etiqueta "DESCANSO HOJE · PRÓX …" ou o dia de treino.
- O espaço entre a etiqueta e o capacete foi **medido em pixels** em 320–820 px. Não mexa sem rodar `tagcheck` (seção
  9).
- Abaixo do banner: o botão **Iniciar protocolo**, o WeekStrip (semanas do meso), o DayStrip e os avisos em
  `SysModule` (backup, retomada, relatório da semana, alerta de fadiga).

### Treino (`SessionScreen.tsx` → `SessionView`)

- `SessionHud` fica fixo no topo. Abaixo vêm o check-in, os `ExerciseBlock` de cada exercício (com as linhas `SetRow`)
  e a finalização.
- **ExerciseBlock**:
  - toque no número da série abre o `RadialMenu`;
  - tem o botão "− Aquecimento" e a etiqueta "extra hoje" para exercícios adicionados no treino;
  - ao terminar as séries, pergunta o RIR e "como bateu?" (pump, volume, articulação).
- **Sugestões**: só a **próxima** série mostra o número sugerido, em cinza translúcido (placeholder). `suggested: true`
  marca uma carga pré-preenchida que a pessoa ainda não confirmou.
- **"Adicionar exercício hoje"** usa o `AddExercise` do ProgramEditor. Entra como `extra: true` e só vale naquele dia;
  o programa não muda.
- `finish()` grava a sessão e mostra o `TerminalLog` (log que digita), os PRs e o `ShareWorkoutCard`.
  `HoldButton` exige segurar para confirmar ações destrutivas.

## 5. Onde está cada coisa (esqueleto do código)

Tamanho em linhas entre parênteses. **Arquivos grandes: use Grep, não leia inteiros**: `src/styles/*.css` (7.660 no
total), `Online` (900), `server/src/app.ts` (990), `SessionScreen` (786), `Anatomy` (780), `progression` (732), `ProgramEditor` (686), `ExerciseBlock` (678),
`library.ts` (639), `Progress` (620), `Report` (606) e `science.ts` (591).

### Entrada

- **`src/main.tsx`**:
  - importa as fontes, o augmented-ui e `styles/index.css`;
  - registra o service worker (só na web em produção);
  - chama `setupBackButton`, `applyTextZoom` e `navigator.storage.persist`;
  - cria o ponto de restauração semanal.
- **`src/App.tsx`**:
  - `App` espera `loadActiveProgram()` e envolve tudo em `HashRouter > ToastProvider > TimerProvider > Shell`, com o
    `BootScreen` por cima;
  - `Shell` alterna a classe `mode-deload` no `<html>` (semana 7), liga `installTapFx`/`bootBeam`/`applyFxLevel` e
    configura o timer.

### `src/data/`: tipos e conteúdo

- **`types.ts`**: todos os tipos.
  - Básicos: `StopKind` (`F` falha, `T` falha técnica 1–2 RIR, `R` ~2 sobrando), `Unit`, `MuscleId` (14 músculos:
    costas, peito, quadriceps, deltLateral, posterior, biceps, triceps, panturrilha, deltPosterior, gluteo, abdomen,
    deltAnterior, trapezio, antebraco).
  - Programa: `LibraryEntry`, `ProgramExercise`, `ProgramDay`, `Program` (com `periodization` "meso" ou "fixed", e
    `retired`).
  - Sessão: `SetEntry` (`kind` warmup/work/drop, `suggested`), `SessionExercise` (`snap`, `alt`, `extra`,
    `feedback`), `Session` (`day` snapshot, `week`, `status` active/done).
  - Outros: `Checkin`, `CardioEntry`, `BodyEntry`, `BodyGoal`, `Settings`.
- **`program.ts`**: **registro em memória do programa ativo** (não é a ficha fixa).
  - Programa ativo: `setActiveProgram`, `activeProgram`, `programDays`, `dayById`, `rememberPrograms`.
  - Sessões e exercícios: `dayOf(session)`, `exById`, `exOf(entry)` (usa o `snap` se o exercício saiu do programa),
    `rememberSessions`.
  - Mudanças: `subscribeProgram`, `programVersion`.
  - Músculos: `MUSCLE_LABEL`, `MUSCLE_ORDER`, `synergistsOf`.
  - Consultas: `isFixedProgram`, `usesOfLibrary`, `dayOfExercise`, `shortName`.
- **`templates/index.ts`**: 8 modelos.
  - Grupo base: fb-3, ul-4, ul-forca, ppl-v2, ppl-6.
  - Grupo glúteo: fb-3-gluteo, ul-4-gluteo, ppl-6-gluteo.
  - Exporta `TEMPLATES`, `TemplateInfo` (com nível) e `TEMPLATE_GROUPS`.
- **`templates/ppl.ts`**: `PPL_DAYS`, `PPL_PROGRAM_ID = "ppl-v2"`, `pplProgram()`. **Programa pessoal: não alterar.**
- **`science.ts`**:
  - `SCIENCE`: constantes, incluindo `perSessionCeiling = 11`;
  - `SYNERGISTS`: tabela de sinergistas por exercício da biblioteca;
  - `PRINCIPLES`: 48 princípios, cada um com `EvidenceLevel` (evidencia/consenso/campo/hipotese);
  - `AUDITS` (crença × veredito), `scienceText()` (vai para o prompt do treinador) e `EXERCISE_EVIDENCE`.
- **`library.ts`**: `LIBRARY` (34 curados, em pt), `LIB_BY_ID`, `LIB_MUSCLES`.
- **`library-extended.ts`**: os 569 exercícios `db-*` do free-exercise-db.
  - Exporta `EXTENDED`, `EXT_BY_ID`, `libraryMuscles`, `libraryName`, `loadInstructions` (lazy), `extendedAsLibrary`,
    `useLibraryEntry`, `extendedImages`, `EQUIP_LABEL` e `LEVEL_LABEL`.
  - `name` é o nome em português e `en` o original em inglês (a busca aceita os dois; o passo a passo segue em
    inglês). As traduções ficam em `scripts/exercise-names-pt.json` (id original → nome), aplicadas pelo import.
  - Os JSONs `library-extended.json`, `library-instructions.json` e `exercise-images.json` são gerados por script. Não
    edite à mão.

### `src/lib/`: lógica (sem React, a não ser hooks/timer)

**`db.ts`**: Dexie `"augment"`.

| Parte         | Conteúdo                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tabelas       | `sessions` (`id, date, dayId, status`); `kv` (`key`: `settings`, `body-log`, `coach-config`, `coach-chat`, `online`, `online-workouts`, `error-log`, `operator-memory`); `programs` (`id`) |
| Migrações     | v2 cria `programs` com o PPL e faz backfill dos snaps; v3 faz backfill dos retratos de dia                                                                                                 |
| Configurações | `DEFAULT_SETTINGS` (operator `""`; `mesoStart` = segunda da semana atual); `sanitizeSettings`, `loadSettings`, `saveSettings`                                                              |
| Programas     | `loadActiveProgram`, `saveProgram`, `activateProgram`, `deleteProgram`, `backfillSnapshots`                                                                                                |
| Corpo         | `loadBodyLog`, `saveBodyLog`, `upsertBodyEntry`, `deleteBodyEntry`                                                                                                                         |
| Backup        | `exportBackup`, `isBackup`, `importBackup(b, "merge" \| "replace")`; `uid()`                                                                                                               |

> Há um ciclo de import entre `db.ts` e `restore.ts`.

**`restore.ts`**: pontos de restauração no aparelho (no máximo 6).

- Motivos: semanal, antes de importar, antes de restaurar, antes de apagar, manual.
- Funções: `listRestorePoints`, `createRestorePoint`, `ensureWeeklyRestorePoint`, `restoreFrom`,
  `deleteRestorePoint`.

**`hooks.tsx`**: `useSessions`, `usePrograms`, `useProgram`, `useSession(id)`, `useSettings()` → `[s, save, loaded]`,
`useBodyLog`, `useToday`, `ToastProvider`/`useToast` e `useWakeLock`. Os dados vêm de `liveQuery` do Dexie.

**`sessions.ts`**:

- `buildSession` monta a sessão do dia.
- `newSet` e `emptySet` (interno) criam séries; a carga pré-preenchida recebe `suggested: true`.
- `snapOf`, `unitFor`, `effectiveEndAt`, `sessionStats`.
- Volume: `weeklyVolume(…, fractional)`, `plannedVolume` e `sessionPeaks` (compara com o teto de 11 séries por
  músculo por sessão).

**`progression.ts`**: o coração das cargas.

| Grupo                     | Funções                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Unidades e arredondamento | `toKg`, `e1rm`, `roundTo`, `formatWeight`, `snapWeight`, `nextAvailableWeight`                                                                  |
| Barra e aquecimento       | `platesForBarbell`, `warmupSpec`, `workSets`, `mainLoad`                                                                                        |
| Sugestão                  | `suggest()`: `SuggestionKind` first/up/same/down/deload; `predictReps`, `increaseStep`, `loadRef`                                               |
| Recuo                     | `backoffWeight`, `revertBackoff` (limpa o `suggested`)                                                                                          |
| Histórico e recordes      | `historyOf(sessions, exId, alt?, libId?)` (cai para o histórico do mesmo `libId`), `recordsOf`, `prsBySession`, `prsInSession`, `summarizeSets` |
| Estagnação e regressão    | `stallOf` (`STALL_SESSIONS = 3`), `regressionOf`, `bestE1rm`, `suggestNext`                                                                     |

**`mesocycle.ts`**:

- Semanas: `MESO_LENGTH = 7`, `weekFor(mesoStart, date)`, `WEEK_RULES[0..7]`.
- Até onde ir: `stopFor`, `rirRange`.
- Check-in: `isLowDay`, `checkinAdvice`.
- Retomada e deload: `reentryFor`, `earlyDeloadMesoStart`, `fatigueDeloadFor`.
- Séries: `setsFor(e, week, adjust)` (`MAX_SETS = 4`), `withSetAdjust`.
- Descanso e aquecimento: `defaultRest`, `warmupsFor`.

**`engine.ts`**: os recados do motor.

- Avisos ao vivo: `ENGINE_RULES`, `liveNudges(LiveInput)` → `Nudge[]`, `restsBefore`, `intensifierPlan`.
- Tendências: `regressingExercises`, `fatigueAlert`, `strengthTrend`.
- Corpo e volume: `bodyAdvice`, `DIET`, `volumeAdvice`.

**`diagnostics.ts`**: `engineDiagnostics`.

**`report.ts`**: `weeklyReport` → `WeekReport` (shortfalls, RIR fora, estagnações, articulação), `focusOf` e
`mesoReport` (inclui candidatos a troca de acessório).

**`schedule.ts`**: `dayOrder`, `nextIndex`, `planAhead` (rotação dos dias pelo calendário de `trainingDays`).

**Visual e métricas**:

- `visual.ts`:
  - fadiga e recuperação: `muscleStatus`, `recoveryHours`, `fatiguePct`, `fatigueLevel`, `hoursToReady`,
    `readiness`;
  - atividade: `dailySets`, `activityGrid`, `weekStreaks`;
  - corpo: `weightTrend`, `goalStatus`, `GOAL_RANGES`, `bodyweightAt`, `relativeStrength`.
- `slots.ts`: `volumeSlots`, `slotCells` e `SLOT_COLUMNS` (o antebraço fica em "Tronco").
- `attributes.ts`: `attributes()`, com seis atributos: forca, volume, consistencia, recuperacao, intensidade e
  composicao.
- `achievements.ts`: `computeAchievements`.
- `hud.ts`: `hudSegments` e `finishLogLines`.

**`program-edit.ts`**: funções puras do montador. Todas recebem um `Program` e devolvem um `Program` novo.

- Programa: `blankProgram`, `duplicateProgram`, `fromTemplate`, `renameProgram`, `setPeriodization`.
- Dias: `addDay`, `updateDay`, `moveDay`, `removeDay`.
- Exercícios: `exerciseFromLibrary`, `customExercise`, `addExercise`, `updateExercise`, `moveExercise`,
  `removeExercise` (manda para `retired`), `toggleSupersetWithNext`.
- Validação e utilidades: `programIssues`, `slugify`, `dayCode`, `muscleLabelOf`.

**Interface e plataforma**:

- `timer.tsx`: `TimerProvider`/`useTimer` (descanso; som, vibração, notificação; estado em
  `localStorage["augment-timer"]`).
- `native.ts`: `isNative`, `vibrate`, `keepAwake`, `requestNotifyPermission`, `scheduleRestAlarm`/`cancelRestAlarm`,
  `shareFileNative`, `readSecretKey`/`writeSecretKey` (secure storage) e `setupBackButton`.
- `brand.ts`:
  - geometria do logotipo Núcleo: `RING_SEGMENTS`, `CORE_A`, `BARBELL`, `WORDMARK_*`;
  - desenho em canvas: `drawBrandMark`, `drawWordmark`;
  - boot: `BOOT_MODULES`, `bootModeFor`, `readBootMode`, `markBootDone` (chave `augment-boot-day`).
- `fx.ts`: `applyFxLevel`, `bootBeam`, `installTapFx`.
- `textZoom.ts`: `measureTextZoom`/`applyTextZoom` (lê a fonte do sistema → `--text-zoom`).
- `files.ts`: `download`, `shareOrDownload`, `resizeImageFile`.
- `dates.ts`: datas locais `AAAA-MM-DD`; `todayISO`, `addDays`, `daysBetween`, `mondayOf`, formatadores,
  `bySessionAsc`/`bySessionDesc`.

**AUG.CORE (`lib/core/`)**: o "cérebro" determinístico. Puro, offline, sem importar telas. Design em `docs/aug-core.md`.

- `operator.ts`:
  - memória declarada `OperatorMemory` (kv `operator-memory`, entra no backup): restrições com validade (`time-cap`,
    `equipment`, `pain`, `schedule`), `mesoHistory`, `lastMesoStart`, `calibrationUntil`; `sanitizeOperatorMemory`,
    `mergeOperatorMemory`, `activeConstraints`;
  - estado derivado `operatorState(sessions, bodyLog, settings, memory, today)`: por músculo (`recoveryMultiplier`,
    `volumeTolerance`), por exercício (`responsiveness`, `jointRisk`), comportamento (`restRatio`, `weekdayMissRate`,
    `preferredHour`, `loadAcceptanceRate`), `body` (tendência de peso) e `calibration`; cada um com `confidence`;
  - `operatorBrief(state)` → `{ headline, detail, tone, silent }`. **`silent: true` = o Hoje não mostra nada**;
  - `closeFinishedMesos` / `mesoSummaryFor`, `simulateOperator` (operadores fictícios para testes),
    `effectiveRecoveryHours`, `learnedRecoveryMultipliers` (vai para `muscleStatus` em `visual.ts`).
- `planner.ts`: `explainLoad()` embrulha `suggestNext()` e devolve o `DecisionTrace` ("Por que essa carga?");
  `planDay()` devolve uma `SessionAdaptation` efêmera (séries, `alt`, `stop`) que `buildSession` aplica no retrato
  da sessão. **Nunca altera `db.programs`.** Pisos: 2 séries em composto, 1 em isolado.
- `intents.ts`: `matchIntent` (6 intenções, por palavra) e `handleIntent` (resposta na hora, offline; mudanças viram
  `IntentProposal` que só grava com confirmação). Negar dor não é queixa.
- Hooks: `useOperatorMemory`, `useOperatorState` (`hooks.tsx`); `db.ts`: `loadOperatorMemory`, `saveOperatorMemory`,
  `upsertConstraint`, `removeConstraint`, `ensureMesoHistory`.
- Telas: Hoje (linha do banner só quando `!silent`, `planDay` na duração e no `buildSession`), ExerciseBlock
  (lista `.why-load` dentro da dobra do PlanCard), Coach (intenção antes do modelo + "Perguntar ao treinador mesmo assim"), Relatório
  e treinador (`gemeo_digital` no contexto).
- **Texto para a pessoa sem jargão**: nada de "gêmeo", "calibração", "telemetria", "curva" na tela.
- Testes: `operator.test.ts`, `planner.test.ts`, `intents.test.ts` e `guarantees.test.ts` (o que o planejador nunca
  faz, sob muitas combinações).

**Treinador (`lib/coach/`)**:

- `context.ts`:
  - prompt: `coachSystem(name)` (derivado do programa ativo + `scienceText`), `programText`, `turnContext`;
  - ferramentas: `toolPlan`, `toolWeekReport`, `toolMesoReport`, `toolBodyLog`, `toolExerciseHistory`,
    `toolSessions` e `runCoachTool`;
  - propostas de mudança: `Proposal`, `parseProposal`, `describeProposal`, `proposalPatch`.
- `tools.ts`: `COACH_TOOLS` (definições para a API) e `TOOL_LABEL`.
- `chat.ts`:
  - configuração: `CoachConfig`, `MODELS` (com preço), `DEFAULT_CONFIG` (modelo `claude-opus-5-5`),
    `load/saveCoachConfig` (no aparelho a chave vai para a secure storage, não para o kv);
  - conversa: `load/saveCoachChat`, `coachTurn()` (laço de streaming com ferramentas), `pruneExpiredToolResults`;
  - `errorText`.
- `handoff.ts`: `coachHandoffText(data)`, o documento "sem chave" para colar no Claude, Gemini ou ChatGPT.

### `src/components/`

| Componente                                                   | Papel                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `ExerciseBlock`                                              | cartão do exercício no treino: próxima série, fila, menu radial, aquecimento, RIR, feedback |
| `SetRow`                                                     | linha de série (`parseNum`, prop `hint`, sugestão fantasma); `Choice`                       |
| `PlanCard`                                                   | plano da série (decisão do motor)                                                           |
| `TimerBar`                                                   | barra de descanso fixa                                                                      |
| `SessionHud`                                                 | HUD fixo do treino                                                                          |
| `HoldButton`                                                 | segurar para confirmar                                                                      |
| `RadialMenu`                                                 | roda de ações; `useLongPress`                                                               |
| `TerminalLog`                                                | log de fim de treino                                                                        |
| `ShareWorkoutCard`                                           | imagem do treino em canvas para compartilhar                                                |
| `FatigueMap` + `Anatomy`                                     | mapa de fadiga (SVG frente/costas; o antebraço é zona própria)                              |
| `VolumeSlots`                                                | séries da semana por músculo                                                                |
| `AttributeWheel`                                             | roda de atributos                                                                           |
| `LineChart`, `ActivityHeatmap`, `RecordList`, `PhotoCompare` | gráficos e registros                                                                        |
| `BodyLab`, `BodyGoalCard`                                    | biometria e meta                                                                            |
| `EngineLab`, `NudgeList`                                     | explicação do motor e recados (`whyLabel`)                                                  |
| `SysModule`/`SysModuleGroup`                                 | aviso no estilo módulo de sistema                                                           |
| `PanelActions`                                               | ações de painel                                                                             |
| `RestorePoints`                                              | pontos de restauração                                                                       |
| `ExerciseDemo`                                               | fotos de execução                                                                           |
| `Brand`                                                      | `BrandMark`, `Wordmark`, `BootScreen`                                                       |
| `bits.tsx`                                                   | `StopBadge`, `PageHead`, `WeekStrip`, `dayName`, `dayCode`                                  |
| `Icon`                                                       | ícones SVG por nome                                                                         |

### `src/screens/`

- `Today`, `SessionScreen`, `History`, `Progress`, `Report`, `Exercises` (`equipOf`), `ExerciseDetail`, `Guide`,
  `SettingsScreen`, `Programs` e `Coach`.
- `ProgramEditor` também exporta `MusclePicker` e `AddExercise`; este é reaproveitado no treino.
- `Online` (exporta `agoText`) e `Friends`: as duas telas do online.

### Online (`server/` e `src/lib/online/`)

**Servidor** (`server/src/`):

- `app.ts`: `handle(req, env, now?)` + roteador. Erros viram `{ error: "texto em pt" }` com o status HTTP.
  - Contas: `register` (devolve `recoveryCode` uma vez), `login` (bloqueia por 15 min depois de 5 erros), `recover`,
    `patchMe` (também `sex` e `bodyweightKg`, na tabela `profiles`), `newRecoveryCode`, `changePassword`,
    `deleteAccount` (apaga tudo, via `wipeUser`).
  - Moderação: `blockUser`/`unblockUser`/`listBlocks` (bloqueio desfaz a amizade e esconde na busca), `reportUser`.
  - Aparelhos: `pullWorkouts`/`pushWorkouts` (treino por treino, com `rev` crescente por pessoa).
  - Dono (`/admin/*`, exige `env.ADMIN_TOKEN`): `adminErrors`, `adminReports`, `adminDeleteUser`. `reportError`
    recebe os erros do app sem login.
  - Amigos: `searchUsers`, `listFriends`, `requestFriend` (pedido cruzado vira amizade), `acceptFriend`,
    `removeFriend`.
  - Recordes: `putRecords` (guarda sempre o MAIOR), `percentiles` (só mostra com ≥ `LIMITS.minOthers` = 5 outros;
    empate conta metade; respeita `share_percentiles`; com perfil, devolve também `group` = mesma faixa de sexo e
    peso ±10%, e `rel` = 1RM ÷ peso corporal), `friendsRanking`, `friendRecords`.
  - Treinos e backup: `putActivity`, `feed` (amigos, 30 dias), `putBackup` (pedaços de 1,5 MB; ignora repetido; guarda
    5), `getBackup`.
- `protocol.ts`: tipos `Me`, `PublicUser`, `AuthResponse`, `RecordIn`, `Percentile`, `RankRow`, `ActivityIn`,
  `FeedItem`, `FriendsResponse` e `BackupMeta`, mais `LIMITS` e `USERNAME_RE`. **O app importa este arquivo**:
  mudou o contrato, mude aqui.
- `crypto.ts`: `hashSecret`/`verifySecret` (PBKDF2, no máximo 100 mil iterações no Workers), `randomToken`, `sha256`,
  `recoveryCode`.
- `db.ts`: interface `Db` (subconjunto do D1).
- `sqlite-node.ts`: `openSqlite(path, pastaDasMigrações)`, que imita o D1 sobre `node:sqlite` e roda todos os `.sql`
  em ordem.
- `node.ts`: servidor HTTP no Node.
- `worker.ts`: entrada no Workers.
- Tabelas em `migrations/0001_init.sql`: `users`, `auth_tokens` (só o hash do token), `friendships` (par a<b),
  `records` (lib, e1rm/load em kg), `activity`, `backups` + `backup_chunks`, `rate_limits`. Depois: `0002` `workouts`,
  `0003` `error_reports`, `0004` `profiles`, `blocks` e `reports`.

**App** (`src/lib/online/`):

- `client.ts`:
  - endereço: `apiUrl()` (localStorage `augment-api-url` ou `VITE_API_URL`), `setApiUrl`;
  - token: `loadToken`/`saveToken` (secure storage no app nativo, chave `augment-online-token`);
  - chamadas: `api(method, path, body?)`; `ApiError` (status 0 = sem conexão); `onlineErrorText`.
- `sync.ts`:
  - estado: `OnlineState` no kv `"online"` (user, hashes do que já subiu, `percentiles`, cache `social`), `useOnline()`,
    `loadOnline`/`saveOnline`;
  - o que sobe: `libraryBests(sessions)` (só titular sem `alt`, sem `custom-`, kg, 1RM com reps ≤ 15),
    `activityOf(sessions)` (60 dias), `backupPayload()` (hash ignora `exportedAt`; **sem as fotos do corpo**, a não
    ser com `settings.cloudPhotos`);
  - quando: `syncNow(reason)` (um por vez; pedido no meio entra na fila), `syncIdle()`, `startAutoSync()`;
  - backups: `listCloudBackups`, `restoreCloudBackup` (substitui os dados, cria antes um ponto de restauração e
    devolve aos registros as fotos que estavam no aparelho);
  - erro 401: sai da conta sem apagar dados locais.
- `account.ts`: `register`, `login`, `recover`, `logout`, `updateProfile`, `newRecoveryCode`, `changePassword`,
  `deleteAccount`, mais os atalhos de amigos, ranking, bloqueio (`blockUser`, `unblockUser`, `getBlocked`) e
  `reportUser`.
- `workouts.ts`: `syncWorkouts()` (baixa e envia treino por treino; chamado no começo de cada sync) e
  `resetWorkoutSync()`. Estado no kv `online-workouts`. `hash.ts`: `quickHash`.

**Componentes do online**:

- `CommunityCard({libId})`: na página do exercício, mostra o percentil, a comparação na própria faixa e a força
  relativa (`FairLines`, `groupLabel`) e o ranking entre amigos.
- `UserModeration({user})`: "Bloquear ou denunciar", recolhido, em cada amigo e pedido.
- `CommunityModule()`: o módulo NET.06 no Progresso.
- `pctPhrase`: monta a frase da comparação.
- `OnlineStrip` + `useOnlineStatus`: o atalho de amigos e o status "Local / Nuvem" no topo do Hoje.

**Testes**:

- `server/src/app.test.ts`: o servidor, num SQLite em memória.
- `src/lib/online/sync.test.ts`: o app falando com o servidor real por um `fetch` simulado.

### Outros

- `scripts/`: `lint.ts`, `coach.ts`, `import-exercise-db.py`, `exercise-names-pt.json`, `exercise-images.py`,
  `android-assets.py`, `ios-assets.py`, `make-icons.py`.
- `tools/verify/`: auditoria de layout e fluxos no navegador (seção 9).
- `docs/`:
  - `aug-core.md`: design do cérebro determinístico (modelo do operador, planejador, presença, intenções);
  - `roadmap-apk.md`: 6 fases; até a fase 4, concluídas;
  - `ux-discovery/`: jornada do operador, avaliação de UI/UX e comparativo;
  - `brand/augment-logo.html`: estudo da marca.
- `.claude/skills/treinador`: skill de debrief a partir de um backup.
- `capacitor.config.ts`: SystemBars com insets via CSS, estilo DARK.

## 6. Regras do domínio (o que o código assume)

- **Mesociclo** (`WEEK_RULES`):

  | Semana | Regra                                                                                                            |
  | ------ | ---------------------------------------------------------------------------------------------------------------- |
  | 0      | Programa fixo (`periodization: "fixed"`): sem meso, sem deload automático                                        |
  | 1      | Entrada: isolados com −1 série (`iso`), ninguém vai à falha (2–3 RIR)                                            |
  | 2      | Séries da ficha, ainda sobrando reps                                                                             |
  | 3      | Compostos até a falha técnica, isolados até a falha. Intensificadores começam aqui                               |
  | 4–6    | Exercícios ▲ (`up`) ganham +1 série. A 6 é a última pesada                                                       |
  | 7      | **Deload**: metade das séries, mesma carga, ~4 RIR. O app inteiro troca o vermelho por azul-aço (`.mode-deload`) |

- **Volume fracionado**: cada série vale 1 para os `muscles` e 0,5 para os sinergistas (`synergists` do exercício ou
  `SYNERGISTS` da biblioteca).
- **Teto por sessão**: `SCIENCE.perSessionCeiling = 11` séries por músculo por sessão (`sessionPeaks`). O editor
  avisa, não bloqueia.
- **Retratos (snapshots)**: a sessão guarda `day` e `SessionExercise.snap`. O histórico sobrevive a edições e trocas de
  programa, sempre via `exOf`/`dayOf`. Nunca assuma que `exById` acha um exercício antigo.
- **Progressão dupla**: bateu o topo da faixa de reps em todas as séries → sobe a carga (`increaseStep`; composto
  +2,5 kg). Se caiu, mantém ou recua (`backoffWeight` −15%). A disponibilidade de anilhas e pesos de máquina entra no
  arredondamento (`snapWeight`, `settings.machineWeights`).
- **Sugestão vs. valor digitado**: `SetEntry.suggested = true` significa que é sugestão e aparece em cinza. Ao marcar
  ✓ com o campo vazio, grava a sugestão. Digitar limpa a flag.
- **Exercício extra** (`extra: true`): só naquele treino. O histórico do extra usa o `libId` como fallback em
  `historyOf`.
- **Datas** são strings locais `AAAA-MM-DD` (`dates.ts`). Nada de `Date` em UTC para dia. `trainingDays` vai de 0 =
  domingo a 6 = sábado; `ProgramDay.weekday` usa 1 = segunda.

## 7. Sistema visual (`src/styles/`, 12 arquivos)

Os estilos ficam em `src/styles/NN-nome.css`, carregados na ordem por `src/styles/index.css`. **A ordem importa**
(regra de baixo vence a de cima): estilo novo entra no arquivo da sua área ou num arquivo novo no fim.

| Arquivo                      | O que guarda                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `01-base`                    | tokens do `:root`, reset, layout, tipografia, topo e cabeçalho de página                    |
| `02-componentes`             | cartões, botões, chips, barra de abas, timer                                                |
| `03-hoje`                    | banner de missão, faixa de semanas, faixa de dias                                           |
| `04-treino`                  | cartão do exercício e linhas de série                                                       |
| `05-comuns`                  | toast, calendário, tabelas, gráfico, formulários, Guia, rodapé, Treinador                   |
| `06-fadiga`                  | resumo visual do Progresso, mapa de fadiga, anatomia                                        |
| `07-treino-hud`              | fotos de execução, HUD do treino, próxima série, segurar, menu circular, log                |
| `08-progresso`               | séries da semana, roda de atributos, módulos, gráficos, mapa do ano, laudo                  |
| `09-oficina-relatorio`       | Exercícios, modo terminal, deload, relatório, zona de perigo                                |
| `10-montador-acessibilidade` | montador, alvos de toque, telas estreitas, letra grande do sistema                          |
| `11-online`                  | conta, amigos, comparação, moderação                                                        |
| `12-primeiro-uso-erro`       | assistente de primeiro uso e tela de erro                                                   |
| `13-atmosfera`               | horizonte em perspectiva, cartões que "ligam", LEDs, carga nos botões, varredura biométrica |

**Atmosfera e movimento** (`13-atmosfera.css`): o app é um sistema vivo que a pessoa veste. Horizonte em grade no
rodapé (`body::after`, atrás de tudo), luz fria no alto, blocos que "ligam" ao entrar (só opacidade e deslocamento:
nada de máscara, clip-path ou filter em bloco grande, que deixavam a tela sem pintar), LED no módulo seguinte, luz
que varre o botão tocado (`.btn.zap`), cantoneiras no `.card.hot` e a linha de varredura `.scan-line` (banner do
Hoje e boas-vindas). Tudo desliga em `fx-gym`/`fx-min` e com "reduzir movimento".

**Personas** (`src/data/personas.ts`, `settings.persona`): a aparência do operador é um par herói + avatar em
`public/` (`hero-<id>.webp` 720×720 transparente, `avatar-<id>.png` com recorte circular). Hoje: `humano`
(padrão: implante neural, lente vermelha, circuitos ciano) e `robo` (capacete integral, o desenho original). Escolha
em Ajustes → Operador → Aparência (`.persona-pick`). `heroSrc()`/`avatarSrc()` resolvem o arquivo; a tela de
boas-vindas usa a padrão. Persona nova: gere os dois arquivos no mesmo enquadramento e rode
`TAG_PERSONA=<id> node tools/verify/tagcheck.mjs …` (seção 9).

**Tokens no `:root`**:

- Cores: `--bg #0c0e11`, `--surface*`, `--ink*`, `--red #ef302c`, `--cyan #3fd8e0`, `--purple`, `--amber`, `--green`,
  `--magenta` (só no glitch do boot).
- Ação e campos: `--action-fill`, `--danger*`, `--field-border`, `--track-empty`, `--focus-ring`.
- Fontes: `--tech` (Orbitron), `--mono` (Share Tech Mono), `--body` (Exo 2).
- Tamanhos de fonte:

  | `--fs-1` | `--fs-2` | `--fs-3` | `--fs-4` | `--fs-5` | `--fs-6` |
  | -------- | -------- | -------- | -------- | -------- | -------- |
  | 11 px    | 12 px    | 13,5 px  | 15,5 px  | 20 px    | 30 px    |

- `--nav-h: 66px`; `--text-zoom` (fonte do sistema).

**Modos**:

- `:root.mode-deload`: vermelho vira azul-aço.
- `.mode-terminal`: paleta lima do treinador (`--action-fill: #cfe800`).

**Seções do CSS** (procure pelo comentário `/* ---------- Nome ---------- */`):

- Layout, Type, Topbar, Page header, Surfaces, Buttons, Chips & tags, Bottom nav, Timer (HUD).
- Mission hero (banner do Hoje), Week strip, Day strip.
- Exercise card, Set rows, Toast, Calendar, Volume bars, Big numbers, Tables, Chart, Video, Forms, Guide, System
  footer, Treinador.
- Mapa de fadiga, Anatomia, HUD fixo do treino, Próxima série, Segurar para confirmar, Menu circular, Log de fim de
  treino, Glitch de recompensa, Séries da semana, Roda de atributos.

**Regras práticas**:

- Alvos de toque ≥ 44 px.
- Nenhum texto cortado em 320 px nem com fonte do sistema a 130%.
- Contraste conforme a WCAG.
- Respeite `prefers-reduced-motion`.

## 8. Armadilhas conhecidas (já custaram tempo)

- **CRLF/LF misturados** nos arquivos. Edite com a ferramenta Edit, ou com Python normalizando as quebras. `sed` pode
  falhar silenciosamente.
- **Dividir CSS**: ao mexer na ordem dos arquivos de `src/styles/`, compare o CSS do `vite build` antes e depois.
- **Heredoc com aspas complexas no Bash quebra.** Escreva scripts com a ferramenta Write num arquivo e rode o arquivo.
- **`python -I` ignora `PYTHONIOENCODING`.** Use `sys.stdout.reconfigure(encoding="utf-8")`.
- **Vite HMR**: `import('/src/...')` dentro do `eval` da página carrega **outra instância** do módulo (registro de
  programa vazio). Para conferir estado, leia o banco (`D.db.programs.get(...)`), não o registro em memória.
- **O BootScreen cobre o app ao carregar**: espere ~4–5 s nos testes de navegador antes de clicar.
- **Ciclo de import `db.ts` ↔ `restore.ts`**: não crie novos ciclos. Lógica nova vai em `lib/` sem importar telas.
- **Online**:
  - o celular é a fonte da verdade, então nunca faça o servidor sobrescrever dados locais automaticamente;
  - novos campos no contrato vão em `server/src/protocol.ts`;
  - SQL novo precisa rodar no D1 **e** no `node:sqlite`. Use placeholders `?`/`?N`, nunca valores interpolados.
    `batch` é tudo ou nada;
  - mudou o schema? Crie a próxima `server/migrations/000N_*.sql` (hoje vão até a `0004`), só com
    `CREATE ... IF NOT EXISTS` (o servidor Node roda todas a cada início); nunca edite as já aplicadas. Dado novo
    por pessoa vai em tabela própria (como `profiles`), não em `ALTER TABLE`;
  - toda tabela nova com `user_id` entra em `wipeUser` (apagar conta).
- **`node:sqlite` no vitest** é carregado via `createRequire` (o Vite não conhece o módulo). Precisa do Node 22.5+; o
  CI usa o 24.
- **Testar o online no navegador**: rode `npm run server` (preview `augment-server`). No app: Ajustes → Conta online →
  Servidor → `http://localhost:8787`. O limite de cadastros é de 30 por hora por IP; em teste local, apague a tabela
  `rate_limits` de `server/data/augment.db`.
- **O PPL do usuário estoura o teto por sessão** nas semanas 4–6 de propósito. Não "conserte".
- **Orçamento de hex = 400**: ao passar, crie um token no `:root` em vez de repetir a cor.
- `.claude/launch.json` sempre aparece modificado (fim de linha). Ignore e não commite.

## 9. Como verificar (antes de dizer "pronto")

1. `npm run check` precisa passar inteiro.
2. **Mudança visual**: rode o preview (`augment-dev` em `.claude/launch.json`, porta 5173) e meça nas larguras
   320/360/375/390/412/768 (e 820). Faça também um passe com o texto a 130% e um no WebKit (iPhone).
   - As ferramentas ficam em `tools/verify/` (leia o `README.md` de lá): `npm run verify:layout` (aceita url, pasta,
     escala `1.3` e telas), `npm run verify:e2e`, `npm run verify:webkit`.
   - Telas logadas: `npm run server`, `node tools/verify/seed-server.mjs` e a auditoria com
     `AUDIT_API=http://localhost:8787`.
   - `audit.mjs`: texto cortado, sobreposição entre irmãos flex/grid na mesma linha, alvos < 44 px.
   - `tagcheck.mjs` + `tagmeasure.py`: distância em pixels entre a etiqueta do banner e o herói, em fundo vermelho
     e azul (o script carrega os dados de demonstração e esconde a `.scan-line` antes de medir).
   - `shots.mjs`: foto de cada tela em 390 px para revisão de design (`SHOTS_RAW=1` não força o fim das animações;
     no Git Bash, passe as rotas com `MSYS_NO_PATHCONV=1`).
   - `e2e.mjs`: fluxos dos testes com usuários.
   - `seed.js`: dados de demonstração.
3. **Lógica**: escreva ou ajuste o teste vitest ao lado (`*.test.ts` em `src/lib`, `src/data`, `src/lib/coach`).
4. **APK**: `npm run build:android` e, no CI, o workflow `android.yml`.

## 10. graphify (grafo do código)

O grafo do repositório está em `graphify-out/`. **Consulte antes de abrir arquivos** para achar onde algo vive:

- `graphify-out/GRAPH_REPORT.md`: comunidades nomeadas (47), nós-deus e ciclos.
- `graphify query "pergunta"`: busca no grafo (sem LLM, barato).
- `graphify path "A" "B"` e `graphify explain "Nó"`: ligação entre dois nós e o contexto de um nó.
- `graphify update .`: reextrai o código e atualiza o grafo (sem LLM). Rode depois de mudar arquivos.

**Dica**: o grafo casa por **nome de símbolo**, não por frase em português. Prefira `graphify explain "suggest()"`
ou `graphify explain "SessionView()"`, que mostram o arquivo:linha de quem chama e de quem é chamado, em vez de
`query "onde a carga é calculada"`, que acerta pouco.

Nós-deus (mais conectados): `SessionView`, `Progress`, `addDays`, `formatWeight`, `workSets`, `Today`, `Session`,
`mondayOf` e `exById`. Mudar a assinatura de um deles afeta muita coisa: confira os usos com Grep antes.

`graphify-out/` fica fora do git (está no `.gitignore`). Num clone novo, rode `graphify update .` para gerar o grafo.

O `.graphifyignore` tira do grafo android/, dist/, public/, os JSONs gerados da biblioteca, imagens e o kit Figma.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
