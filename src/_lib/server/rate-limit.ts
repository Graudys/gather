import "server-only";
import { db } from "@/_lib/db/prisma";

/** Limites padrão. Ajuste aqui, num lugar só. */
export const LIMITS = {
  login: { max: 8, windowSec: 15 * 60 },
  passwordChange: { max: 6, windowSec: 15 * 60 },
  adminPeople: { max: 30, windowSec: 60 * 60 },
  clientError: { max: 30, windowSec: 60 },
  meetingToken: { max: 20, windowSec: 60 },
} as const;

/**
 * Conta uma tentativa e diz se ainda está dentro do limite.
 * Uma linha por chave em rate_limits, atualizada num único comando (sem corrida).
 * Se o banco falhar, bloqueia (fail closed).
 */
export async function hit(kind: keyof typeof LIMITS, key: string): Promise<boolean> {
  const { max, windowSec } = LIMITS[kind];
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      insert into rate_limits (key, count, window_start)
      values (${`${kind}:${key}`}, 1, now())
      on conflict (key) do update set
        count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then 1 else rate_limits.count + 1 end,
        window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSec}) then now() else rate_limits.window_start end
      returning count`;
    return (rows[0]?.count ?? max + 1) <= max;
  } catch {
    return false;
  }
}
