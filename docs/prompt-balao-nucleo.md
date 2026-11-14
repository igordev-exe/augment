# Balão do núcleo: avisos como pop-up flutuante, dentro e fora do app

Pedido do dono em 14/11/2026: os avisos do app chegarem como um **balão futurista flutuante**, no estilo de
notificação de um treinador cyberpunk, inclusive **fora do aplicativo**, no celular da pessoa. Referências visuais:
balões com avatar à esquerda, faixa de título ("IA ASSISTENTE", "KIROSHI"), cantos chanfrados, cor por estado
(ciano informação, âmbar alerta, vermelho erro, verde sucesso, violeta destaque), "digitando…", botões Sim/Não dentro
do balão, entrada deslizando com fade e saída dissolvendo.

Como usar: a Parte 1 é a análise. A Parte 2 é o prompt mestre, para colar numa sessão nova do Opus na pasta do
projeto. O `CLAUDE.md` entra sozinho.

---

## Parte 1: o que eu encontrei e o que dá para fazer

### 1.1 Como os avisos saem hoje

- **Dentro do app**: `useToast` (`lib/hooks.tsx`) desenha o `.toast-wrap` (`05-comuns.css`), uma faixa de texto com
  tom `ok`/`warn`/`danger`/`info` e o efeito `glitch` para recorde. O treino chama `toast(...)` em 8 lugares de
  `SessionScreen` (menos-15, recado ao vivo de `liveNudges`, superset, fim de treino…). O Hoje mostra avisos como
  `SysModule` e a linha do núcleo (`operatorBrief`, que fica `silent` quando está tudo no alvo). O chat sem chave
  responde em `coreReply` (`lib/core/localchat.ts`).
- **Fora do app**: só uma notificação existe, a do fim do descanso (`scheduleRestAlarm` em `lib/native.ts`, canal
  `descanso`, id 7001, via `@capacitor/local-notifications` 8.3.1). Na web não há nada fora da aba.
- A sessão da **Parte 2** (`docs/prompt-nucleo-vivo.md`) está trocando os recados do treino por **uma voz só**
  (fila, prioridade, limite por treino, variação de frase). O balão é a **cara** dessa voz: não crie uma segunda fila.

### 1.2 O que é possível, de verdade

| Onde                          | O que dá para controlar                                                                                                                                     | O que não dá                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dentro do app (web, APK, iOS) | Tudo: desenho do balão, avatar, cor, animação, botões, fila, som e vibração.                                                                                | Aparecer por cima de outros apps (Android exige permissão de sobreposição; a Play Store restringe; iOS não permite).                                                            |
| Fora do app, APK Android      | Notificação local agendada no aparelho: ícone pequeno, **cor de destaque**, título, texto, texto longo, **até 3 botões de ação**, canal com som e vibração. | A forma do balão. O Android desenha a notificação; o cyberpunk fica no ícone, na cor, no nome ("AUG.CORE") e no **texto na voz do núcleo**.                                     |
| Fora do app, iOS              | Igual ao Android, sem botões customizados fáceis e sem cor de destaque.                                                                                     | Idem.                                                                                                                                                                           |
| Fora do app, PWA no navegador | Notificação pelo service worker enquanto a aba existe ou, no Android, quando instalado.                                                                     | Push de verdade precisa de servidor de push (Web Push + VAPID). Daria no Worker gratuito, mas é **rede**: fica para depois e só com conta online. Sem isso, nada no iPhone PWA. |

Conclusão: **o balão futurista vive dentro do app**. Fora dele, o que viaja é a _voz_ (título curto, texto, cor, ação)
numa notificação local agendada pelo próprio aparelho, sem servidor, sem custo e offline.

### 1.3 O que vale notificar fora do app (tudo local, agendado na hora em que o app fecha ou salva)

Cada uma com canal próprio e **desligável em Ajustes → Avisos**, nunca mais de 1 por dia por canal, nada entre
22h e 7h, nenhuma nos dias de ausência declarada (`OperatorMemory.absences`):

1. **Fim do descanso** (já existe; só ganha a voz nova).
2. **Dia de treino** na hora preferida (`operatorState.behavior.preferredHour`): "Pull A hoje, 7 exercícios. Peito e
   tríceps prontos." Agendada para os próximos 7 dias por `planAhead`; reagendada a cada abertura.
3. **Músculo pronto** quando `hoursToReady` chega a zero fora do app (só para o músculo do próximo treino).
4. **Relatório da semana** no domingo à noite, se houve treino: "Semana 3 fechada: 4 de 5 treinos, 1 recorde."
5. **Retomada** depois de `reentryFor` (3+ dias sem treino, fora de ausência): "3 dias parado. Hoje vale um treino
   curto."
