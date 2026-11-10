// Povoa o servidor local com 10 usuários fictícios (recordes, treinos) para testar a comparação e os amigos.
const API = process.argv[2] ?? "http://localhost:8787";
const LIBS = [
  "supino-inclinado-smith",
  "supino-reto-maquina",
  "puxada-aberta",
  "remada-apoio-peito",
  "hack",
  "leg-press-profundo",
  "cadeira-extensora",
  "triceps-corda",
  "elevacao-lateral-cabo",
  "terra-romeno",
];
const today = new Date().toISOString().slice(0, 10);
async function call(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}
const names = [
  "Lara Souza",
  "Pedro Lima",
  "Joana Reis",
  "Marcos Dias",
  "Bia Ramos",
  "Rafa Costa",
  "Duda Melo",
  "Caio Neves",
  "Nina Alves",
  "Theo Pinto",
];
const tokens = [];
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const [i, name] of names.entries()) {
  const username = name.toLowerCase().split(" ")[0] + (i + 1);
  let r = await call("POST", "/auth/register", { username, password: "senha-teste-123", displayName: name });
  if (!r.token) r = await call("POST", "/auth/login", { username, password: "senha-teste-123" });
  tokens.push({ username, token: r.token, name });
  const records = LIBS.map((lib) => {
    const load = Math.round((30 + rnd() * 90) / 2.5) * 2.5;
    const reps = 6 + Math.floor(rnd() * 6);
    return { lib, loadKg: load, e1rmKg: Math.round(load * (1 + reps / 30) * 10) / 10, reps, date: today };
  });
  await call("PUT", "/records", { records }, r.token);
  // Sexo e peso, para a comparação por faixa e a força relativa terem com quem comparar.
  await call("PATCH", "/me", { sex: i % 2 ? "m" : "f", bodyweightKg: i % 2 ? 74 + i : 56 + i }, r.token);
  await call(
    "PUT",
    "/activity",
    {
      activity: [
        {
          id: `seed-${i}`,
          date: today,
          title: ["Push A", "Pull A", "Legs A"][i % 3],
          sets: 16 + (i % 6),
          volumeKg: 4200 + i * 310,
          minutes: 50 + i * 2,
          prs: i % 3,
        },
      ],
    },
    r.token,
  );
}
console.log(tokens.map((t) => t.username).join(", "));
