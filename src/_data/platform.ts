import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/_lib/supabase/admin";

/**
 * Cadastro aberto? Lê platform_config.signup_open.
 * Usa a chave secreta porque a página de cadastro é vista sem login;
 * só este campo booleano sai daqui.
 */
export const isSignupOpen = cache(async (): Promise<boolean> => {
  const { data } = await createAdminClient().from("platform_config").select("signup_open").eq("id", 1).single();
  return data?.signup_open === true;
});
