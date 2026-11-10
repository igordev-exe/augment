// Dados de demonstração determinísticos (mesmos nas duas versões).
localStorage.clear();
const P = await import("/src/data/program.ts");
const D = await import("/src/lib/db.ts");
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const days = P.PROGRAM ?? P.programDays();
const sessions = [];
const start = new Date("2026-09-21T12:00:00");
let k = 0;
for (let d = new Date(start); d < new Date("2026-11-05T12:00:00"); d.setDate(d.getDate() + 1)) {
  const wd = d.getDay();
  if (wd === 0 || wd === 6) continue;
  if (rnd() < 0.12) continue;
  const day = days[k % days.length];
  k++;
  const iso = d.toISOString().slice(0, 10);
  const wk = Math.floor((d - start) / (7 * 864e5)) + 1;
  sessions.push({
    id: "demo" + iso,
    dayId: day.id,
    date: iso,
    week: Math.min(wk, 7),
    status: "done",
    startedAt: +d,
    finishedAt: +d + 3600e3,
    checkin: { sleep: ["ruim", "ok", "bom"][k % 3], energy: "ok", pain: "nenhuma" },
    exercises: day.exercises.map((ex, i) => ({
      exId: ex.id,
      unit: "kg",
      feedback: { pump: "bom", volume: "ok", joint: "ok" },
      sets: Array.from({ length: 3 }, (_, j) => ({
        id: "s" + iso + i + j,
        kind: "work",
        weight: 40 + i * 7.5 + wk * 2.5,
        reps: 8 + ((j + wk) % 4),
        done: true,
        rir: (j + i) % 5,
      })),
    })),
  });
}
const body = [];
for (let i = 0; i < 60; i++) {
  const d = new Date("2026-09-05T12:00:00");
  d.setDate(d.getDate() + i);
  body.push({ id: "b" + i, date: d.toISOString().slice(0, 10), weightKg: +(95.5 - i * 0.05 + Math.sin(i) * 0.4).toFixed(1) });
}
const settings = await D.loadSettings();
await D.importBackup(
  {
    app: "augment",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      ...settings,
      bodyGoal: { mode: "perder", targetKg: 86 },
      lastBackupAt: "2026-10-10",
      backupDismissed: undefined,
      reportSeen: undefined,
    },
    sessions,
    bodyLog: body,
  },
  "replace",
  { snapshot: false },
);
sessions.length;
