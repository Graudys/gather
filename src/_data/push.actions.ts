"use server";
import { db } from "@/_lib/db/prisma";
import { getSessionId, requireReadyUser } from "@/_lib/auth/dal";
import { hit } from "@/_lib/server/rate-limit";
import { requestUserAgent } from "@/_lib/server/request";
import { MAX_PUSH_DEVICES, pushSubscriptionSchema } from "@/lib/push";

/**
 * Liga as notificações NESTE aparelho. A inscrição fica presa à sessão atual:
 * quando a sessão acaba (sair, sair de todos, trocar a senha, conta suspensa),
 * o banco apaga a inscrição junto.
 * Server Action: o Next confere a origem da chamada (proteção contra CSRF).
 */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireReadyUser();
  const sessionId = await getSessionId();
  const p = pushSubscriptionSchema.safeParse(input);
  if (!sessionId || !p.success) return { ok: false };
  if (!(await hit("pushSubscribe", user.id))) return { ok: false };
  const { endpoint, keys } = p.data;
  const ua = ((await requestUserAgent()) ?? "").slice(0, 300) || null;

  // Mesmo endpoint de antes (outra conta no mesmo navegador): passa a ser desta sessão.
  await db.$executeRaw`
    insert into push_subscriptions (user_id, session_id, endpoint, p256dh, auth, user_agent)
    values (${user.id}::uuid, ${sessionId}::uuid, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${ua})
    on conflict (endpoint) do update set
      user_id = excluded.user_id, session_id = excluded.session_id,
      p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent,
      last_used_at = now()`;

  // Limite de aparelhos por pessoa: os mais antigos saem.
  await db.$executeRaw`
    delete from push_subscriptions where id in (
      select id from push_subscriptions where user_id = ${user.id}::uuid
      order by last_used_at desc offset ${MAX_PUSH_DEVICES})`;
  return { ok: true };
}

/** Desliga as notificações neste aparelho. Só apaga inscrição da própria pessoa. */
export async function removePushSubscription(endpoint: unknown): Promise<{ ok: boolean }> {
  const user = await requireReadyUser();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false };
  await db.$executeRaw`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${user.id}::uuid`;
  return { ok: true };
}
