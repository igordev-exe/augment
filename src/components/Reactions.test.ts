import { describe, expect, it } from "vitest";
import { REACTIONS } from "../../server/src/protocol";
import { REACTION_ART, REACTION_LABEL } from "./Reactions";

describe("emojis de reação", () => {
  it("cada emoji do contrato tem desenho 12×12 com cores conhecidas e um nome", () => {
    for (const id of REACTIONS) {
      const art = REACTION_ART[id];
      expect(art, id).toHaveLength(12);
      for (const row of art) {
        expect(row, `${id}: "${row}"`).toHaveLength(12);
        expect(row, id).toMatch(/^[.cmywv]+$/);
      }
      expect(REACTION_LABEL[id], id).toBeTruthy();
    }
  });

  it("8 emojis: o seletor fecha numa grade exata de 4 × 2 (sem item sobrando)", () => {
    expect(REACTIONS.length % 4).toBe(0);
  });
});
