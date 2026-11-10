# AUGMENT online: como funciona e como hospedar

O app é **offline primeiro**: tudo funciona sem internet e sem conta, como sempre. A conta online é opcional e
acrescenta quatro coisas:

1. **Backup automático na nuvem**, com as 5 cópias mais recentes.
2. **Amigos**: pedido de amizade, feed de treinos e comparação de recordes lado a lado.
3. **Comparação com todos os usuários**: "você pega mais peso que 72% dos usuários neste exercício".
4. **Ranking entre amigos** em cada exercício.

## 1. Arquitetura

```
┌──────────── CELULAR (fonte da verdade) ────────────┐        ┌────── SERVIDOR (cópias) ──────┐
│ React + Dexie (IndexedDB)                          │        │ Cloudflare Worker (server/)   │
│  sessões, programas, ajustes, corpo                │        │  + banco D1 (SQLite)          │
│                                                    │  HTTPS │                               │
│ src/lib/online/sync.ts ── quando há conta e rede ──┼───────►│ PUT /records    melhores marcas│
│   recordes por exercício (libraryBests)            │        │ PUT /activity   resumo treinos │
│   resumo dos treinos (activityOf)                  │        │ PUT /backups    JSON completo  │
│   backup completo (backupPayload)                  │        │ GET /records/percentiles      │
│                                                    │◄───────┼ GET /feed, /friends, ranking  │
│ cache: kv "online" (percentis, amigos, feed)       │        │                               │
└────────────────────────────────────────────────────┘        └───────────────────────────────┘
```

O celular é o principal. O servidor nunca manda treinos de volta sozinho: ele só recebe cópias. A única exceção é
quando **você** toca em "Restaurar" num backup da nuvem. Por isso não existe conflito de sincronização nem risco de o
servidor apagar um treino seu.

### Quando o app sincroniza

A sincronização fica em `startAutoSync()`, chamada em `src/main.tsx`:

| Momento                 | O que acontece                                               |
| ----------------------- | ------------------------------------------------------------ |
| Ao abrir o app          | Tenta 4 s depois de abrir.                                   |
| Ao terminar um treino   | `finish()` em `SessionScreen.tsx` chama `syncNow("treino")`. |
| Ao sair do app          | Quando a tela vai para o fundo (`visibilitychange`).         |
| Quando a internet volta | No evento `online`.                                          |
| A cada 15 min           | Com o app aberto.                                            |
| Manual                  | Botão "Sincronizar agora" em Ajustes → Conta online.         |

Cada envio só acontece **se algo mudou**: o app guarda um hash do que já subiu. O backup sobe no máximo a cada
10 min, a não ser que você termine um treino, saia do app ou peça na mão.

### Dois aparelhos na mesma conta

Além do backup, cada treino concluído sobe sozinho (`src/lib/online/workouts.ts`, rotas `/workouts`). Outro aparelho
logado na mesma conta baixa os treinos que não tem e envia os dele: os dois ficam com tudo, treino por treino, sem
precisar "restaurar". Regras:

- só treinos concluídos entram; o treino em andamento fica no aparelho;
- editou o mesmo treino nos dois lados? Vale a versão deste aparelho, e ela sobe;
- apagou um treino num aparelho, ele some do outro. Se sumirem muitos de uma vez (mais de 3 e mais de 30%), o app
  entende que os dados foram limpos e **não** apaga nada na nuvem: baixa tudo de volta.

### Sem internet

O app continua 100% funcional. O status no topo da tela inicial mostra "Nuvem / pendente" e a tela da conta explica o
motivo. Quando a conexão volta, tudo sobe sozinho, sem fila que possa se perder: o app recalcula o que enviar a
partir dos dados do celular.

### Segurança e privacidade

**Senhas e códigos**:

- A senha é guardada com PBKDF2-SHA256 (100 mil iterações). O código de recuperação também fica só como hash.
- O token de login é aleatório, e o banco guarda apenas o hash dele.
- O token fica no **Keystore** (Android) ou no **Keychain** (iOS), via secure storage. No navegador, fica no
  localStorage.
- Esqueceu a senha? Use o **código de recuperação** que o app mostra uma única vez, no cadastro. Não há e-mail, então
  não existe custo de envio nem dado pessoal extra.
