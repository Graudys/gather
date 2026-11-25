"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import { notify } from "@/_lib/server/notify";
import { email as Email, id as Id } from "@/lib/validation";

/**
 * Ações do admin do Gather num workspace de equipe. Toda ação pede motivo e
 * entra no registro de ações (admin_actions), que a interface não edita nem apaga.
 * O admin nunca vê mensagens ou arquivos por aqui.
 */
const reason = z.string().trim().min(3, "Diga o motivo.").max(300);
const page = (id: string) => `/admin/workspaces/${id}`;
const back = (id: string, q: string): never => redirect(`${page(id)}?${q}`);

async function log(adminId: string, workspaceId: string, action: string, why: string, targetUserId?: string | null, metadata: Record<string, unknown> = {}) {
  await db.adminAction.create({ data: { adminId, workspaceId, action, reason: why, targetUserId: targetUserId ?? null, metadata: metadata as object } });
}

async function teamWorkspace(id: string) {
  const ws = await db.workspace.findFirst({ where: { id, kind: "TEAM" }, select: { id: true, name: true } });
  if (!ws) back(id, "erro=ws");
  return ws!;
}

export async function adminUpdateWorkspace(form: FormData) {
  const admin = await requireAdmin();
  const p = z.object({
    workspaceId: Id,
    calls: z.enum(["on", "off"]),
    quota: z.union([z.coerce.number().int().min(0).max(100_000), z.literal("")]),
    months: z.coerce.number().int(),
    hours: z.coerce.number().int(),
    reason,
  }).safeParse(Object.fromEntries(form));
  if (!p.success) return back(String(form.get("workspaceId")), `erro=${String(p.error.issues[0]?.path[0] ?? "dados")}`);
  const d = p.data;
  const ws = await teamWorkspace(d.workspaceId);
  const before = await db.workspaceSettings.findUnique({ where: { workspaceId: ws.id } });
  const data = {
    callsEnabled: d.calls === "on",
    callsEnabledAt: d.calls === "on" && !before?.callsEnabled ? new Date() : before?.callsEnabledAt ?? null,
    callMinutesQuota: d.quota === "" ? null : d.quota,
    messageRetentionMonths: d.months,
    fileRetentionHours: d.hours,
  };
  await db.workspaceSettings.upsert({ where: { workspaceId: ws.id }, create: { workspaceId: ws.id, ...data }, update: data });
  await log(admin.id, ws.id, "ws_settings_changed", d.reason, null, {
    antes: { reunioes: before?.callsEnabled, minutos: before?.callMinutesQuota, meses: before?.messageRetentionMonths, horas: before?.fileRetentionHours },
    depois: { reunioes: data.callsEnabled, minutos: data.callMinutesQuota, meses: d.months, horas: d.hours },
  });
  revalidatePath(page(ws.id));
  back(ws.id, "ok=salvo");
}

export async function adminAddPerson(form: FormData) {
  const admin = await requireAdmin();
  const p = z.object({ workspaceId: Id, email: Email, role: z.enum(["MEMBER", "ADMIN"]), reason }).safeParse(Object.fromEntries(form));
  if (!p.success) return back(String(form.get("workspaceId")), "erro=dados");
  const ws = await teamWorkspace(p.data.workspaceId);
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() }, select: { id: true, name: true } });
  if (!user) return back(ws.id, "erro=semAcesso");
  const exists = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } } });
  if (exists) return back(ws.id, "erro=jaMembro");
  await db.workspaceMember.create({ data: { workspaceId: ws.id, userId: user.id, role: p.data.role } });
  await log(admin.id, ws.id, "ws_member_added", p.data.reason, user.id, { papel: p.data.role });
  await notify([user.id], { workspaceId: ws.id, type: "workspace_added", title: `Você foi adicionado em ${ws.name}`, href: `/app/w/${ws.id}` });
  back(ws.id, "ok=adicionado");
}

