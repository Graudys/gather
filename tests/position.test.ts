import { describe, expect, it } from "vitest";
import { positionBetween } from "@/lib/position";

describe("posição no quadro", () => {
  it("sempre cabe uma chave entre duas, e a ordem se mantém", () => {
    const keys: string[] = [positionBetween()];
    // insere 300 vezes em lugares variados
    for (let i = 0; i < 300; i++) {
      const at = (i * 7) % (keys.length + 1);
      const k = positionBetween(keys[at - 1] ?? null, keys[at] ?? null);
      if (at > 0) expect(k > keys[at - 1]!).toBe(true);
      if (at < keys.length) expect(k < keys[at]!).toBe(true);
      expect(k.endsWith("0")).toBe(false);
      keys.splice(at, 0, k);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("vizinhas fora de ordem não quebram", () => {
    expect(positionBetween("m", "c") > "m").toBe(true);
  });
});