- Perdeu o código mas ainda está logado? Em Conta online, "Gerar um código novo" (pede a senha; o antigo deixa de
  valer). A tela lembra de guardar o código até a pessoa confirmar que guardou.

**Limites contra abuso**:

- 5 senhas erradas bloqueiam o login por 15 min.
- Cada IP pode criar até 30 contas por hora.
- Cada pessoa pode mandar até 60 pedidos de amizade por hora e fazer até 10 denúncias por dia.

**O que cada um vê**:

- Na comparação com todos, entra só a melhor marca por exercício, sem nome. Quem desligar "Entrar na comparação" sai da
  conta dos outros.
- Amigos veem o resumo dos treinos (nome do dia, séries, volume, duração, número de recordes) e os recordes. Dá para
  desligar.
- O backup completo é privado: só o dono acessa. **As fotos do corpo não vão no backup da nuvem**, a não ser que a
  pessoa ligue "Incluir fotos do corpo" na tela da conta. Restaurar um backup sem fotos não apaga as fotos do aparelho.
- Sexo e peso corporal (opcionais) nunca aparecem para ninguém: só entram no cálculo da porcentagem.

**Comparação mais justa**: quem informa sexo e/ou peso recebe, além da comparação geral, a posição entre pessoas do
mesmo sexo e de peso parecido (até 10% de diferença) e a **força relativa** (1RM estimada ÷ peso corporal). Cada uma
só aparece com pelo menos 5 outras pessoas na faixa.

**Bloquear e denunciar** (tela Amigos, em cada pessoa): bloquear desfaz a amizade e um não acha mais o outro; a
denúncia fica guardada para você ler (seção "Administração", abaixo). A política de privacidade está no app
(`#/privacidade`) e em `docs/privacidade.md`; publique esse texto numa página para apontar nas lojas.

**Apagar a conta** remove tudo do servidor. Isso é exigido pelas lojas de apps e atende à LGPD. Os dados do celular
continuam.

## 2. Onde está cada coisa

| Arquivo                                 | Papel                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `server/src/app.ts`                     | Todas as rotas (sem dependências): contas, amigos, recordes, feed, backup |
| `server/src/protocol.ts`                | Tipos e limites compartilhados entre app e servidor                       |
| `server/src/crypto.ts`                  | Hash de senha, tokens, código de recuperação                              |
| `server/src/worker.ts`                  | Entrada no Cloudflare Workers                                             |
| `server/src/node.ts` + `sqlite-node.ts` | Mesmo servidor no Node com SQLite embutido (teste local ou VPS)           |
| `server/migrations/*.sql`               | Tabelas (0001 base, 0002 treinos, 0003 erros, 0004 perfil e moderação)    |
| `server/wrangler.toml`                  | Configuração do Cloudflare                                                |
| `src/lib/online/client.ts`              | Endereço do servidor, token, `api()`                                      |
| `src/lib/online/sync.ts`                | O que sobe, quando sobe, cache local, restaurar backup                    |
| `src/lib/online/account.ts`             | Cadastro, login, recuperação, perfil, amigos, bloqueio e denúncia         |
| `src/lib/online/workouts.ts`            | Treino por treino entre aparelhos da mesma conta                          |
| `src/lib/errors.ts`                     | Registro de erros (no aparelho e, sem dados pessoais, no servidor)        |
| `src/screens/PrivacyPolicy.tsx`         | Política de privacidade no app (`#/privacidade`)                          |
| `src/screens/Online.tsx`                | Tela da conta (`#/online`)                                                |
| `src/screens/Friends.tsx`               | Tela de amigos (`#/amigos`)                                               |
| `src/components/CommunityCard.tsx`      | Comparação na página do exercício e módulo NET.06 no Progresso            |
| `src/components/OnlineStrip.tsx`        | Atalho de amigos e status na tela inicial                                 |

### Rotas da API

