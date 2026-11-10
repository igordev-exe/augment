import { describe, expect, it } from "vitest";
import { cleanStack, describeError } from "./errors";

describe("registro de erros", () => {
  it("tira endereço e parâmetros da pilha e limita o tamanho", () => {
    const s = cleanStack(
      "TypeError: x\n    at Foo (https://igor.github.io/augment/assets/index-abc.js?v=9:10:5)\n" + "    at y\n".repeat(40),
    );
    expect(s).toContain("at Foo (assets/index-abc.js:10:5)");
    expect(s).not.toContain("github.io");
    expect(s.split("\n").length).toBeLessThanOrEqual(12);
  });

  it("descreve erro e não-erro", () => {
    expect(describeError(new RangeError("fora")).message).toBe("RangeError: fora");
    expect(describeError("texto solto")).toEqual({ message: "texto solto", stack: "" });
  });
});
