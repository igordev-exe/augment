# Ferramentas de verificação

Rodam contra o servidor de desenvolvimento (`npm run dev`, porta 5173), num Edge ou Chrome sem janela. Use
`BROWSER_PATH` para apontar outro navegador.

| Comando                                                                              | O que faz                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:layout`                                                              | Auditoria de layout em 6 tamanhos de tela, todas as rotas, o assistente de primeiro uso e o treino em andamento. Sai com erro se achar algo. Argumentos opcionais: url, pasta de saída, escala do texto (`1.3`), telas (`320,360`). |
| `npm run verify:e2e`                                                                 | Fluxos dos testes com usuários (sugestões, aquecimento, exercício extra, fadiga, adicionar ao programa, treinador sem chave).                                                                                                       |
| `npm run verify:webkit`                                                              | A mesma auditoria no motor do iPhone. Precisa do Playwright: `npm i --no-save playwright && npx playwright install webkit`.                                                                                                         |
| `node tools/verify/tagcheck.mjs <url> <saída>` + `python tools/verify/tagmeasure.py` | Mede em pixels a folga entre a etiqueta do banner e o capacete.                                                                                                                                                                     |
| `node tools/verify/shots.mjs [url] [pasta] [rotas]`                                  | Foto de cada tela em 390 px (2×) com dados de demonstração, para revisar o design. `SHOTS_RAW=1` deixa as animações correrem; no Git Bash use `MSYS_NO_PATHCONV=1` para as rotas.                                                   |
| `node tools/verify/seed-server.mjs [url]`                                            | Cria 10 usuários de teste no servidor local (`npm run server`) para ver a comparação e os amigos.                                                                                                                                   |

`seed.js` são os dados de demonstração que as auditorias carregam no app.

Para medir também as telas de quem está logado (conta, amigos, comparação), suba o servidor local (`npm run server`),
rode `node tools/verify/seed-server.mjs` e chame a auditoria com `AUDIT_API=http://localhost:8787`. Ela entra na conta
`auditoria` (cria se não existir).

No GitHub, o workflow `verify.yml` roda a auditoria de layout a cada push (texto normal e a 130%).
