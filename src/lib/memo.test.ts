import { describe, expect, it } from "vitest";
import { pplProgram } from "../data/templates/ppl";
import { setActiveProgram } from "../data/program";
import { memoByArgs, minuteNow } from "./memo";

describe("memoByArgs", () => {
  it("mesma identidade dos argumentos = mesma conta guardada; objeto novo = conta nova", () => {
    let runs = 0;
    const f = memoByArgs((xs: number[], k: number) => {
      runs++;
      return xs.map((x) => x * k);
    });
    const a = [1, 2, 3];
    const r1 = f(a, 2);
    expect(f(a, 2)).toBe(r1);
    expect(runs).toBe(1);
    f([1, 2, 3], 2);
    expect(runs).toBe(2);
    f(a, 3);
    expect(runs).toBe(3);
    expect(f(a, 2)).toBe(r1); // ainda no cache (guarda as 3 últimas)
  });

  it("trocar o programa ativo invalida o cache", () => {
    let runs = 0;
    const f = memoByArgs((x: object) => (runs++, { x }));
    const a = {};
    f(a);
    setActiveProgram(pplProgram());
    f(a);
    expect(runs).toBe(2);
  });

  it("minuteNow arredonda para o minuto", () => {
    expect(minuteNow(125_000)).toBe(120_000);
  });
});
