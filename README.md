# AUGMENT

App web pessoal para rodar o **Programa de Hipertrofia v2** (Push A / Pull A / Lower A / Upper B / Lower B) no celular, durante o treino,
com estética cyberpunk. Funciona offline, instala na tela inicial e guarda tudo no próprio aparelho.

## O que tem

- **Treino do dia** pela agenda da ficha. Se você perder um dia, a sequência é empurrada, não pulada.
- **Registro de carga** série por série: peso, reps, aquecimento, unidade kg/lb por exercício.
- **Sugestão de progressão** (dupla progressão com carga fixa): manter com meta de reps, subir ou baixar, com a última vez ao lado.
- **−15% automático**: se uma série cair abaixo do piso da faixa, a última série é recalculada com 15% a menos.
- **Timer de descanso** automático com o descanso da ficha, som, vibração e tela acesa.
- **Mesociclo de 6 semanas + deload**: séries (−1 nos isolados na semana 1, +1 nos ▲ nas semanas 4–6, metade no deload), até onde ir (falha, falha técnica, sobra N) e intensificadores mudam sozinhos.
- **Histórico** com calendário (feito e planejado), lista por mês, repetir um treino antigo com um toque, editar ou excluir.
- **Recordes**: carga máxima, 1RM estimado (Epley), recorde de reps por carga, avisos de recorde ao concluir o treino.
- **Gráficos** de carga de trabalho e 1RM estimado por exercício, séries por músculo na semana contra a meta da ficha, treinos por semana.
- **Biblioteca** dos 34 exercícios: preparação, execução, erros comuns, por que está na ficha, alternativas, busca de vídeo e o seu vídeo de referência embutido.
- **Guia** com as regras da ficha e as fontes científicas.
- **Backup** em JSON (exportar/importar) e exportação das séries em CSV.

## Publicar no GitHub Pages (5 minutos)

1. Crie um repositório vazio no GitHub (ex.: `augment`). Pode ser público ou privado (veja "Privacidade").
2. Na pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "AUGMENT 1.0"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/augment.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Aguarde a aba **Actions** terminar (≈1 min). O app fica em `https://SEU-USUARIO.github.io/augment/`.

Cada `git push` na `main` roda os testes e publica de novo.

## Instalar no celular

- **Android (Chrome):** abra o link → menu ⋮ → **Instalar app**.
- **iPhone (Safari):** abra o link → Compartilhar → **Adicionar à Tela de Início**.

Depois de aberto uma vez, funciona sem internet.

## Seus dados

Os treinos ficam no IndexedDB do navegador do celular. Nada vai para servidor.

- Exporte um backup em **Ajustes → Exportar backup** de vez em quando, e sempre antes de trocar de celular ou limpar dados do navegador.
- O CSV de séries abre em qualquer planilha.

## Privacidade

O código e a ficha (incluindo as metas de dieta do guia) ficam visíveis se o repositório for público. Seus registros de treino **não** vão para o repositório.

Para deixar o repositório privado: GitHub Pages em repositório privado exige GitHub Pro, que é grátis para estudantes pelo
[GitHub Student Developer Pack](https://education.github.com/pack). Outra opção gratuita é conectar o repositório privado à Vercel, Netlify ou
Cloudflare Pages (build: `npm run build`, pasta: `dist`).

## Mudar o programa

Tudo da ficha está em `src/data/program.ts` (séries, reps, descanso, até onde ir, ▲, intensificadores, dicas) e a biblioteca em
`src/data/library.ts`. As regras do mesociclo estão em `src/lib/mesocycle.ts` e a progressão em `src/lib/progression.ts`.

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes da lógica (mesociclo, progressão, recordes, agenda)
npm run build    # gera dist/
npm run icons    # regenera os PNGs do ícone a partir de public/icon.svg (precisa de Python + Playwright)
```

Stack: React 18, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa. Gráficos em SVG próprio, sem biblioteca.

## Créditos

- Cantos chanfrados com borda: [augmented-ui](https://github.com/propjockey/augmented-ui) (BSD-2-Clause), via o atributo
  `data-augmented-ui="tl-clip br-clip border"`. O tamanho do corte e a cor da borda ficam em `src/styles.css`
  (`--aug-tl`, `--aug-br`, `--aug-border-bg`). Todas as cores são tokens no topo do mesmo arquivo.
- Fontes (SIL Open Font License): Orbitron, Share Tech Mono e Exo 2, via Fontsource.
- Avatar e referências visuais: [Sci-fi UI Kit (Free)](https://www.figma.com/community/file/1595778560755863610/sci-fi-ui-kit-free)
  e [CyberPunk 5000 UI Mega Kit](https://www.figma.com/community/file/1400413315812878567/cyberpunk-5000-ui-mega-kit-by-econev),
  da Figma Community.

---

Orientação geral baseada em literatura pública. Não substitui avaliação de médico, nutricionista ou educador físico.