6. **Deload amanhã** / **ciclo novo** (`weekFor`).
7. **Backup** (só APK; já existe o lembrete no Hoje): uma vez por semana se `lastBackupAt` passou de 14 dias.

Não notificar: curtidas, amigos, "volte para o app", nada de marketing. Sem rede, nada vem do servidor.

### 1.4 O balão dentro do app

Substitui o toast de hoje (mesma API `toast(text, tone, fx, opts)`, para não reescrever quem chama) e vira o
**canal único** dos recados ao vivo da Parte 2, do `operatorBrief` e das propostas do chat.

- **Anatomia** (R1–R11; peças de `15-pecas.css`): avatar da persona à esquerda (`avatarSrc(settings.persona)`,
  hexágono com anel na cor do tom), faixa de título em Share Tech Mono ("AUG.CORE // TREINO", "// RECORDE",
  "// AVISO"), texto em Exo 2, cantoneiras com `augmented-ui`, borda e brilho na cor do tom. Tons: `info` ciano,
  `ok` verde, `warn` âmbar, `danger` vermelho (listras da zona de perigo), `reward` violeta (recorde, posto novo, meso
  fechado: usa `playReward` e `RECORD_BUZZ`). No deload o vermelho vira `--steel`, como o resto do app.
- **Estados**: entrando (slide 8 px + fade, `--t-ligar`), parado (6 s; com botões, até tocar), "digitando…" (três
  pontos, só quando o treinador com chave está respondendo), saindo (fade, `--t-toque`). Só `transform`/`opacity`/cor
  (`npm run verify:keyframes`); nada com reduzir movimento, `fx-gym`, `fx-min`.
- **Botões dentro do balão** (até 2): "Aplicar / Recusar" das propostas do núcleo, "Desfazer" do corte de séries,
  "Abrir" para rota. Alvo ≥ 44 px, texto ≥ `--fs-2`.
- **Fila**: uma por vez, prioridade `danger > reward > warn > info > ok`, a mesma mensagem não repete em 10 min,
  máximo de 6 por treino (a fila da Parte 2 já decide isso; o balão só **mostra**).
- **Posição**: acima da `TimerBar` e da nav (`bottom: calc(var(--nav-h) + …)`), largura `min(100% - 2*var(--sp-4),
420px)`, texto até 3 linhas em 320 px a 130%. Toque fora não fecha; arrastar para o lado fecha.
- **Voz**: as frases vêm das funções que já existem (`liveNudges`, `operatorBrief`, `coreReply`); o balão não escreve
  texto. Sem "IA", sem "Jarvis". Rótulo do remetente: "AUG.CORE".

### 1.5 Riscos e limites

- As referências mostram marcas (Cyberpunk 2077, Kiroshi, CD Projekt): servem de **direção de estilo**, nada de
  copiar logotipo, nome ou arte. Avatar é o da persona do app (licença resolvida).
- Permissão de notificação: pedir só na primeira vez que fizer sentido (primeiro treino terminado), com o balão
  explicando o que vai chegar. Android 13+ nega em silêncio se pedir cedo demais.
- Notificação agendada depende do aparelho (Xiaomi e Samsung matam alarmes com economia de bateria): o app não pode
  depender dela para nada; é lembrete, não regra.
- `LocalNotifications.schedule` aceita até 64 pendentes no iOS: agendar no máximo 7 dias × 2 canais.

---

## Parte 2: prompt mestre do balão do núcleo

### O que eu quero

Os avisos do AUGMENT saem num **balão flutuante do núcleo**, com avatar, faixa de título, cor por tom e animação de
entrada e saída, dentro do app; e, fora do app, como **notificações locais** agendadas no aparelho, com a mesma voz,
para dia de treino, músculo pronto, relatório da semana, retomada, deload e backup. Sem servidor, sem rede, sem
custo. Leia `docs/prompt-balao-nucleo.md` (Parte 1) antes.

### O que já existe (reaproveite; use `graphify explain "nome()"` antes de abrir arquivo)

`useToast`/`ToastProvider` (`lib/hooks.tsx`) e `.toast-wrap` (`05-comuns.css`); `scheduleRestAlarm`,
`requestNotifyPermission`, `notifications()` (`lib/native.ts`); `liveNudges` e `NUDGE_TONE` (`engine.ts`);
`operatorBrief`, `operatorState.behavior.preferredHour`, `absences` (`core/operator.ts`); `coreReply` e
`CoreProposal` (`core/localchat.ts`); `planAhead` (`schedule.ts`); `hoursToReady`/`muscleStatus` (`visual.ts`);
`reentryFor`, `weekFor` (`mesocycle.ts`); `weeklyReport` (`report.ts`); `playReward`, `RECORD_BUZZ` (`fx.ts`,
`hooks.tsx`); peças e tokens de setor (`15-pecas.css`, `components/Pieces.tsx`); `avatarSrc` (`data/personas.ts`).

