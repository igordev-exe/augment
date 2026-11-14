import { describe, expect, it } from "vitest";
import type { Settings } from "../../data/types";
import { DEFAULT_SETTINGS } from "../db";
import { backtest, simulateLiveOperator, type BacktestResult } from "./backtest";
import { simulateOperator } from "./operator";

// Fase 0 do núcleo ao vivo: o motor prevê só com o passado e compara com o que aconteceu.
// Toda fase seguinte só entra se não piorar estes números; as fases 1 e 4 precisam melhorar o delas.
//
// Linha de base (14/11/2026, predictor "base" = o app antes da fase 1) e depois das fases 1–4, erro médio em reps:
//   operador      1ª base  1ª sem leitura (f4)  1ª vivo (f3+f4)  2+ base  2+ vivo (f1)  carga ±1 passo
//   sim-1         3,36     1,89                 1,89             3,36     0,04          64% = 64%
//   sim-7         3,36     1,89                 1,89             3,36     0,25          64% = 64%
//   vivo-queda0   3,00     1,01                 0,97             2,81     0,45          100% = 100%
//   vivo-queda1   3,97     1,41                 1,22             2,98     0,45          100% = 100%
//   vivo-queda2   4,36     1,65                 1,41             2,85     0,43          100% = 100%
//   backup real   1,33     —                    1,33             1,38     1,00          67% = 67%  (3 treinos)

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, mesoStart: "2026-09-07", trainingDays: [1, 2, 3, 4, 5] };

export const OPERATORS = {
  "sim-1": () =>
    simulateOperator({
      seed: 1,
      weeks: 6,
      startDate: "2026-09-07",
      trainingDays: [1, 2, 3, 4, 5],
      preferredHour: 7,
      trueRestRatio: 1,
      trueMuscleRecovery: { quadriceps: 1.3, peito: 0.8 },
    }),
  "sim-7": () =>
    simulateOperator({
      seed: 7,
      weeks: 6,
      startDate: "2026-09-07",
      trainingDays: [1, 2, 3, 4, 5],
      preferredHour: 7,
      trueRestRatio: 0.5,
      trueMuscleRecovery: { quadriceps: 1.3, peito: 0.8 },
    }),
  "vivo-queda0": () => simulateLiveOperator({ seed: 3, weeks: 10, startDate: "2026-06-01", trueDrop: 0.3, habitRir: 1, dayNoise: 1 }),
  "vivo-queda1": () => simulateLiveOperator({ seed: 5, weeks: 10, startDate: "2026-06-01", trueDrop: 1.2, habitRir: 2, dayNoise: 1.5 }),
  "vivo-queda2": () => simulateLiveOperator({ seed: 9, weeks: 10, startDate: "2026-06-01", trueDrop: 2.2, habitRir: 1, dayNoise: 2 }),
};

/** Números do predictor "base" (o app antes da fase 1), guardados como linha de base. */
const BASELINE: Record<keyof typeof OPERATORS, Pick<BacktestResult, "firstMae" | "laterMae" | "loadHitRate">> = {
  "sim-1": { firstMae: 3.36, laterMae: 3.36, loadHitRate: 0.64 },
  "sim-7": { firstMae: 3.36, laterMae: 3.36, loadHitRate: 0.64 },
  "vivo-queda0": { firstMae: 3, laterMae: 2.81, loadHitRate: 1 },
  "vivo-queda1": { firstMae: 3.97, laterMae: 2.98, loadHitRate: 1 },
  "vivo-queda2": { firstMae: 4.36, laterMae: 2.85, loadHitRate: 1 },
};

describe("backtest do núcleo ao vivo", () => {
  const rows = Object.entries(OPERATORS).map(([name, make]) => {
    const sessions = make();
    return {
      name: name as keyof typeof OPERATORS,
      base: backtest(sessions, SETTINGS, "base"),
      live: backtest(sessions, SETTINGS, "live"),
      noForm: backtest(sessions, SETTINGS, "live", { form: false }),
    };
  });

  it("imprime a tabela", () => {
    console.table(
      rows.map((r) => ({
        operador: r.name,
        "1ª base": r.base.firstMae,
        "1ª sem leitura": r.noForm.firstMae,
        "1ª vivo": r.live.firstMae,
        "2+ base": r.base.laterMae,
        "2+ vivo": r.live.laterMae,
        "carga base": r.base.loadHitRate,
        "carga vivo": r.live.loadHitRate,
        séries: r.live.firstSets + r.live.laterSets,
      })),
    );
  });

  it("a linha de base não mudou (o predictor 'base' é o app antes da fase 1)", () => {
    for (const r of rows) {
      const b = BASELINE[r.name];
      expect(r.base.firstMae).toBeCloseTo(b.firstMae, 2);
      expect(r.base.laterMae).toBeCloseTo(b.laterMae, 2);
      expect(r.base.loadHitRate).toBeCloseTo(b.loadHitRate, 2);
    }
  });

  it("fase 1: não piora a 1ª série nem a carga, e melhora as séries 2+ no conjunto", () => {
    let base = 0;
    let live = 0;
    for (const r of rows) {
      expect(r.live.firstMae).toBeLessThanOrEqual(BASELINE[r.name].firstMae + 1e-9);
      expect(r.live.loadHitRate).toBeGreaterThanOrEqual(BASELINE[r.name].loadHitRate - 1e-9);
      expect(r.live.laterMae).toBeLessThanOrEqual(BASELINE[r.name].laterMae + 0.05);
      base += BASELINE[r.name].laterMae;
      live += r.live.laterMae;
    }
    expect(live).toBeLessThan(base);
  });

  it("fases 3 e 4: a 1ª série melhora em todos, e a leitura do dia não piora", () => {
    for (const r of rows) {
      expect(r.live.firstMae).toBeLessThan(BASELINE[r.name].firstMae);
      expect(r.live.firstMae).toBeLessThanOrEqual(r.noForm.firstMae + 0.02);
    }
  });

  it("é determinístico", () => {
    const s = OPERATORS["vivo-queda1"]();
    expect(backtest(s, SETTINGS, "live")).toEqual(backtest(OPERATORS["vivo-queda1"](), SETTINGS, "live"));
  });
});
