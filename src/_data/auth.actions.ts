"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAPIError } from "better-auth/api";
import { auth } from "@/_lib/auth/auth";
import { db } from "@/_lib/db/prisma";
import { getSessionUser, requireUser } from "@/_lib/auth/dal";
import { email as Email, senhaNova } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { clientIp, requestUserAgent } from "@/_lib/server/request";
import { isPwnedPassword, safeNext } from "@/_lib/server/security";
import { logAccess } from "@/_lib/server/observability";

// Os erros voltam como códigos curtos na URL (?erro=credenciais); o texto
// fica em _i18n. Nunca vai senha, e-mail ou mensagem de erro crua na URL.
const back = (path: string, code: string): never => redirect(`${path}?erro=${code}`);

// ── Entrar com e-mail e senha
export async function signIn(form: FormData) {
  const ip = await clientIp();
  const parsed = z
    .object({ email: Email, password: z.string().min(1).max(72), next: z.string().max(300).optional() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) back("/entrar", "credenciais");
  const { email, password, next } = parsed.data!;
  const emailKey = email.toLowerCase();
  if (!(await hit("login", `ip:${ip}`)) || !(await hit("login", `email:${emailKey}`))) back("/entrar", "muitas");

  const ua = await requestUserAgent();
  let userId: string | null = null;
  try {
    const res = await auth.api.signInEmail({ body: { email: emailKey, password, rememberMe: true }, headers: await headers() });
    userId = res.user.id;
  } catch (e) {
    await logAccess(null, "LOGIN_FAILED", "password", ip, ua);
    const msg = isAPIError(e) ? String(e.message ?? "") : "";
    if (msg.includes("ACCESS_DISABLED")) back("/entrar", "desativado");
    if (msg.includes("TEMP_PASSWORD_EXPIRED")) back("/entrar", "tempVencida");
    // Mesma mensagem para e-mail inexistente e senha errada.
    if (isAPIError(e)) back("/entrar", "credenciais");
    throw e;
  }
  await logAccess(userId, "LOGIN", "password", ip, ua);
  // Passa pela abertura (logo animado) enquanto o app carrega.
  redirect(`/abrindo?next=${encodeURIComponent(safeNext(next))}`);
}

// ── Primeiro acesso: senha nova + 18 anos + termos
export async function completeFirstAccess(form: FormData) {
  const user = await requireUser();
  if (user.ready) redirect("/app");
  const ip = await clientIp();
  if (!(await hit("passwordChange", `user:${user.id}`))) back("/primeiro-acesso", "muitas");

  const password = senhaNova.safeParse(form.get("password"));
  if (!password.success) back("/primeiro-acesso", "senhaCurta");
  if (form.get("password") !== form.get("confirm")) back("/primeiro-acesso", "erroIgual");
  if (form.get("age") !== "on" || form.get("terms") !== "on") back("/primeiro-acesso", "erroCaixas");
  const newPassword = password.data!;

  const ctx = await auth.$context;
  const account = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { password: true } });
  if (account?.password && (await ctx.password.verify({ hash: account.password, password: newPassword }))) {
    back("/primeiro-acesso", "erroTemp");
  }
  if (await isPwnedPassword(newPassword)) back("/primeiro-acesso", "erroVazada");

  const hash = await ctx.password.hash(newPassword);
  const now = new Date();
  // Senha nova e as duas confirmações no mesmo commit.
  await db.$transaction([
    db.account.updateMany({ where: { userId: user.id, providerId: "credential" }, data: { password: hash } }),
    db.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false, tempPasswordExpiresAt: null, ageConfirmedAt: now, termsAcceptedAt: now },
    }),
  ]);
  // Outros aparelhos que entraram com a temporária saem.
  await auth.api.revokeOtherSessions({ headers: await headers() });
  // Renova o cache da sessão no cookie (senão ele ainda diria "precisa trocar a senha").
  await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  await logAccess(user.id, "PASSWORD_CHANGED", "first_access", ip, await requestUserAgent());
  redirect("/abrindo?next=%2Fapp");
}

// ── Trocar senha (Perfil): pede a atual e derruba os outros aparelhos
export async function changePassword(form: FormData) {
  const user = await requireUser();
  const ip = await clientIp();
  if (!(await hit("passwordChange", `user:${user.id}`))) back("/app/perfil", "muitas");
  const parsed = z
    .object({ current: z.string().min(1).max(72), password: senhaNova, confirm: z.string() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) back("/app/perfil", "senhaCurta");
  const { current, password, confirm } = parsed.data!;
  if (password !== confirm) back("/app/perfil", "erroIgual");
  if (await isPwnedPassword(password)) back("/app/perfil", "erroVazada");
  try {
    await auth.api.changePassword({
      body: { currentPassword: current, newPassword: password, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (e) {
    if (isAPIError(e)) back("/app/perfil", "erroAtual");
    throw e;
  }
  await logAccess(user.id, "PASSWORD_CHANGED", "profile", ip, await requestUserAgent());
  redirect("/app/perfil?aviso=senha-alterada");
}

// ── Sair (deste aparelho ou de todos)
export async function signOut(form: FormData) {
  const all = form.get("todos") === "1";
  const user = await getSessionUser();
  const h = await headers();
  if (all) await auth.api.revokeSessions({ headers: h });
  // signOut apaga o cookie mesmo se a sessão já foi revogada acima.
  await auth.api.signOut({ headers: h }).catch(() => undefined);
  if (user) await logAccess(user.id, all ? "LOGOUT_ALL" : "LOGOUT", null, await clientIp(), await requestUserAgent());
  // "saiu=1": a página de entrar limpa o cache e a inscrição de push deste aparelho.
  redirect("/entrar?saiu=1");
}
