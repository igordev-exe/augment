import { describe, expect, it } from "vitest";
import { exOf } from "../data/program";
import { historyOf, recordsOf } from "./progression";
import { importWorkoutsCsv, matchLibrary, parseCsv, parseDateTime } from "./importcsv";

// M14: importar histórico do Hevy e do Strong (CSV).

const HEVY = `"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
"Push A","16 Jan 2024, 14:57","16 Jan 2024, 16:02","","Bench Press (Barbell)","","boa","0","warmup","40","10","","",""
"Push A","16 Jan 2024, 14:57","16 Jan 2024, 16:02","","Bench Press (Barbell)","","","1","normal","80","8","","",""
"Push A","16 Jan 2024, 14:57","16 Jan 2024, 16:02","","Bench Press (Barbell)","","","2","failure","80","7","","",""
"Push A","16 Jan 2024, 14:57","16 Jan 2024, 16:02","","Lateral Raise (Dumbbell)","","","0","normal","10","15","","",""
"Push A","16 Jan 2024, 14:57","16 Jan 2024, 16:02","","Treadmill","","","0","normal","","","2.5","900",""
"Push A","16 Jan 2024, 14:57","16 Jan 2024, 16:02","","Exercício Inventado XYZ","","","0","normal","20","12","","",""
"Legs","18 Jan 2024, 18:00","18 Jan 2024, 19:10","","Squat (Barbell)","","","0","normal","100","5","","",""
`;

const STRONG = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2023-01-05 18:30:12;Upper;1h 5m;Lat Pulldown (Cable);1;60;10;0;0;;;
2023-01-05 18:30:12;Upper;1h 5m;Lat Pulldown (Cable);2;60;9;0;0;;;
2023-01-05 18:30:12;Upper;1h 5m;Bicep Curl (Dumbbell);W;8;15;0;0;;;
2023-01-07 09:00:00;Upper;45m;Lat Pulldown (Cable);1;62,5;10;0;0;;;
`;

describe("CSV e datas", () => {
  it("lê aspas, vírgula e ponto e vírgula", () => {
    expect(parseCsv('a,"b, c",d\n1,"2 ""x""",3')).toEqual([
      ["a", "b, c", "d"],
      ["1", '2 "x"', "3"],
    ]);
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("datas do Hevy e do Strong viram hora local", () => {
    expect(parseDateTime("16 Jan 2024, 14:57")?.getHours()).toBe(14);
    expect(parseDateTime("2023-01-05 18:30:12")?.getDate()).toBe(5);
    expect(parseDateTime("ontem")).toBeNull();
  });
});

describe("Hevy", () => {
  const r = importWorkoutsCsv(HEVY)!;
  it("detecta o formato, agrupa em treinos e pula cardio", () => {
    expect(r.source).toBe("hevy");
    expect(r.sessions).toHaveLength(2);
    expect(r.skipped).toBe(1);
    const push = r.sessions[0];
    expect(push.date).toBe("2024-01-16");
    expect(push.day?.name).toBe("Push A");
    expect(push.week).toBe(0);
    expect(push.finishedAt! - push.startedAt).toBe(65 * 60_000);
  });
  it("aquecimento, falha e unidade vêm do arquivo", () => {
    const bench = r.sessions[0].exercises[0];
    expect(bench.unit).toBe("kg");
    expect(bench.sets.map((s) => s.kind)).toEqual(["warmup", "work", "work"]);
    expect(bench.sets[2].failure).toBe(true);
  });
  it("reconhece exercícios da biblioteca e cria os outros como próprios", () => {
    expect(r.matched.has("Bench Press (Barbell)")).toBe(true);
    expect(r.matched.has("Lateral Raise (Dumbbell)")).toBe(true);
    expect(r.unmatched).toEqual(["Exercício Inventado XYZ"]);
    const custom = r.sessions[0].exercises.find((e) => e.snap?.name === "Exercício Inventado XYZ")!;
    expect(custom.snap?.lib.startsWith("custom-")).toBe(true);
  });
  it("o histórico importado funciona sem o exercício estar no programa (retrato)", () => {
    const bench = r.sessions[0].exercises[0];
    expect(exOf(bench)?.lib).toBe(bench.snap?.lib);
    const hist = historyOf(r.sessions, bench.exId);
    expect(recordsOf(hist).bestE1rm?.weight).toBe(80);
  });
  it("importar de novo dá os mesmos ids (não duplica)", () => {
    expect(importWorkoutsCsv(HEVY)!.sessions.map((s) => s.id)).toEqual(r.sessions.map((s) => s.id));
  });
});

describe("Strong", () => {
  it("lê ponto e vírgula, decimal com vírgula, W de aquecimento e a unidade escolhida", () => {
    const r = importWorkoutsCsv(STRONG, "lb")!;
    expect(r.source).toBe("strong");
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0].finishedAt! - r.sessions[0].startedAt).toBe(65 * 60_000);
    expect(r.sessions[1].exercises[0].sets[0].weight).toBe(62.5);
    expect(r.sessions[0].exercises[0].unit).toBe("lb");
    expect(r.sessions[0].exercises[1].sets[0].kind).toBe("warmup");
    expect(r.matched.has("Lat Pulldown (Cable)")).toBe(true);
  });
  it("arquivo de outro formato não é importado", () => {
    expect(importWorkoutsCsv("a,b\n1,2")).toBeNull();
  });
});

describe("casar errado é pior que não casar", () => {
  it("terra com barra não vira terra no cabo nem stiff (a biblioteca não tem o terra convencional)", () => {
    expect(matchLibrary("Deadlift (Barbell)")).toBeNull();
  });
  it("supino reto não vira guilhotina; inclinado com halteres vai para o curado, não para a pegada martelo", () => {
    expect(matchLibrary("Bench Press (Barbell)")?.name).not.toMatch(/guilhotina/i);
    expect(matchLibrary("Incline Bench Press (Dumbbell)")?.lib).toBe("supino-inclinado-halteres");
    expect(matchLibrary("Hammer Curl (Dumbbell)")?.name).toMatch(/martelo/i);
  });
  it("variações e qualificadores não viram o exercício errado", () => {
    expect(matchLibrary("Chest Fly (Machine)")?.lib).not.toBe("supino-reto-maquina");
    expect(matchLibrary("Pull Up")?.name ?? "").not.toMatch(/elástico|escapular/i);
    expect(matchLibrary("Calf Raise (Machine)")?.name ?? "").not.toMatch(/burrinho|smith/i);
    expect(matchLibrary("Crunch")?.name ?? "").not.toMatch(/grupado|corda/i);
    expect(matchLibrary("Hammer Curl (Dumbbell)")?.name).not.toMatch(/scott/i);
  });
});

describe("nomes comuns batem com a biblioteca", () => {
  it.each([
    "Bench Press (Barbell)",
    "Incline Bench Press (Dumbbell)",
    "Squat (Barbell)",
    "Lat Pulldown (Cable)",
    "Seated Cable Row",
    "Leg Press",
    "Leg Extension (Machine)",
    "Lying Leg Curl (Machine)",
    "Lateral Raise (Dumbbell)",
    "Triceps Pushdown (Cable - Straight Bar)",
    "Bicep Curl (Barbell)",
    "Hammer Curl (Dumbbell)",
    "Overhead Press (Barbell)",
  ])("%s", (name) => {
    expect(matchLibrary(name), name).not.toBeNull();
  });
});
