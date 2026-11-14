import { describe, expect, it } from "vitest";
import { BUBBLE_REPEAT_MS, enqueue, isRepeat, makeBubble, remainingWithQueue, type BubbleItem } from "./bubble";

describe("balão do núcleo: fila", () => {
  it("fx glitch vira o tom reward e o título vem do tom", () => {
    const b = makeBubble(1, "Recorde: 10 reps", "ok", "glitch");
    expect(b.tone).toBe("reward");
    expect(b.title).toBe("AUG.CORE // RECORDE");
  });

  it("aceita a ação antiga e as opções novas, no máximo 2 botões", () => {
    const old = makeBubble(1, "x", "ok", undefined, { label: "Desfazer", run: () => {} });
    expect(old.actions.map((a) => a.label)).toEqual(["Desfazer"]);
    let went = "";
    const b = makeBubble(
      2,
      "x",
      "info",
      undefined,
      {
        title: "treino",
        actions: [
          { label: "Aplicar", onPress: () => {}, primary: true },
          { label: "Recusar", onPress: () => {} },
        ],
        route: "/relatorio",
      },
      0,
      (r) => (went = r),
    );
    expect(b.actions).toHaveLength(2);
    expect(b.title).toBe("AUG.CORE // TREINO");
    const r = makeBubble(3, "x", "info", undefined, { route: "/relatorio" }, 0, (r) => (went = r));
    r.actions[0].onPress();
    expect(went).toBe("/relatorio");
  });

  it("prioridade: danger > reward > warn > info > ok, estável no mesmo tom", () => {
    let q: BubbleItem[] = [];
    const tones = ["ok", "info", "warn", "info", "reward", "danger"] as const;
    tones.forEach((t, i) => (q = enqueue(q, makeBubble(i, `m${i}`, t))));
    expect(q.map((x) => x.tone)).toEqual(["danger", "reward", "warn", "info", "info", "ok"]);
    expect(q.filter((x) => x.tone === "info").map((x) => x.text)).toEqual(["m1", "m3"]);
  });

  it("a mesma frase da voz não volta em 10 min; confirmação, perigo e botão sempre aparecem", () => {
    const recent = new Map([["Descanse mais", 0]]);
    expect(isRepeat(makeBubble(1, "Descanse mais", "warn"), recent, 1000)).toBe(true);
    expect(isRepeat(makeBubble(1, "Descanse mais", "warn"), recent, BUBBLE_REPEAT_MS + 1)).toBe(false);
    recent.set("Salvo.", 0);
    expect(isRepeat(makeBubble(1, "Salvo.", "ok"), recent, 10)).toBe(false);
  });

  it("com fila, o balão sem botão encurta; com botão, espera a pessoa", () => {
    const plain = makeBubble(1, "x", "info", undefined, undefined, 0);
    expect(remainingWithQueue(plain, 8000, 500)).toBe(2500);
    expect(remainingWithQueue(plain, 8000, 5000)).toBe(1500);
    const act = makeBubble(2, "x", "info", undefined, { label: "Ok", run: () => {} }, 0);
    expect(remainingWithQueue(act, 8000, 500)).toBe(8000);
  });
});
