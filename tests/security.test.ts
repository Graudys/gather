import "./helpers";
import { afterAll, describe, expect, it } from "vitest";
import { generateTempPassword, safeNext } from "@/_lib/server/security";
import { fingerprint, scrub } from "@/_lib/server/observability";
import { hit, LIMITS } from "@/_lib/server/rate-limit";
import { db } from "@/_lib/db/prisma";

afterAll(() => db.$disconnect());

describe("senha temporária", () => {
  it("16 caracteres sem ambíguos, em grupos de 4, e sempre diferente", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const p = generateTempPassword();
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
      seen.add(p);
    }
    expect(seen.size).toBe(500);
  });
});

describe("redirecionamento", () => {
  it("só aceita caminho interno", () => {
    expect(safeNext("/app/w/1")).toBe("/app/w/1");
    expect(safeNext("https://mal.com")).toBe("/app");
    expect(safeNext("//mal.com")).toBe("/app");
    expect(safeNext("/\\mal.com")).toBe("/app");
  });
});

describe("registro de erro", () => {
  it("tira e-mail e token do texto", () => {
    expect(scrub("falhou para ana@ex.com com Bearer abc.def")).toBe("falhou para [email] com [token]");
  });
  it("mesmo erro com ids diferentes cai no mesmo grupo", () => {
    expect(fingerprint("SERVER", "Linha 1234 falhou", "/app/w/3f1c0a52-1111-4222-8333-944455556666"))
      .toBe(fingerprint("SERVER", "Linha 9876 falhou", "/app/w/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"));
  });
});

describe("limite de tentativas", () => {
  it("bloqueia depois do máximo, contando pedidos simultâneos", async () => {
    const key = `teste-${Date.now()}`;
    const res = await Promise.all(Array.from({ length: LIMITS.login.max + 4 }, () => hit("login", key)));
    expect(res.filter(Boolean)).toHaveLength(LIMITS.login.max);
    await db.rateLimit.deleteMany({ where: { key: `login:${key}` } });
  });
});
