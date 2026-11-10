// Servidor no Node: para testar no computador e para hospedar num VPS/Render sem Cloudflare.
//   npm run server            (porta 8787, banco em server/data/augment.db)
//   PORT=9000 DB_PATH=/dados/augment.db npm run server
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "./app";
import { openSqlite } from "./sqlite-node";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.DB_PATH ?? resolve(here, "../data/augment.db"));
mkdirSync(dirname(dbPath), { recursive: true });
const env = {
  DB: openSqlite(dbPath, resolve(here, "../migrations")),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
};
const port = Number(process.env.PORT ?? 8787);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  // Sem proxy na frente, o IP do cliente vem da conexão (o limite de cadastros é por IP).
  if (!headers.has("x-forwarded-for") && req.socket.remoteAddress) headers.set("x-forwarded-for", req.socket.remoteAddress);
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0;
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
  const response = await handle(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => {
  console.log(`AUGMENT servidor em http://localhost:${port} (banco: ${dbPath})`);
});