| Grupo     | Rotas                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Conta     | `POST /auth/register`, `/auth/login`, `/auth/recover`, `/auth/logout` · `GET/PATCH /me` · `POST /me/password` · `POST /me/delete` |
| Amigos    | `GET /users/search?q=` · `GET /friends` · `POST /friends/request`, `/friends/accept`, `/friends/remove`                           |
| Recordes  | `PUT /records` · `GET /records/percentiles?libs=` · `GET /records/friends?lib=` · `GET /users/:id/records`                        |
| Treinos   | `PUT /activity` · `GET /feed`                                                                                                     |
| Backup    | `GET /backups` · `PUT /backups` · `GET /backups/:id`                                                                              |
| Aparelhos | `GET /workouts?since=` · `PUT /workouts` (treino por treino)                                                                      |
| Perfil    | `PATCH /me` com `sex` e `bodyweightKg` · `POST /me/recovery-code`                                                                 |
| Moderação | `GET /blocks` · `POST /users/block`, `/users/unblock` · `POST /reports`                                                           |
| Erros     | `POST /errors` (sem login)                                                                                                        |
| Dono      | `GET /admin/errors` · `GET /admin/reports` · `POST /admin/users/delete` (cabeçalho `Authorization: Bearer <ADMIN_TOKEN>`)         |

### Administração (erros e denúncias)

As rotas `/admin/*` só abrem se o servidor tiver o segredo `ADMIN_TOKEN` (16+ caracteres). Sem ele, ficam fechadas.

```bash
cd server
npx wrangler secret put ADMIN_TOKEN
```

Depois, para ler (troque o endereço e o segredo):

```bash
curl -H "Authorization: Bearer SEU_SEGREDO" https://augment-api.SEU-SUBDOMINIO.workers.dev/admin/errors
curl -H "Authorization: Bearer SEU_SEGREDO" https://augment-api.SEU-SUBDOMINIO.workers.dev/admin/reports
```

Para remover uma conta denunciada, mande `POST /admin/users/delete` com `{ "userId": "..." }` (o `target` que
aparece na denúncia). No servidor Node, defina a variável de ambiente `ADMIN_TOKEN` antes de `npm run server`.

## 3. Hospedar o servidor (grátis, Cloudflare)

O plano gratuito do Cloudflare Workers + D1 cobre com folga um app desse tamanho. Ele não "dorme" como outros planos
grátis. Os limites eram estes em 2025; confira em cloudflare.com/plans:

- Workers: 100 mil requisições por dia.
- D1: 5 GB, 5 milhões de linhas lidas e 100 mil linhas escritas por dia.

**Uma vez só**, no computador:

1. Crie uma conta grátis em https://dash.cloudflare.com, sem cartão.
2. Entre na pasta do servidor e faça login. Este comando abre o navegador para autorizar:
   ```bash
   cd server
   ```
   ```bash
   npx wrangler login
   ```
3. Crie o banco:
   ```bash
   npx wrangler d1 create augment
   ```
   O comando mostra um `database_id`. Cole esse valor em `server/wrangler.toml`, no lugar de
   `COLOQUE-AQUI-O-ID-DO-D1`.
4. Crie as tabelas no banco de verdade:
   ```bash
   npx wrangler d1 migrations apply augment --remote
   ```
5. Publique (ainda dentro de `server`; na raiz do projeto o wrangler não acha a configuração e tenta publicar o app
   Vite, o que dá erro de versão do Vite):
   ```bash
   npx wrangler deploy
   ```
   O endereço aparece no fim, algo como `https://augment-api.SEU-SUBDOMINIO.workers.dev`.
6. Teste: abra `https://augment-api.SEU-SUBDOMINIO.workers.dev/health` no navegador. Deve mostrar `{"ok":true,...}`.

**Para atualizar o servidor depois**, rode na raiz do projeto:

```bash
npm run server:deploy
```

Sempre que houver arquivo novo em `server/migrations/` (hoje vão do `0001` ao `0004`), rode o passo 4 de novo
**antes** do deploy: ele aplica só as migrações que ainda faltam. O servidor Node aplica todas sozinho ao iniciar.

### Ligar o app ao servidor

O endereço entra no app na hora do build, pela variável `VITE_API_URL`:

1. No GitHub, abra o repositório e vá em **Settings → Secrets and variables → Actions → aba Variables → New
   repository variable**.
2. Nome: `AUGMENT_API_URL`. Valor: `https://augment-api.SEU-SUBDOMINIO.workers.dev`, sem barra no fim.
3. No próximo push na `main`, o site do GitHub Pages, o APK Android e o build iOS já saem com o online ligado.

Sem a variável, o app sai só offline e a tela de conta mostra "Servidor não configurado". Quem quiser também pode
colar um endereço em Conta online → Servidor; isso serve para servidores próprios.

