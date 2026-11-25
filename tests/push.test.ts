import "./helpers";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

// Serviço de push falso: o teste não manda nada para a internet.
const sent: { endpoint: string; payload: string }[] = [];
let failWith: number | null = null;
vi.mock("web-push", () => ({
  setVapidDetails: () => undefined,
  sendNotification: async (sub: { endpoint: string }, payload: string) => {
    if (failWith) throw Object.assign(new Error("push"), { statusCode: failWith });
    sent.push({ endpoint: sub.endpoint, payload });
  },
}));
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "teste-publica";
process.env.VAPID_PRIVATE_KEY = "teste-privada";
process.env.VAPID_SUBJECT = "mailto:teste@t.test";

import { setSessionId, setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { isPushEndpoint, safeHref, MAX_PUSH_DEVICES } from "@/lib/push";
import { savePushSubscription, removePushSubscription } from "@/_data/push.actions";
import { sendPush } from "@/_lib/server/push";

const ana = randomUUID();
const bia = randomUUID();
let sAna = "";
let sAna2 = "";
let sBia = "";
const P256 = "B".repeat(87);
const AUTH = "a".repeat(22);
const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: P256, auth: AUTH } });
const fcm = () => `https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
const subsOf = (userId: string) =>
  db.$queryRaw<{ endpoint: string; session_id: string }[]>`select endpoint, session_id from push_subscriptions where user_id = ${userId}::uuid`;
const newSession = (userId: string, expiresAt = new Date(Date.now() + 86_400_000)) =>
  db.session.create({ data: { userId, token: randomUUID(), expiresAt }, select: { id: true } }).then((r) => r.id);
const as = (userId: string, sessionId: string) => {
  setSessionUser({ id: userId });
  setSessionId(sessionId);
};

beforeAll(async () => {
  for (const id of [ana, bia]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  sAna = await newSession(ana);
  sAna2 = await newSession(ana);
  sBia = await newSession(bia);
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [ana, bia] } } });
  await db.rateLimit.deleteMany({ where: { key: { in: [`pushSubscribe:${ana}`, `pushSubscribe:${bia}`] } } });
});
beforeEach(() => {
  sent.length = 0;
  failWith = null;
});

describe("endereços de push aceitos", () => {
  it("aceita só serviços de push conhecidos, por HTTPS", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://api.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) expect(isPushEndpoint(ok), ok).toBe(true);
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.atacante.com/x",
      "https://atacante.com/fcm.googleapis.com",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://user:senha@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "https://push.apple.com/x",
      "javascript:alert(1)",
      "nao é url",
    ]) expect(isPushEndpoint(bad), bad).toBe(false);
  });

  it("notificação só abre links do próprio app", () => {
    expect(safeHref("/app/w/1/c/2")).toBe("/app/w/1/c/2");
    expect(safeHref("/app")).toBe("/app");
    expect(safeHref("https://atacante.com")).toBe("/app");
    expect(safeHref("//atacante.com/app")).toBe("/app");
    expect(safeHref("/app//atacante.com")).toBe("/app");
    expect(safeHref("/api/arquivos/1")).toBe("/app");
    expect(safeHref("/application")).toBe("/app");
  });
});

describe("ligar e desligar no aparelho", () => {
  it("guarda a inscrição presa à sessão atual", async () => {
    as(ana, sAna);
    const e = fcm();
    expect(await savePushSubscription(sub(e))).toEqual({ ok: true });
    const rows = await subsOf(ana);
    expect(rows).toEqual([{ endpoint: e, session_id: sAna }]);
  });

  it("recusa endereço fora da lista e chaves inválidas", async () => {
    as(ana, sAna);
    expect(await savePushSubscription(sub("https://atacante.com/coleta"))).toEqual({ ok: false });
    expect(await savePushSubscription({ endpoint: fcm(), keys: { p256dh: "curta", auth: AUTH } })).toEqual({ ok: false });
    expect(await savePushSubscription("lixo")).toEqual({ ok: false });
  });

  it("outra pessoa não consegue apagar a inscrição de ninguém", async () => {
    const [mine] = await subsOf(ana);
    as(bia, sBia);
    await removePushSubscription(mine.endpoint);
    expect(await subsOf(ana)).toHaveLength(1);
    as(ana, sAna);
    await removePushSubscription(mine.endpoint);
    expect(await subsOf(ana)).toHaveLength(0);
  });

  it("mesmo navegador com outra conta: a inscrição passa para a conta nova", async () => {
    const e = fcm();
    as(ana, sAna);
    await savePushSubscription(sub(e));
    as(bia, sBia);
    await savePushSubscription(sub(e));
    expect((await subsOf(ana)).some((r) => r.endpoint === e)).toBe(false);
    expect((await subsOf(bia)).map((r) => r.endpoint)).toContain(e);
  });

  it(`guarda no máximo ${MAX_PUSH_DEVICES} aparelhos por pessoa`, async () => {
    for (let i = 0; i < MAX_PUSH_DEVICES + 2; i++) {
      await db.$executeRaw`insert into push_subscriptions (user_id, session_id, endpoint, p256dh, auth, last_used_at)
        values (${ana}::uuid, ${sAna2}::uuid, ${fcm()}, ${P256}, ${AUTH}, now() - make_interval(days => ${i + 1}))`;
    }
    as(ana, sAna);
    const e = fcm();
    await savePushSubscription(sub(e));
    const rows = await subsOf(ana);
    expect(rows).toHaveLength(MAX_PUSH_DEVICES);
    expect(rows.map((r) => r.endpoint)).toContain(e);
  });

  it("sair da conta (sessão apagada) desliga o aparelho na hora", async () => {
    const before = (await subsOf(ana)).filter((r) => r.session_id === sAna2).length;
    expect(before).toBeGreaterThan(0);
    await db.session.delete({ where: { id: sAna2 } });
    expect((await subsOf(ana)).filter((r) => r.session_id === sAna2)).toHaveLength(0);
  });
});

describe("envio", () => {
  it("manda texto genérico, nunca o conteúdo, e só link interno", async () => {
    const r = await sendPush([bia], { type: "dm", href: "https://atacante.com", tag: "dm:1" });
    expect(r.sent).toBeGreaterThan(0);
    const p = JSON.parse(sent[0].payload);
    expect(p).toEqual({ title: "Gather", body: "Você tem uma nova mensagem direta", href: "/app", tag: "dm:1" });
  });

  it("sessão vencida não recebe", async () => {
    const old = await newSession(bia, new Date(Date.now() - 1000));
    await db.$executeRaw`insert into push_subscriptions (user_id, session_id, endpoint, p256dh, auth)
      values (${bia}::uuid, ${old}::uuid, ${"https://fcm.googleapis.com/fcm/send/vencida"}, ${P256}, ${AUTH})`;
    await sendPush([bia], { type: "thread", href: "/app" });
    expect(sent.some((x) => x.endpoint.endsWith("/vencida"))).toBe(false);
  });

  it("inscrição que o serviço diz não existir mais (410) é apagada", async () => {
    failWith = 410;
    const before = (await subsOf(bia)).length;
    const r = await sendPush([bia], { type: "thread", href: "/app" });
    expect(r.removed).toBeGreaterThan(0);
    expect((await subsOf(bia)).length).toBeLessThan(before);
  });
});
