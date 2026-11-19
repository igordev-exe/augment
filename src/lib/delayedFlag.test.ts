import { describe, expect, it } from "vitest";
import { delayedFlagVisible } from "./delayedFlag";

describe("indicador de carregando atrasado (F3)", () => {
  it("resposta rápida (< 200 ms) nunca mostra o indicador", () => {
    for (const now of [0, 50, 150, 199, 400]) expect(delayedFlagVisible(0, 150, now)).toBe(false);
  });
  it("espera longa mostra depois de 200 ms", () => {
    expect(delayedFlagVisible(0, null, 199)).toBe(false);
    expect(delayedFlagVisible(0, null, 200)).toBe(true);
    expect(delayedFlagVisible(0, null, 5000)).toBe(true);
  });
  it("se apareceu, fica pelo menos 300 ms", () => {
    // Apareceu aos 200 e a resposta chegou aos 250: fica até 500.
    expect(delayedFlagVisible(0, 250, 300)).toBe(true);
    expect(delayedFlagVisible(0, 250, 499)).toBe(true);
    expect(delayedFlagVisible(0, 250, 500)).toBe(false);
    // Resposta aos 900: some aos 900.
    expect(delayedFlagVisible(0, 900, 899)).toBe(true);
    expect(delayedFlagVisible(0, 900, 900)).toBe(false);
  });
});
