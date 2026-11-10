// Entrada no Cloudflare Workers (produção). O banco D1 chega como `env.DB` (ligado no wrangler.toml).
import { handle } from "./app";
import type { Env } from "./db";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
