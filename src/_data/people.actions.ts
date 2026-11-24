"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/_lib/auth/auth";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import { email as Email, nomePessoa, id as Id } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { clientIp, requestUserAgent } from "@/_lib/server/request";
import { generateTempPassword } from "@/_lib/server/security";
import { logAccess } from "@/_lib/server/observability";
import { ensurePersonalWorkspace } from "@/_data/workspaces.server";

/**
 * Admin › Pessoas. Cada ação:
 * 1. confere que quem chama é admin (requireAdmin) e o limite de uso;
 * 2. chama o endpoint do plugin admin do Better Auth, que confere o papel de novo;
 * 3. grava uma AdminAction (registro que não se apaga).
 * A senha temporária volta só no estado da tela (nunca em URL, log ou banco em texto).
 */

export type TempPasswordState =
  | { ok: true; name: string; email: string; password: string; days: number }
  | { ok: false; error: string }
  | null;

async function tempExpiry() {
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { tempPasswordHours: true } });
  const hours = cfg?.tempPasswordHours ?? 168;
  return { at: new Date(Date.now() + hours * 3600_000), days: Math.round(hours / 24) };
}

const Create = z.object({
  name: nomePessoa,
  email: Email,
  role: z.enum(["user", "admin"]),
  workspaceId: z.union([Id, z.literal("")]).optional(),
});

export async function createAccess(_prev: TempPasswordState, form: FormData): Promise<TempPasswordState> {
  const admin = await requireAdmin();
  if (!(await hit("adminPeople", admin.id))) return { ok: false, error: "muitas" };
  const parsed = Create.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "dados" };
  const { name, role, workspaceId } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return { ok: false, error: "jaExiste" };

  const password = generateTempPassword();
  const exp = await tempExpiry();
  const { user } = await auth.api.createUser({
    body: { email, name, password, role, data: { mustChangePassword: true, tempPasswordExpiresAt: exp.at } },
    headers: await headers(),
  });

  await ensurePersonalWorkspace(user.id, name);
  if (workspaceId) {
    const ws = await db.workspace.findFirst({ where: { id: workspaceId, kind: "TEAM" }, select: { id: true } });
    if (ws) await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: "MEMBER" } });
  }
  await db.adminAction.create({
    data: { adminId: admin.id, action: "access_created", targetUserId: user.id, workspaceId: workspaceId || null, reason: "Criar acesso", metadata: { role } },
  });
  await logAccess(user.id, "TEMP_PASSWORD_ISSUED", "admin", await clientIp(), await requestUserAgent());
  revalidatePath("/admin/pessoas");
  return { ok: true, name, email, password, days: exp.days };
}

export async function issueTempPassword(_prev: TempPasswordState, form: FormData): Promise<TempPasswordState> {
  const admin = await requireAdmin();
  if (!(await hit("adminPeople", admin.id))) return { ok: false, error: "muitas" };
  const userId = Id.safeParse(form.get("userId"));
  if (!userId.success) return { ok: false, error: "dados" };
  if (userId.data === admin.id) return { ok: false, error: "voceMesmo" };
  const target = await db.user.findUnique({ where: { id: userId.data }, select: { id: true, name: true, email: true } });
  if (!target) return { ok: false, error: "dados" };

  const password = generateTempPassword();
  const exp = await tempExpiry();
  const h = await headers();
  await auth.api.setUserPassword({ body: { userId: target.id, newPassword: password }, headers: h });
  await db.user.update({ where: { id: target.id }, data: { mustChangePassword: true, tempPasswordExpiresAt: exp.at } });
  // Quem estava logado sai: a próxima entrada é com a temporária.
  await auth.api.revokeUserSessions({ body: { userId: target.id }, headers: h });
  await db.adminAction.create({ data: { adminId: admin.id, action: "temp_password_issued", targetUserId: target.id, reason: "Nova senha temporária" } });
  await logAccess(target.id, "TEMP_PASSWORD_ISSUED", "admin", await clientIp(), await requestUserAgent());
  revalidatePath("/admin/pessoas");
  return { ok: true, name: target.name, email: target.email, password, days: exp.days };
}

const Target = z.object({ userId: Id, reason: z.string().trim().max(300).optional() });

/** Ações simples da linha: papel, encerrar sessões, desativar/reativar. */
export async function personAction(form: FormData) {
  const admin = await requireAdmin();
  if (!(await hit("adminPeople", admin.id))) return;
  const parsed = Target.extend({ op: z.enum(["make_admin", "remove_admin", "revoke", "disable", "enable"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { userId, op } = parsed.data;
  // Ninguém se rebaixa, se desativa ou derruba as próprias sessões por aqui.
  if (userId === admin.id) return;
  const reason = parsed.data.reason || op;
  const h = await headers();

  switch (op) {
    case "make_admin":
      await auth.api.setRole({ body: { userId, role: "admin" }, headers: h });
      break;
    case "remove_admin":
      await auth.api.setRole({ body: { userId, role: "user" }, headers: h });
      break;
    case "revoke":
      await auth.api.revokeUserSessions({ body: { userId }, headers: h });
      break;
    case "disable":
      // banUser também derruba todas as sessões da pessoa.
      await auth.api.banUser({ body: { userId, banReason: reason.slice(0, 300) }, headers: h });
      await logAccess(userId, "ACCESS_DISABLED", "admin", await clientIp(), await requestUserAgent());
      break;
    case "enable":
      await auth.api.unbanUser({ body: { userId }, headers: h });
      break;
  }
  await db.adminAction.create({ data: { adminId: admin.id, action: op, targetUserId: userId, reason } });
  revalidatePath("/admin/pessoas");
}
