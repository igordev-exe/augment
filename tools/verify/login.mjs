// Entra (ou cria) a conta de teste no servidor local, para as ferramentas medirem e fotografarem as telas logadas.
// Usado por audit.mjs e shots.mjs com AUDIT_API=http://localhost:8787 (rode antes `npm run server` e seed-server.mjs).
// Devolve o corpo de uma função async para rodar na página (ela já tem os módulos do app pelo Vite).
export function loginScript(api, user = process.env.AUDIT_USER ?? "auditoria", pass = process.env.AUDIT_PASS ?? "senha-teste-123") {
  return `
    const C = await import("/src/lib/online/client.ts");
    const A = await import("/src/lib/online/account.ts");
    const S = await import("/src/lib/online/sync.ts");
    C.setApiUrl(${JSON.stringify(api)});
    try { await A.login(${JSON.stringify(user)}, ${JSON.stringify(pass)}); }
    catch { await A.register({ username: ${JSON.stringify(user)}, password: ${JSON.stringify(pass)}, displayName: "Auditoria", sharePercentiles: true, shareActivity: true }); }
    await S.syncIdle();
    await A.updateProfile({ sex: "m", bodyweightKg: 80 });
    await S.syncIdle();
    // Usuários do seed-server: dois viram amigos (eles aceitam) e um deixa um pedido esperando.
    const api = ${JSON.stringify(api)};
    const me = (await S.loadOnline()).user;
    const as = async (name, path, body) => {
      const post = (p, b, token) => fetch(api + p, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(b) }).then((r) => r.json());
      const { token } = await post("/auth/login", { username: name, password: "senha-teste-123" });
      if (token) await post(path, body, token);
    };
    for (const name of ["lara1", "joana3"]) {
      await A.requestFriend(name).catch(() => {});
      await as(name, "/friends/accept", { userId: me.id }).catch(() => {});
    }
    await as("pedro2", "/friends/request", { username: me.username }).catch(() => {});
    const st = await S.syncNow("manual");
    return (st && st.user ? st.user.username : "falhou") + " " + (st && st.lastError ? st.lastError : "ok");
  `;
}
