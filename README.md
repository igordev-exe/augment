# AUGMENT

Meu app de treino para uso domestico. Fiz para rodar o meu **Programa de Hipertrofia v2** (Push A / Pull A / Lower A / Upper B / Lower B) no celular,
durante o treino, com estética cyberpunk. Funciona offline, fica instalado na minha tela inicial e guarda tudo no próprio aparelho.

## O que ele faz

- **Treino do dia** pela agenda da minha ficha. Se eu perder um dia, a sequência é empurrada, não pulada.
- **Registro de carga** série por série: peso, reps, aquecimento e unidade kg/lb por exercício.
- **Sugestão de progressão** (dupla progressão com carga fixa): manter com meta de reps, subir ou baixar, com a minha última vez ao lado.
- **Reps que sobraram (RIR)** com um toque depois de cada série, comparadas com a meta da semana. A sugestão seguinte avisa quando eu fui
  à falha cedo demais ou deixei reps demais na mesa.
- **Check-in** antes do treino (sono, energia, dor) e **"como bateu?"** depois de cada exercício (pump, volume, articulação).
- **Sugestão mais esperta**: cargas misturadas (rampa registrada como trabalho) usam a mais pesada; salto grande demais para a faixa
  (ex.: cabo de 17,5 → 20 kg) acumula reps antes de subir, com previsão de reps pela carga nova.
- **Relatório da semana** (seg–dom), com um cartão na tela inicial na segunda: treinos feitos e os que ficaram de fora, séries que
  faltaram, volume por músculo contra a meta, reps que sobraram contra a meta, exercícios estagnados, sinais do corpo, recordes e
  **um foco só** para a semana seguinte. Dá para navegar pelas semanas anteriores em Progresso.
- **Treinador (IA)**: um chat com o Claude que consulta meus treinos, relatórios e agenda antes de responder (ferramentas que leem
  os registros do app). As cargas continuam vindo do motor de regras: ele explica, e mudanças no app (incremento, recomeçar ou
  repetir semana) chegam como cartão para eu aplicar ou recusar. Uso minha chave da API da Anthropic, guardada só no aparelho e
  fora do backup. Configuro em **Ajustes → Treinador**.
- **Retomada**: depois de 10+ dias parado, ou de uma semana com menos da metade dos treinos, o app propõe recomeçar ou repetir a semana.
- **Destravar estagnação**: 3 treinos seguidos na mesma carga sem 1RM estimado novo, a sugestão baixa ~10% para voltar a subir.
  Se as séries estavam sobrando 3+ reps, em vez de baixar ela avisa que falta esforço.
- **−15% automático**: se uma série minha cair abaixo do piso da faixa, a última série é recalculada com 15% a menos.
- **Timer de descanso** automático com o descanso da ficha, som, vibração e tela acesa.
- **Mesociclo de 6 semanas + deload**: séries (−1 nos isolados na semana 1, +1 nos ▲ nas semanas 4–6, metade no deload), até onde ir (falha, falha técnica, sobra N) e intensificadores mudam sozinhos.
- **Histórico** com calendário (feito e planejado), lista por mês, repetir um treino antigo com um toque, editar ou excluir.
- **Recordes**: carga máxima, 1RM estimado (Epley), recorde de reps por carga e aviso quando eu bato um recorde ao concluir o treino.
- **Gráficos** de carga de trabalho e 1RM estimado por exercício, séries por músculo na semana contra a meta da ficha e treinos por semana.
- **Mapa muscular** (volume, recuperação e o que ficou sem treino), **mapa de atividade do ano**, **meta de peso** com ritmo semanal,
  **fotos antes/depois** e **força relativa** ao peso corporal.
- **Biblioteca** dos 34 exercícios da ficha, com fotos de início e fim do movimento: preparação, execução, erros comuns, por que cada um está no programa, alternativas, busca de vídeo e o vídeo de referência que eu escolhi, embutido.
- **Guia** com as regras da ficha, a **base de evidências** (cada princípio com nível: evidência, consenso, prática de campo ou hipótese) e as fontes. A mesma base (`src/data/science.ts`) entra no prompt do treinador e no motor: o relatório conta o **volume fracionado** (0,5 por série indireta, Pelland 2026) e avisa músculo abaixo da dose mínima efetiva.
- **Backup** em JSON (exportar/importar) e exportação das séries em CSV.
- **Pontos de restauração** no próprio aparelho: um por semana e antes de importar, restaurar ou apagar tudo (ficam os 6 mais recentes).

## Como eu instalo no celular

- **Android (Chrome):** abro o link → menu ⋮ → **Instalar app**.
- **iPhone (Safari):** abro o link → Compartilhar → **Adicionar à Tela de Início**.

Depois de aberto uma vez, funciona sem internet, inclusive na academia sem sinal.

## Meus dados

Os meus treinos ficam no IndexedDB do navegador do celular. Nada vai para servidor.

- Exporto um backup em **Ajustes → Exportar backup** de vez em quando, e sempre antes de trocar de celular ou limpar os dados do navegador.
- O CSV de séries abre em qualquer planilha.

## Treinador pelo computador (sem chave no app)

Com um backup exportado, gero um arquivo com as instruções do treinador e os dados já calculados pelo app:

```bash
npm run coach -- caminho/do/augment-backup.json
```

O arquivo sai em `coach/saida/` (fora do git). Colo numa conversa do claude.ai, ou uso `/treinador` no Claude Code, que roda o
script e faz o debrief.

## Como eu mudo o programa

Tudo da ficha está em `src/data/program.ts` (séries, reps, descanso, até onde ir, ▲, intensificadores, dicas) e a biblioteca em
`src/data/library.ts`. As regras do mesociclo estão em `src/lib/mesocycle.ts` e a progressão em `src/lib/progression.ts`.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes (mesociclo, progressão, recordes, agenda, backup)
npm run check    # tipos + formatação + testes
npm run format   # formata o código com Prettier
npm run build    # gera dist/
npm run icons    # regenera os PNGs do ícone a partir de public/icon.svg (precisa de Python + Playwright)
```

Stack: React 18, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa. Gráficos em SVG próprio, sem biblioteca.
A imagem do card "Missão do dia" fica em `public/hero.webp`.

## Créditos

- Cantos chanfrados com borda: [augmented-ui](https://github.com/propjockey/augmented-ui) (BSD-2-Clause), via o atributo
  `data-augmented-ui="tl-clip br-clip border"`. O tamanho do corte e a cor da borda ficam em `src/styles.css`
  (`--aug-tl`, `--aug-br`, `--aug-border-bg`). Todas as cores são tokens no topo do mesmo arquivo.
- Fotos dos exercícios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (domínio público). Para regerar:
  `python scripts/exercise-images.py <pasta do free-exercise-db> .` (o mapa fica em `src/data/exercise-images.json`).
- Fontes (SIL Open Font License): Orbitron, Share Tech Mono e Exo 2, via Fontsource.
- Avatar e referências visuais: [Sci-fi UI Kit (Free)](https://www.figma.com/community/file/1595778560755863610/sci-fi-ui-kit-free)
  e [CyberPunk 5000 UI Mega Kit](https://www.figma.com/community/file/1400413315812878567/cyberpunk-5000-ui-mega-kit-by-econev),
  da Figma Community.

---

Este é o meu treino pessoal, montado a partir de literatura pública. Não é recomendação para outras pessoas e não substitui avaliação
de médico, nutricionista ou educador físico.
