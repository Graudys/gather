import "server-only";
import * as webpush from "web-push";
import { db } from "@/_lib/db/prisma";
import { PUSH_TEXT, isPushEndpoint, safeHref } from "@/lib/push";

/**
 * Envio de notificações para os aparelhos (Web Push, padrão VAPID).
 * A chave PRIVADA fica só aqui, no servidor (VAPID_PRIVATE_KEY, sem NEXT_PUBLIC_).
 * Sem as chaves configuradas, nada é enviado e o app segue normal com o sino.
 *
 * A tabela push_subscriptions é lida com SQL parametrizado (tagged template):
 * nada de texto montado à mão.
 */

let ready: boolean | null = null;
export function pushConfigured() {
  if (ready !== null) return ready;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  ready = Boolean(pub && priv && subject);
  if (ready) webpush.setVapidDetails(subject!, pub!, priv!);
  return ready;
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Manda um aviso curto para os aparelhos das pessoas.
 * Só sessões ainda válidas recebem; inscrição que o serviço diz não existir
 * mais (404/410) é apagada na hora.
 */
export async function sendPush(userIds: string[], n: { type: string; href: string; tag?: string }) {
  if (!userIds.length || !pushConfigured()) return { sent: 0, removed: 0 };
  const rows = await db.$queryRaw<Row[]>`
    select p.id, p.endpoint, p.p256dh, p.auth
    from push_subscriptions p
    join sessions s on s.id = p.session_id
    where p.user_id = any(${userIds}::uuid[]) and s.expires_at > now()`;

  const payload = JSON.stringify({
    title: "Gather",
    body: PUSH_TEXT[n.type] ?? "Você tem um aviso novo",
    href: safeHref(n.href),
    tag: (n.tag ?? n.type).slice(0, 64),
  });

  let sent = 0;
  const dead: string[] = [];
  const used: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      // Confere de novo: um endpoint que não seja de serviço de push nunca recebe requisição.
      if (!isPushEndpoint(r.endpoint)) return void dead.push(r.id);
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, {
          TTL: 60 * 60 * 24,
          urgency: "normal",
          timeout: 5000,
        });
        sent++;
        used.push(r.id);
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(r.id);
        else console.error("[push] falhou", code ?? (e instanceof Error ? e.message : e));
      }
    }),
  );
  if (dead.length) await db.$executeRaw`delete from push_subscriptions where id = any(${dead}::uuid[])`;
  if (used.length) await db.$executeRaw`update push_subscriptions set last_used_at = now() where id = any(${used}::uuid[])`;
  return { sent, removed: dead.length };
}
