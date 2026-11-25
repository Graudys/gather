import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "Recibo" de envio: o servidor diz onde o arquivo pode ser gravado e assina.
 * Na hora de anexar, só aceitamos recibos assinados por nós, da mesma pessoa,
 * do mesmo workspace e do mesmo destino, e dentro da validade.
 */
export type Ticket = { p: string; n: string; s: number; w: string; u: string; d: string; x: number };

const key = () => process.env.BETTER_AUTH_SECRET ?? "";
const sign = (body: string) => createHmac("sha256", key()).update(`gather-upload:${body}`).digest("base64url");

export function makeTicket(t: Omit<Ticket, "x">, ttlSec = 60 * 60): string {
  const body = Buffer.from(JSON.stringify({ ...t, x: Date.now() + ttlSec * 1000 })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readTicket(raw: string, expect: { w: string; u: string; d: string }): Ticket | null {
  const [body, mac] = String(raw).split(".");
  if (!body || !mac) return null;
  const good = Buffer.from(sign(body));
  const got = Buffer.from(mac);
  if (good.length !== got.length || !timingSafeEqual(good, got)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString()) as Ticket;
    if (t.x < Date.now() || t.w !== expect.w || t.u !== expect.u || t.d !== expect.d) return null;
    if (!t.p.startsWith(`ws/${t.w}/pendente/`)) return null;
    return t;
  } catch {
    return null;
  }
}
