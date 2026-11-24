import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/_lib/server/env";

/**
 * Cliente com a chave secreta: IGNORA o RLS.
 * Regra: só use depois de conferir o acesso com as funções de src/lib/auth/dal.ts,
 * e nunca devolva o resultado inteiro para o navegador.
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
