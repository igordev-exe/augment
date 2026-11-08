# Do treino do Igor para um APK aberto

> Plano feito a partir da leitura do código (nov/2026, commit 9c1a7a8, ~18,7 mil linhas em `src/`).
> Decisões já tomadas: cada usuário usa a própria chave da Anthropic; custo de servidor zero ou perto disso até
> saber se são 20 ou 10 mil usuários.

## O que o código mostra hoje

| Área                  | Como está                                                                                                                        | O que isso significa                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Ficha                 | `src/data/program.ts`: 5 dias fixos (Push A → Lower B), 35 exercícios, importada por **28 arquivos**                             | É o centro de tudo: motor, volume, fadiga, atributos, relatório, agenda, treinador                                            |
| Histórico             | Cada sessão guarda `dayId` e `exId` da ficha (`push-a.supino-incl-halt`); músculos e biblioteca vêm da ficha na hora de ler      | Se a ficha mudar, o histórico antigo perde a referência                                                                       |
| Ajustes por exercício | `units`, `increments`, `machineWeights`, `swaps`, `setAdjust`, `exerciseNotes` ficam em Settings, chaveados pelo id da ficha     | Viram campos do exercício do programa do usuário                                                                              |
| Biblioteca            | 34 exercícios (`library.ts`), imagens locais em `public/exercises`, músculo como texto livre                                     | Pequena para quem monta o próprio treino; os músculos (`MuscleId`) e sinergistas (`SYNERGISTS`) precisam ir para a biblioteca |
| Mesociclo             | Regras fixas de 6 + 1 semanas (`WEEK_RULES`, `setsFor` com `iso`/`up`, intensificadores)                                         | Bom como modelo, mas precisa poder ser desligado ou configurado                                                               |
| Agenda                | `schedule.ts`: rotação na ordem da ficha, sem pular treino                                                                       | Continua valendo para qualquer programa, lendo a ordem do programa ativo                                                      |
| Dados                 | Dexie (IndexedDB): tabela `sessions` + chave-valor (`settings`, `body-log`, `coach-config`, `coach-chat`, pontos de restauração) | Fotos ficam em data URL dentro de `body-log`: pesado para sincronizar                                                         |
| Treinador             | SDK da Anthropic direto do app, chave em `coach-config`; o backup não inclui a chave                                             | Já funciona com a chave de cada um. Padrão é Opus: caro para quem paga                                                        |
| Textos pessoais       | "Igor", "21/09", "5 treinos", nomes dos dias em `db.ts`, `Guide.tsx`, `schedule.ts`, `coach/context.ts`, `Progress.tsx`          | Viram dados do usuário ou texto genérico                                                                                      |
| APIs de navegador     | `navigator.share/vibrate/wakeLock/clipboard`, `Notification`, service worker, download por `<a download>`                        | No APK, cada uma tem um plugin nativo; o timer de descanso melhora muito                                                      |
| Testes                | 113 testes; 5 arquivos usam a ficha fixa direto                                                                                  | Passam a usar uma ficha de exemplo (fixture)                                                                                  |

## Fase 1 — Ficha vira dado (o que destrava o resto)

1. **Modelo de programa salvo.** Tabela `programs` no Dexie: `{ id, name, days[], mesocycle, createdAt, updatedAt }`, no
   mesmo formato de `ProgramDay`/`ProgramExercise`. `settings.activeProgramId` aponta o programa em uso.
2. **Sessão independente da ficha.** Ao montar a sessão (`buildSession`), gravar em cada `SessionExercise` um retrato do
   exercício: `lib`, `name`, `muscles`, `reps`, `stop`. Histórico, recordes, volume e atributos passam a ler esse
   retrato, não a ficha. Editar ou apagar o programa não quebra nada do passado.
3. **Migração dos seus dados (Dexie `version(2)`).** Cria o programa "PPL Igor" a partir do `PROGRAM` atual, com os
   **mesmos ids**; preenche o retrato em todas as sessões antigas; move os ajustes por exercício de Settings para os
   exercícios do programa. Ponto de restauração antes, como o import já faz.
4. **Trocar as 28 importações** de `PROGRAM`/`DAY_BY_ID`/`EXERCISE_BY_ID` por um acesso ao programa ativo
   (`useProgram()` nas telas, parâmetro nas funções puras de `lib/`). As funções de `lib/` já recebem quase tudo por
   parâmetro, então a maior parte é passar o programa adiante.
5. **Testes com fixture**: a ficha atual vira `src/data/templates/ppl-igor.ts` e os 5 testes passam a usá-la.

## Fase 2 — Montar o próprio treino

6. **Biblioteca maior com músculos estruturados.** Importar metadados do free-exercise-db (~800 exercícios) com
   `primaryMuscles`/`secondaryMuscles` mapeados para `MuscleId`; `SYNERGISTS` sai do `science.ts` e vira campo da
   biblioteca. Imagens: as 34 atuais continuam no app; as outras baixadas na primeira vez e guardadas em cache.
