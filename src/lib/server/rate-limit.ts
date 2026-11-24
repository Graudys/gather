import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Limites padrão. Ajuste aqui, num lugar só. */
export const LIMITS = {
  login: { max: 8, windowSec: 15 * 60 },
  signup: { max: 5, windowSec: 60 * 60 },
  passwordReset: { max: 3, windowSec: 60 * 60 },
  clientError: { max: 30, windowSec: 60 },
  meetingToken: { max: 20, windowSec: 60 },
  invite: { max: 30, windowSec: 24 * 60 * 60 },
  ticket: { max: 10, windowSec: 24 * 60 * 60 },
} as const;

/**
 * Conta uma tentativa e diz se ainda está dentro do limite.
 * Guarda no Postgres (tabela private.rate_limits); sem serviço extra.
 * Se o banco falhar, bloqueia (fail closed) nas rotas sensíveis.
 */
export async function hit(kind: keyof typeof LIMITS, key: string): Promise<boolean> {
  const { max, windowSec } = LIMITS[kind];
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    k: `${kind}:${key}`,
    max_hits: max,
    window_seconds: windowSec,
  });
  if (error) return false;
  return data === true;
}
