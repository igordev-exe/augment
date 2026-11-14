import { describe, expect, it } from "vitest";
import { readDuration, readLoad, readNumber, readPeriod, readUnit, findPeriod } from "./readers";

// 30+ frases por leitor, do jeito que se digita no celular.

describe("AUG.CORE — leitores de campo", () => {
  it("número: algarismo, vírgula e por extenso até 999", () => {
    const cases: [string, number | undefined][] = [
      ["80", 80],
      ["82,4", 82.4],
      ["82.5", 82.5],
      ["0", 0],
      ["999", 999],
      ["um", 1],
      ["uma", 1],
      ["dois", 2],
      ["duas", 2],
      ["tres", 3],
      ["três", 3],
      ["dez", 10],
      ["quinze", 15],
      ["dezenove", 19],
      ["vinte", 20],
      ["vinte e cinco", 25],
      ["oitenta", 80],
      ["oitenta e dois", 82],
      ["noventa e nove", 99],
      ["cem", 100],
      ["cento e vinte", 120],
      ["cento e vinte e cinco", 125],
      ["duzentos e vinte e cinco", 225],
      ["trezentas", 300],
      ["novecentos e noventa e nove", 999],
      ["meia", 0.5],
      ["meio", 0.5],
      ["dois e meio", 2.5],
      ["um e meio", 1.5],
      ["oitenta e dois e meio", 82.5],
      ["80 e meio", 80.5],
      ["cem e vinte", undefined],
      ["vinte cinco", undefined],
      ["oitenta e", undefined],
      ["supino", undefined],
      ["", undefined],
      ["e meio", undefined],
      ["vinte e quinze", undefined],
    ];
    for (const [t, v] of cases) expect(readNumber(t), t).toBe(v);
  });

  it("unidade e carga", () => {
    const units: [string, string | undefined][] = [
      ["kg", "kg"],
      ["quilos", "kg"],
      ["kilos", "kg"],
      ["Quilo", "kg"],
      ["kgs", "kg"],
      ["lb", "lb"],
      ["lbs", "lb"],
      ["libras", "lb"],
      ["libra", "lb"],
      ["metros", undefined],
    ];
    for (const [t, v] of units) expect(readUnit(t), t).toBe(v);
    const loads: [string, number | undefined, string | undefined][] = [
      ["80", 80, undefined],
      ["80kg", 80, "kg"],
      ["80 kg", 80, "kg"],
      ["82,5 quilos", 82.5, "kg"],
      ["cem libras", 100, "lb"],
      ["225lb", 225, "lb"],
      ["225 lbs", 225, "lb"],
      ["oitenta quilos", 80, "kg"],
      ["vinte e dois e meio", 22.5, undefined],
      ["87.5", 87.5, undefined],
      ["100 kilos", 100, "kg"],
      ["60 de kg", 60, "kg"],
      ["muito peso", undefined, undefined],
      ["80 metros", undefined, undefined],
    ];
    for (const [t, v, u] of loads) {
      const r = readLoad(t);
      expect(r?.value, t).toBe(v);
      if (v != null) expect(r?.unit, t).toBe(u);
    }
  });

  it("duração em segundos", () => {
    const cases: [string, number | undefined][] = [
      ["90 segundos", 90],
      ["90s", 90],
      ["90 s", 90],
      ["90 seg", 90],
      ["90", 90],
      ["2 min", 120],
      ["2min", 120],
      ["2 minutos", 120],
      ["dois minutos", 120],
      ["um minuto", 60],
      ["um minuto e meio", 90],
      ["1 minuto e meio", 90],
      ["1 min e meio", 90],
      ["1,5 minutos", 90],
      ["1:30", 90],
      ["2:00", 120],
      ["2 minutos e 30 segundos", 150],
      ["dois minutos e trinta segundos", 150],
      ["meio minuto", 30],
      ["trinta segundos", 30],
      ["quarenta e cinco segundos", 45],
      ["3 minutos", 180],
      ["tres minutos", 180],
      ["cinco minutos", 300],
      ["45", 45],
      ["sessenta segundos", 60],
      ["120 segundos", 120],
      ["4 mins", 240],
      ["2", undefined],
      ["muito tempo", undefined],
      ["um tempo", undefined],
    ];
    for (const [t, v] of cases) expect(readDuration(t), t).toBe(v);
  });

  it("período, com hoje = quinta 21/10/2026", () => {
    const o = { today: "2026-10-21", mesoStart: "2026-09-07" };
    const cases: [string, string | undefined, string?, string?][] = [
      ["hoje", "hoje", "2026-10-21", "2026-10-21"],
      ["ontem", "ontem", "2026-10-20", "2026-10-20"],
      ["essa semana", "semana", "2026-10-19", "2026-10-21"],
      ["esta semana", "semana", "2026-10-19"],
      ["nessa semana", "semana", "2026-10-19"],
      ["na semana", "semana", "2026-10-19"],
      ["semana passada", "semana-passada", "2026-10-12", "2026-10-18"],
      ["na semana passada", "semana-passada", "2026-10-12"],
      ["esse mes", "mes", "2026-10-01", "2026-10-21"],
      ["este mês", "mes", "2026-10-01"],
      ["no mes", "mes", "2026-10-01"],
      ["mes passado", "mes-passado", "2026-09-01", "2026-09-30"],
      ["no mês passado", "mes-passado", "2026-09-01"],
      ["em outubro", "mes-nome", "2026-10-01", "2026-10-21"],
      ["de setembro", "mes-nome", "2026-09-01", "2026-09-30"],
      ["setembro", "mes-nome", "2026-09-01"],
      ["em dezembro", "mes-nome", "2025-12-01", "2025-12-31"],
      ["em março", "mes-nome", "2026-03-01", "2026-03-31"],
      ["no mes de agosto", "mes-nome", "2026-08-01"],
      ["ultimos 30 dias", "ultimos", "2026-09-22", "2026-10-21"],
      ["nos últimos 7 dias", "ultimos", "2026-10-15"],
      ["ultimas 2 semanas", "ultimos", "2026-10-08"],
      ["ultimos tres meses", "ultimos", "2026-07-24"],
      ["esse ciclo", "ciclo", "2026-09-07", "2026-10-21"],
      ["neste ciclo", "ciclo", "2026-09-07"],
      ["no meso", "ciclo", "2026-09-07"],
      ["esse ano", "ano", "2026-01-01", "2026-10-21"],
      ["neste ano", "ano", "2026-01-01"],
      ["do ano", "ano", "2026-01-01"],
      ["ano passado", "ano-passado", "2025-01-01", "2025-12-31"],
      ["de todos os tempos", "sempre"],
      ["desde o inicio", "sempre"],
      ["amanha", undefined],
      ["supino", undefined],
    ];
    for (const [t, key, from, to] of cases) {
      const p = readPeriod(t, o);
      expect(p?.key, t).toBe(key);
      if (from) expect(p?.from, t).toBe(from);
      if (to) expect(p?.to, t).toBe(to);
    }
    expect(findPeriod("quantas series de peito fiz em outubro", o)?.key).toBe("mes-nome");
    expect(findPeriod("meu supino subiu esse mes?", o)?.key).toBe("mes");
    expect(findPeriod("quanto tempo treinei essa semana", o)?.key).toBe("semana");
  });
});
