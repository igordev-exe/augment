import { describe, expect, it } from "vitest";
import { BOOT_MODULES, bootModeFor, RING_SEGMENTS, WORDMARK_LETTERS } from "./brand";

describe("marca e boot", () => {
  it("boot completo na primeira abertura do dia, curto nas outras, nenhum com reduzir movimento", () => {
    expect(bootModeFor(null, "2026-11-09", false)).toBe("full");
    expect(bootModeFor("2026-11-08", "2026-11-09", false)).toBe("full");
    expect(bootModeFor("2026-11-09", "2026-11-09", false)).toBe("short");
    expect(bootModeFor(null, "2026-11-09", true)).toBe("none");
    expect(bootModeFor("2026-11-09", "2026-11-09", true)).toBe("none");
  });

  it("um módulo do boot para cada segmento da anilha e uma letra por traço do logotipo", () => {
    expect(RING_SEGMENTS).toHaveLength(8);
    expect(BOOT_MODULES).toHaveLength(RING_SEGMENTS.length);
    expect(WORDMARK_LETTERS).toHaveLength("AUGMENT".length);
  });
});
