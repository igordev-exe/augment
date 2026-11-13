import { describe, expect, it } from "vitest";
import { sectorFor } from "./sector";

describe("sectorFor", () => {
  it("põe cada rota no setor da tabela do plano", () => {
    expect(sectorFor("/")).toBe("op");
    expect(sectorFor("/treino/abc")).toBe("op");
    expect(sectorFor("/programas/ppl-v2")).toBe("op");
    expect(sectorFor("/ajustes")).toBe("op");
    expect(sectorFor("/historico")).toBe("tel");
    expect(sectorFor("/progresso")).toBe("tel");
    expect(sectorFor("/relatorio/3")).toBe("tel");
    expect(sectorFor("/exercicios/db-123")).toBe("tel");
    expect(sectorFor("/guia")).toBe("tel");
    expect(sectorFor("/online")).toBe("net");
    expect(sectorFor("/amigos")).toBe("net");
    expect(sectorFor("/treinador")).toBe("coach");
  });

  it("não confunde prefixos parecidos e cai em Operação no desconhecido", () => {
    expect(sectorFor("/guiaxyz")).toBe("op");
    expect(sectorFor("/onlinex")).toBe("op");
    expect(sectorFor("/kit")).toBe("op");
    expect(sectorFor("/qualquer")).toBe("op");
  });
});