7. **Montador de treino** (no design atual): criar/renomear/reordenar dias; adicionar exercício pela busca da
   biblioteca (filtro por músculo e equipamento, que a tela Exercícios já tem); séries, faixa de reps, descanso,
   "até onde" (F/T/R), superset, intensificador, incremento e pesos da máquina; duplicar e apagar.
8. **Modelos prontos**: o seu PPL de 5 dias, um full body de 3, um upper/lower de 4. "Usar modelo" copia para um
   programa próprio editável.
9. **Mesociclo opcional**: ligado (regras atuais de 6 + 1) ou desligado (séries fixas, sem deload automático); duração
   configurável depois.
10. **Volume da semana pelo programa do usuário**: `plannedVolume` já soma o que a ficha pede; passa a somar o programa
    ativo, e a meta por músculo (hoje implícita na ficha) aparece no montador.

## Fase 3 — Primeira abertura e textos

11. **Boas-vindas**: nome, dias da semana, unidade (kg/lb), modelo ou "montar do zero", data de início. Hoje isso está
    espalhado em Ajustes ou fixo em `DEFAULT_SETTINGS`.
12. **Tirar o pessoal do código**: `operator`, `mesoStart`, "5 treinos por semana", nomes dos dias no Guia, na agenda e
    no contexto do treinador passam a vir do usuário/programa.
13. **Treinador para qualquer um**: tela de chave explicando onde criar e quanto custa; modelo padrão mais barato (a
    tabela de preço em `coach/chat.ts` já existe para mostrar a estimativa); contexto montado do programa ativo.

## Fase 4 — APK (Capacitor)

14. **Capacitor + Android**: `npx cap add android`; build com `base: "./"`; sem service worker na versão nativa (o
    Workbox fica só na PWA do GitHub Pages).
15. **Trocar APIs do navegador por plugins**:
    - timer de descanso → `@capacitor/local-notifications` agendada para `endAt` (toca com a tela bloqueada, que é o
      ponto fraco hoje);
    - vibrar → `@capacitor/haptics`; tela acesa → keep-awake;
    - backup, compartilhar e card do treino → `@capacitor/filesystem` + `@capacitor/share`;
    - vídeos do YouTube → `@capacitor/browser`.
      Uma camada `lib/native.ts` escolhe plugin ou API web, e o mesmo código serve aos dois.
16. **Chave da Anthropic**: guardar no armazenamento seguro do Android em vez do IndexedDB.
17. **Distribuição**: APK assinado nas Releases do GitHub (grátis) e, se quiser, Play Store (taxa única de US$ 25,
    política de privacidade, formulário de segurança de dados e exclusão de conta se houver login).

## Fase 5 — Conta e servidor (opcionais, custo zero no começo)

18. **Supabase no plano grátis** (Postgres + login + arquivos, 50 mil usuários ativos/mês): cabe de 20 a 10 mil usuários
    sem pagar. O app continua funcionando **sem conta**; "Entrar" só liga a sincronização.
19. **Sincronização local-first**: o Dexie continua sendo a fonte; cada registro ganha `updatedAt` e `deletedAt` (em vez
    de apagar de verdade); ao abrir o app e ao concluir um treino, envia e recebe o que mudou. Conflito: vale o mais
    recente por registro. Sessões quase nunca conflitam (cada uma é de um aparelho).
20. **Tabelas** `programs`, `sessions`, `body_entries`, `settings` com `user_id` e RLS (cada um só lê o seu). Fotos num
    bucket privado, não dentro do registro. Chave da Anthropic e conversa do treinador **nunca** sobem.
21. **Login**: e-mail com link mágico primeiro (sem senha para guardar); Google depois, se pedirem.
22. **LGPD/loja**: política de privacidade, exportar tudo (o backup atual já faz) e "apagar minha conta" que remove os
    dados do servidor.

## Fase 6 — Abrir o projeto

23. Licença do código, README para quem quiser contribuir, CHANGELOG.
24. Teste automático de layout (navegador invisível em 360/375 px que falha em texto cortado ou < 11 px) junto com o
    lint de estilo que já existe.
25. Idioma: tudo em pt-BR hoje; separar os textos só se aparecer gente de fora.

## Ordem e tamanho (estimativa)

| Fase                     | Tamanho                                                           | Depende de                     |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------ |
| 1. Ficha vira dado       | Grande (o mais arriscado; mexe em 28 arquivos e migra seus dados) | —                              |
| 2. Montador e biblioteca | Grande                                                            | 1                              |
| 3. Boas-vindas e textos  | Médio                                                             | 1                              |
| 4. APK                   | Médio                                                             | pode começar em paralelo com 2 |
| 5. Conta e sync          | Grande                                                            | 1 (ids e `updatedAt`)          |
| 6. Projeto aberto        | Pequeno                                                           | —                              |

Com as fases 1 a 4, o APK já serve para qualquer pessoa, com dados só no celular e backup por arquivo. A fase 5 entra
quando alguém precisar de dois aparelhos ou de não perder dados ao trocar de celular.