export async function adminSetMember(form: FormData) {
  const admin = await requireAdmin();
  const p = z.object({ workspaceId: Id, userId: Id, op: z.enum(["MEMBER", "ADMIN", "REMOVE"]), reason }).safeParse(Object.fromEntries(form));
  if (!p.success) return back(String(form.get("workspaceId")), "erro=motivo");
  const ws = await teamWorkspace(p.data.workspaceId);
  const m = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: p.data.userId } } });
  // O dono só muda pela transferência.
  if (!m || m.role === "OWNER") return back(ws.id, "erro=dono");
  if (p.data.op === "REMOVE") {
    await db.$transaction([
      db.channelMember.deleteMany({ where: { userId: p.data.userId, channel: { workspaceId: ws.id } } }),
      db.conversationMember.deleteMany({ where: { userId: p.data.userId, conversation: { workspaceId: ws.id } } }),
      db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: ws.id, userId: p.data.userId } } }),
    ]);
  } else {
    await db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: ws.id, userId: p.data.userId } }, data: { role: p.data.op } });
  }
  await log(admin.id, ws.id, p.data.op === "REMOVE" ? "ws_member_removed" : "ws_role_changed", p.data.reason, p.data.userId, { para: p.data.op });
  back(ws.id, "ok=salvo");
}

export async function adminTransferOwner(form: FormData) {
  const admin = await requireAdmin();
  const p = z.object({ workspaceId: Id, newOwnerId: Id, oldBecomes: z.enum(["ADMIN", "MEMBER", "REMOVE"]), reason, notifyBoth: z.literal("on").optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return back(String(form.get("workspaceId")), "erro=motivo");
  const ws = await teamWorkspace(p.data.workspaceId);
  const [oldOwner, next] = await Promise.all([
    db.workspaceMember.findFirst({ where: { workspaceId: ws.id, role: "OWNER" } }),
    db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: p.data.newOwnerId } } }),
  ]);
  // Só quem já é membro vira dono.
  if (!next || next.role === "OWNER") return back(ws.id, "erro=novoDono");
  await db.$transaction(async (tx) => {
    await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: ws.id, userId: next.userId } }, data: { role: "OWNER" } });
    if (oldOwner) {
      if (p.data.oldBecomes === "REMOVE") {
        await tx.channelMember.deleteMany({ where: { userId: oldOwner.userId, channel: { workspaceId: ws.id } } });
        await tx.conversationMember.deleteMany({ where: { userId: oldOwner.userId, conversation: { workspaceId: ws.id } } });
        await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: ws.id, userId: oldOwner.userId } } });
      } else {
        await tx.workspaceMember.update({ where: { workspaceId_userId: { workspaceId: ws.id, userId: oldOwner.userId } }, data: { role: p.data.oldBecomes } });
      }
    }
  });
  await log(admin.id, ws.id, "ws_owner_transferred", p.data.reason, next.userId, { antigoDono: oldOwner?.userId ?? null, antigoVira: p.data.oldBecomes });
  if (p.data.notifyBoth) {
    await notify([next.userId], { workspaceId: ws.id, type: "workspace_added", title: `Agora você é dono de ${ws.name}`, href: `/app/w/${ws.id}/configuracoes` });
    if (oldOwner && p.data.oldBecomes !== "REMOVE") await notify([oldOwner.userId], { workspaceId: ws.id, type: "workspace_added", title: `${ws.name} tem um novo dono`, href: `/app/w/${ws.id}` });
  }
  back(ws.id, "ok=transferido");
}

export async function adminSuspend(form: FormData) {
  const admin = await requireAdmin();
  const p = z.object({ workspaceId: Id, op: z.enum(["suspend", "resume"]), reason }).safeParse(Object.fromEntries(form));
  if (!p.success) return back(String(form.get("workspaceId")), "erro=motivo");
  const ws = await teamWorkspace(p.data.workspaceId);
  await db.workspace.update({ where: { id: ws.id }, data: { suspendedAt: p.data.op === "suspend" ? new Date() : null } });
  await log(admin.id, ws.id, p.data.op === "suspend" ? "ws_suspended" : "ws_resumed", p.data.reason);
  back(ws.id, "ok=salvo");
}