**Restringir quem chama o servidor** (opcional): em `server/wrangler.toml`, preencha `ALLOWED_ORIGINS`, por exemplo
`"https://SEU-USUARIO.github.io,https://localhost,capacitor://localhost"`. Depois rode `npm run server:deploy` de
novo. Os dois últimos endereços são o app Android e o app iOS.

### Alternativa: servidor próprio (VPS, Render, Railway, um PC em casa)

O mesmo servidor roda no Node 22.5 ou mais novo, com SQLite num arquivo:

```bash
PORT=8787 DB_PATH=/dados/augment.db npm run server
```

Coloque um HTTPS na frente: Caddy, Nginx ou o proxy do próprio provedor. Faça backup do arquivo `augment.db`. Atrás
de um proxy, o IP de cada pessoa chega pelo `X-Forwarded-For`, que o servidor já usa no limite de cadastros.

## 4. Testar tudo no computador

1. Rode o servidor local (porta 8787, banco em `server/data/augment.db`):
   ```bash
   npm run server
   ```
2. Em outro terminal, rode o app (porta 5173):
   ```bash
   npm run dev
   ```
3. No app, vá em Ajustes → Conta online → Servidor, coloque `http://localhost:8787` e toque em "Salvar e testar".
   Depois crie a conta.

`npm run check` já roda os testes do servidor (`server/src/app.test.ts`, num SQLite em memória) e os testes do app
conversando com o servidor de verdade por um fetch simulado (`src/lib/online/sync.test.ts`).

## 5. Android, iPhone e outros aparelhos

O mesmo código web vira app nativo pelo **Capacitor**, que já estava no projeto.

| Plataforma                           | Como gerar                                                                                                                                                             | Custo                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Android (APK)**                    | O workflow `.github/workflows/android.yml` gera a cada push (Actions → Artifacts). Tag `v1.2.3` publica nas Releases. Local: `npm run build:android` + Android Studio. | Grátis. Google Play: US$ 25, uma vez.                                                   |
| **iPhone / iPad**                    | Projeto Xcode em `ios/`. O workflow `.github/workflows/ios.yml` compila num Mac do GitHub para o simulador e prova que o projeto está saudável.                        | Para instalar em iPhone de verdade ou publicar: conta Apple Developer (US$ 99 por ano). |
| **iPhone sem pagar**                 | Abra o site do GitHub Pages no Safari → Compartilhar → **Adicionar à Tela de Início**. Vira um app de tela cheia, offline, com o online funcionando.                   | Grátis.                                                                                 |
| **Qualquer navegador / PC / tablet** | O site do GitHub Pages (PWA instalável no Chrome e no Edge).                                                                                                           | Grátis.                                                                                 |

### iOS na App Store (quando quiser)

1. Assine o Apple Developer Program em https://developer.apple.com/programs/ e crie o App ID
   `io.github.igordevexe.augment`.
2. **Com um Mac**:
   - rode `npm run build:ios` e depois `npm run ios:open`;
   - no Xcode, em Signing & Capabilities, escolha o seu Team;
   - Product → Archive → Distribute App (TestFlight / App Store).
3. **Sem Mac**: dá para assinar no GitHub Actions. Exporte o certificado `.p12` e o provisioning profile, guarde em
   secrets e use `xcodebuild archive` + `-exportArchive` no `ios.yml`. Também dá para usar um serviço como o
   Codemagic, com plano grátis para apps pequenos.
4. A Apple exige uma política de privacidade (o que está na seção 1 serve de base) e a opção de apagar a conta. Essa
   opção já existe em Conta online → Apagar conta online.

Ícone e tela de abertura do iOS: `python scripts/ios-assets.py <icone-1024.png>`. O PNG sai de `public/icon.svg`
renderizado em 1024 px.

## 6. Custos resumidos

| Item                                             | Custo                |
| ------------------------------------------------ | -------------------- |
| Servidor (Cloudflare Workers + D1)               | R$ 0 no plano grátis |
| Site/PWA (GitHub Pages)                          | R$ 0                 |
| APK Android direto (sem loja)                    | R$ 0                 |
| Google Play                                      | US$ 25, uma vez      |
| App Store                                        | US$ 99 por ano       |
| Domínio próprio (opcional, ex.: api.augment.app) | ~R$ 40–80 por ano    |