**Não mexa** em `engine.ts`, `SessionScreen`, `SessionHud` nem `core/live.ts` além de trocar a chamada de `toast`
pela do balão: a fila e a prioridade dos recados ao vivo são da sessão da Parte 2 de `docs/prompt-nucleo-vivo.md`.
Se ela já tiver entregue uma fila, o balão consome essa fila.

### Fase 0: medir antes de mexer

Conte quem chama `toast(` e com que tons (Grep). Rode `npm run verify:layout` e guarde o resultado para comparar.

### Fase 1: o balão (`components/CoreBubble.tsx` + `17-balao.css`)

- Mesma API de `useToast` (`toast(text, tone, fx?, opts?)`), mais `opts.title`, `opts.actions` (até 2:
  `{ label, onPress, primary? }`), `opts.route`, `opts.sticky`. `ToastProvider` passa a renderizar o balão; o
  `.toast-wrap` antigo sai.
- Anatomia, tons, estados, fila, posição e limites da seção 1.4. Tom `reward` novo (violeta) para recorde, meta,
  posto e meso fechado; quem chama vibra `RECORD_BUZZ`.
- "Digitando…" só no Coach com chave, enquanto `busy`.
- Acessibilidade: `role="status"` (ou `role="alert"` em `danger`), foco vai para o primeiro botão quando há botões,
  Esc fecha, leitura pelo leitor de tela sem ler a decoração.

### Fase 2: a voz vira dado (`lib/core/notices.ts`, puro, sem React)

`Notice = { id, tone, title, text, route?, channel, at? }` e `plannedNotices(sessions, settings, memory, state,
today, now)` devolve as notificações dos próximos 7 dias (seção 1.3), já com as regras: 1 por dia por canal, nada
entre 22h e 7h, nada em ausência, hora preferida da pessoa, deload e retomada. Texto na voz do núcleo, sem jargão,
sem "IA". Teste no molde de `guarantees.test.ts`: nunca mais de 1 por canal por dia, nunca de madrugada, nunca em
ausência, nunca com dado inventado.

### Fase 3: fora do app (`lib/native.ts`)

`syncNotices(notices)`: cancela as do app (ids 7100–7199) e agenda as novas pelo `LocalNotifications`, um canal por
`channel` (nome e descrição em português), `smallIcon` próprio, cor `#ef302c`, `largeIcon` = avatar da persona,
`actionTypeId` com "Abrir" e "Hoje não". Chamada ao abrir o app, ao fechar um treino e ao mudar Ajustes. Na web,
só o que o service worker consegue com a aba viva; sem Web Push.

Ajustes → **Avisos**: um `SwitchRow` por canal e a hora do lembrete do dia de treino (padrão: hora preferida
aprendida). Permissão pedida pelo próprio balão na primeira vez que um aviso fora do app faria sentido.

### Fase 4: quem fala pelo balão

Troque: os `toast(` do treino, o `SysModule` de retomada/relatório no Hoje (ficam, mas o balão anuncia uma vez por
dia), a linha do `operatorBrief` (balão `info` ao abrir o Hoje, se `!silent` e ainda não mostrada hoje), as
`CoreProposal` do chat (botões Aplicar/Recusar no balão quando a proposta nasce fora da tela do chat, por exemplo
"faltei" dito pelo Hoje).

### Medição (decide se está pronto)

- `npm run verify:layout` em 320–820 px e a 130%: nenhum balão cortado, sobreposto à `TimerBar` ou à nav, alvo < 44.
- `npm run verify:keyframes` e `node tools/verify/motion.mjs`: parado com reduzir movimento, `fx-gym`, `fx-min`.
- `frames.mjs`: custo do balão entrando ≤ o do toast atual.
- Teste do `notices.ts`: 500 operadores simulados (`simulateOperator`) × 30 dias, nenhuma garantia violada.
- APK no aparelho: notificação de dia de treino chega na hora, com cor, avatar e botão; tocar abre `#/`.

### Regras duras

Tudo do `CLAUDE.md`. Nenhuma dependência nova (já há `@capacitor/local-notifications`). Nada de serviço de push,
nada pago. Nenhum texto novo com "IA", "Jarvis", "Siri" ou nome de marca das referências. Lógica em `lib/`, sem
importar telas. Sem commit.

### Ordem e entrega

1. Fase 0 e Fase 1 com o balão substituindo o toast, auditoria antes e depois: me mostre.
2. Fase 2 com os testes de garantia.
3. Fase 3 e Ajustes → Avisos; teste no APK.
4. Fase 4, `npm run check`, `CLAUDE.md` (seções 4, 5 e 7), `graphify update .`.

Entregue: fotos do balão em cada tom (390 px), a tabela da auditoria, a lista de garantias do `notices.ts` e o que
ficou de fora.
