import { describe, expect, it } from "vitest";
import type { Session, SetEntry } from "../data/types";
import { finishLogLines, hudSegments } from "./hud";

const set = (id: string, kind: SetEntry["kind"], done: boolean): SetEntry => ({ id, kind, weight: 50, reps: 10, done });

const session: Session = {
  id: "s",
  dayId: "push-a",
  date: "2026-11-04",
  week: 3,
  startedAt: 0,
  status: "active",
  exercises: [
    { exId: "a", unit: "kg", sets: [set("w", "warmup", true), set("a1", "work", true), set("a2", "work", true), set("a3", "drop", false)] },
    { exId: "b", unit: "kg", sets: [set("b1", "work", false), set("b2", "work", false)] },
  ],
};

describe("HUD do treino", () => {
  it("uma casa por série de trabalho, sem aquecimento; a primeira que falta é a próxima", () => {
    const segs = hudSegments(session);
    expect(segs.map((s) => s.setId)).toEqual(["a1", "a2", "a3", "b1", "b2"]);
    expect(segs.map((s) => s.state)).toEqual(["done", "done", "next", "todo", "todo"]);
    expect(segs.find((s) => s.setId === "a3")?.drop).toBe(true);
    expect(segs.filter((s) => s.first).map((s) => s.setId)).toEqual(["a1", "b1"]);
  });

  it("log de fim de treino: completo, recordes, o que sobe e o backup", () => {
    const lines = finishLogLines({
      dayCode: "PA",
      dayName: "Push A",
      setsDone: 24,
      setsPlanned: 24,
      volumeKg: 12460,
      minutes: 74,
      prs: 2,
      up: ["Supino", "Crucifixo", "Lateral", "Tríceps"],
      same: 2,
      down: 1,
      backupAt: "2026-11-04",
      today: "2026-11-04",
    });
    expect(lines[0]).toBe("//PROTOCOLO_PA :: PUSH A");
    expect(lines.find((l) => l.startsWith("//SÉRIES"))).toMatch(/24\/24 COMPLETO$/);
    expect(lines.find((l) => l.startsWith("//VOLUME"))).toMatch(/12,5 t$/);
    expect(lines.find((l) => l.startsWith("//RECORDES"))).toMatch(/2 NOVOS$/);
    expect(lines.filter((l) => l.includes("↑"))).toEqual(["//  ↑ Supino", "//  ↑ Crucifixo", "//  ↑ Lateral", "//  ↑ +1"]);
    expect(lines.find((l) => l.startsWith("//BACKUP"))).toMatch(/OK$/);
    expect(lines[lines.length - 1]).toBe("//UPLOAD_COMPLETO");
  });

  it("log: parcial e backup pendente", () => {
    const lines = finishLogLines({
      dayCode: "LA",
      dayName: "Lower A",
      setsDone: 10,
      setsPlanned: 20,
      volumeKg: 0,
      minutes: 30,
      prs: 0,
      up: [],
      same: 0,
      down: 0,
      today: "2026-11-04",
    });
    expect(lines.join("\n")).toContain("10/20 PARCIAL");
    expect(lines.join("\n")).toContain("MANTÉM CARGAS");
    expect(lines.find((l) => l.startsWith("//BACKUP"))).toMatch(/PENDENTE$/);
  });
});
