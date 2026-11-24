"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { hit } from "@/lib/server/rate-limit";
import { clientIp, requestUserAgent } from "@/lib/server/request";
import { isPwnedPassword, safeNext, verifyCaptcha } from "@/lib/server/security";
import { logAccess } from "@/lib/server/observability";

const back = (path: string, erro: string, extra = "") => redirect(`${path}?erro=${encodeURIComponent(erro)}${extra}`);
const NEUTRAL_LOGIN = "E-mail ou senha incorretos.";

const Password = z.string().min(10, "A senha precisa de pelo menos 10 caracteres.").max(72, "Senha longa demais.");

// ── Entrar com e-mail e senha
export async function signIn(form: FormData) {
  const ip = await clientIp();
  const parsed = z.object({ email: z.email().max(254), password: z.string().min(1).max(72), next: z.string().optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) back("/entrar", NEUTRAL_LOGIN);
  const { email, password, next } = parsed.data!;
  const emailKey = email.toLowerCase();
  if (!(await hit("login", `ip:${ip}`)) || !(await hit("login", `email:${emailKey}`))) {
    back("/entrar", "Muitas tentativas. Espere alguns minutos e tente de novo.");
  }
  if (!(await verifyCaptcha(form.get("cf-turnstile-response") as string | null, ip))) back("/entrar", "Confirme que você não é um robô.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailKey, password });
  const ua = await requestUserAgent();
  if (error || !data.user) {
    await logAccess(null, "LOGIN_FAILED", "password", ip, ua);
    // Mesma mensagem para e-mail inexistente e senha errada.
    back("/entrar", error?.code === "email_not_confirmed" ? "Confirme seu e-mail pelo link que enviamos." : NEUTRAL_LOGIN);
  }
  await logAccess(data.user!.id, "LOGIN", "password", ip, ua);
  redirect(safeNext(next));
}

// ── Entrar ou criar conta com Google (PKCE; volta em /auth/callback)
export async function signInWithGoogle(form: FormData) {
  const next = safeNext(form.get("next") as string | null);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) back("/entrar", "Não foi possível abrir o Google agora.");
  redirect(data.url!);
}

// ── Criar conta
export async function signUp(form: FormData) {
  const ip = await clientIp();
  const parsed = z.object({
    name: z.string().trim().min(1, "Diga seu nome.").max(80),
    email: z.email("E-mail inválido.").max(254),
    password: Password,
    age: z.literal("on", { error: "Para usar o Gather é preciso ter 18 anos ou mais." }),
    terms: z.literal("on", { error: "Aceite os Termos e a Política de Privacidade." }),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) back("/cadastro", parsed.error.issues[0]?.message ?? "Confira os dados.");
  const { name, email, password } = parsed.data!;
  if (!(await hit("signup", `ip:${ip}`))) back("/cadastro", "Muitos cadastros deste endereço. Tente mais tarde.");
  if (!(await verifyCaptcha(form.get("cf-turnstile-response") as string | null, ip))) back("/cadastro", "Confirme que você não é um robô.");
  if (await isPwnedPassword(password)) back("/cadastro", "Essa senha já apareceu em vazamentos. Escolha outra.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/confirmar`,
      // Lidos pelo gatilho handle_new_user, que grava perfil e consentimentos.
      data: { display_name: name, age_confirmed: "true" },
    },
  });
  // Resposta igual mesmo se o e-mail já existir (não revelar quem tem conta).
  if (error && error.code !== "user_already_exists") back("/cadastro", "Não foi possível criar a conta agora.");
  redirect("/cadastro/confira-o-email");
}

// ── Esqueci a senha (resposta sempre neutra)
export async function requestPasswordReset(form: FormData) {
  const ip = await clientIp();
  const email = z.email().max(254).safeParse(form.get("email"));
  if (email.success && (await hit("passwordReset", `ip:${ip}`)) && (await hit("passwordReset", `email:${email.data.toLowerCase()}`))
      && (await verifyCaptcha(form.get("cf-turnstile-response") as string | null, ip))) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email.data.toLowerCase(), {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/confirmar?next=/redefinir-senha`,
    });
  }
  redirect("/esqueci-senha?enviado=1");
}

// ── Nova senha (depois do link do e-mail); encerra as outras sessões
export async function updatePassword(form: FormData) {
  const parsed = Password.safeParse(form.get("password"));
  if (!parsed.success) back("/redefinir-senha", parsed.error.issues[0].message);
  if (await isPwnedPassword(parsed.data!)) back("/redefinir-senha", "Essa senha já apareceu em vazamentos. Escolha outra.");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password: parsed.data! });
  if (error || !data.user) back("/redefinir-senha", "O link venceu. Peça um novo.");
  await supabase.auth.signOut({ scope: "others" });
  await logAccess(data.user!.id, "PASSWORD_CHANGED", null, await clientIp(), await requestUserAgent());
  redirect("/app?aviso=senha-alterada");
}

// ── Sair (deste aparelho ou de todos)
export async function signOut(form: FormData) {
  const all = form.get("todos") === "1";
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await supabase.auth.signOut({ scope: all ? "global" : "local" });
  if (data?.claims?.sub) {
    await logAccess(data.claims.sub, all ? "LOGOUT_ALL" : "LOGOUT", null, await clientIp(), await requestUserAgent());
  }
  redirect("/entrar");
}

// ── Contas do Google: confirmar 18+ e termos no primeiro acesso
export async function confirmOnboarding(form: FormData) {
  if (form.get("age") !== "on" || form.get("terms") !== "on") back("/boas-vindas", "Marque as duas caixas para continuar.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_onboarding");
  if (error) back("/boas-vindas", "Não foi possível salvar agora.");
  redirect("/app");
}
