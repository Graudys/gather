"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { email as Email, id as Id, nomeWorkspace } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { notify } from "@/_lib/server/notify";

/**
 * Configurações do workspace.
 * - Dono: tudo (papéis, remover qualquer um, prazos, renomear, apagar).
 * - Admin: adiciona e remove membros comuns, muda prazos e nome.
 * - Ninguém mexe no dono por aqui; transferir dono fica com o admin do Gather.
 * Pessoas só entram se já têm acesso ao Gather (criado em Admin › Pessoas).
 */

const settingsPath = (ws: string) => `/app/w/${ws}/configuracoes`;
const back = (ws: string, q: string): never => redirect(`${settingsPath(ws)}?${q}`);

async function log(adminId: string, workspaceId: string, reason: string, targetUserId?: string, action = "ws_change") {
  await db.adminAction.create({ data: { adminId, workspaceId, targetUserId: targetUserId ?? null, action, reason } });
}

export async function addMember(form: FormData) {
  const p = z.object({ workspaceId: Id, email: Email, role: z.enum(["MEMBER", "ADMIN"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return back(String(form.get("workspaceId")), "aba=membros&erro=email");
  const { workspaceId, role } = p.data;
  const ctx = await requireMember(workspaceId, ["OWNER", "ADMIN"]);
  if (ctx.workspace.kind === "PERSONAL") return back(workspaceId, "aba=membros&erro=pessoal");
  if (!(await hit("workspaceMembers", ctx.user.id))) return back(workspaceId, "aba=membros&erro=muitas");
  // Admin não cria outro admin; só o dono.
  if (role === "ADMIN" && ctx.role !== "OWNER") return back(workspaceId, "aba=membros&erro=permissao");

  const target = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() }, select: { id: true, name: true, banned: true } });
  if (!target || target.banned) return back(workspaceId, "aba=membros&erro=semAcesso");
  const already = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: target.id } } });
  if (already) return back(workspaceId, "aba=membros&erro=jaMembro");

  await db.workspaceMember.create({ data: { workspaceId, userId: target.id, role } });
  await log(ctx.user.id, workspaceId, `adicionou como ${role === "ADMIN" ? "admin" : "membro"}`, target.id, "ws_member_added");
  await notify([target.id], { workspaceId, type: "workspace_added", title: `${ctx.user.name} te adicionou em ${ctx.workspace.name}`, href: `/app/w/${workspaceId}` });
  revalidatePath(`/app/w/${workspaceId}`, "layout");
  back(workspaceId, "aba=membros&ok=adicionado");
}

export async function setMemberRole(form: FormData) {
  const p = z.object({ workspaceId: Id, userId: Id, role: z.enum(["MEMBER", "ADMIN"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { workspaceId, userId, role } = p.data;
  const ctx = await requireMember(workspaceId, ["OWNER"]);
  if (userId === ctx.user.id) return;
  const m = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!m || m.role === "OWNER") return;
  await db.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId } }, data: { role } });
  await log(ctx.user.id, workspaceId, role === "ADMIN" ? "tornou admin" : "tirou de admin", userId, "ws_role_changed");
  revalidatePath(settingsPath(workspaceId));
}

export async function removeMember(form: FormData) {
  const p = z.object({ workspaceId: Id, userId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { workspaceId, userId } = p.data;
  const ctx = await requireMember(workspaceId, ["OWNER", "ADMIN"]);
  if (userId === ctx.user.id) return;
  const m = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!m || m.role === "OWNER") return;
  // Admin remove só membro comum.
  if (m.role === "ADMIN" && ctx.role !== "OWNER") return;
  await removeFromWorkspace(workspaceId, userId);
  await log(ctx.user.id, workspaceId, "removeu do workspace", userId, "ws_member_removed");
  revalidatePath(`/app/w/${workspaceId}`, "layout");
}

/** Tira a pessoa do workspace e dos canais privados dele. Mensagens antigas ficam. */
async function removeFromWorkspace(workspaceId: string, userId: string) {
  await db.$transaction([
    db.channelMember.deleteMany({ where: { userId, channel: { workspaceId } } }),
    db.conversationMember.deleteMany({ where: { userId, conversation: { workspaceId } } }),
    db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } }),
  ]);
}

export async function leaveWorkspace(form: FormData) {
  const ws = Id.safeParse(form.get("workspaceId"));
  if (!ws.success) return;
  const ctx = await requireMember(ws.data);
  // Dono não sai (o workspace ficaria sem dono). Ele pode apagar o workspace.
  if (ctx.role === "OWNER") return;
  await removeFromWorkspace(ws.data, ctx.user.id);
  redirect("/app");
}

/**
 * Configurações › Geral (nome, descrição, visibilidade padrão de canais) e
 * Configurações › Retenção (prazos). Cada aba manda só os campos dela.
 */
export async function updateWorkspace(form: FormData) {
  const p = z.object({
    workspaceId: Id,
    aba: z.enum(["geral", "retencao"]).optional(),
    name: nomeWorkspace.optional(),
    description: z.string().trim().max(200).optional(),
    channelVisibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    months: z.coerce.number().int().optional(),
    hours: z.coerce.number().int().optional(),
  }).safeParse(Object.fromEntries(form));
  const wsRaw = String(form.get("workspaceId"));
  const aba = form.get("aba") === "retencao" ? "retencao" : "geral";
  if (!p.success) return back(wsRaw, `aba=${aba}&erro=dados`);
  const { workspaceId, name, description, channelVisibility, months, hours } = p.data;
  const ctx = await requireMember(workspaceId, ["OWNER", "ADMIN"]);
  const general = name !== undefined;
  const retention = months !== undefined || hours !== undefined;
  if (!general && !retention) return back(workspaceId, `aba=${aba}&erro=dados`);

  const before = await db.workspaceSettings.findUnique({ where: { workspaceId }, select: { messageRetentionMonths: true, fileRetentionHours: true } });
  const m = months ?? before?.messageRetentionMonths ?? 3;
  const h = hours ?? before?.fileRetentionHours ?? 24;
  if (retention) {
    // Os prazos precisam estar entre as opções ligadas em Admin › Configurações.
    const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { messageRetentionOptions: true, fileRetentionOptions: true } });
    if (!(cfg?.messageRetentionOptions ?? [1, 2, 3, 6, 12]).includes(m) || !(cfg?.fileRetentionOptions ?? [24, 168]).includes(h)) {
      return back(workspaceId, `aba=${aba}&erro=prazo`);
    }
  }
  await db.$transaction([
    ...(general ? [db.workspace.update({ where: { id: workspaceId }, data: { name, ...(description !== undefined ? { description: description || null } : {}) } })] : []),
    db.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, messageRetentionMonths: m, fileRetentionHours: h, ...(channelVisibility ? { defaultChannelVisibility: channelVisibility } : {}) },
      update: { ...(retention ? { messageRetentionMonths: m, fileRetentionHours: h } : {}), ...(channelVisibility ? { defaultChannelVisibility: channelVisibility } : {}) },
    }),
  ]);
  if (retention && before && (before.messageRetentionMonths !== m || before.fileRetentionHours !== h)) {
    await log(ctx.user.id, workspaceId, `mudou os prazos para ${m} ${m === 1 ? "mês" : "meses"} / ${h === 24 ? "24 horas" : "7 dias"}`, undefined, "ws_retention");
  }
  revalidatePath(`/app/w/${workspaceId}`, "layout");
  back(workspaceId, `aba=${aba}&ok=salvo`);
}

export async function deleteWorkspace(form: FormData) {
  const p = z.object({ workspaceId: Id, confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMember(p.data.workspaceId, ["OWNER"]);
  if (ctx.workspace.kind === "PERSONAL") return back(p.data.workspaceId, "erro=pessoal");
  if (p.data.confirm.trim() !== ctx.workspace.name) return back(p.data.workspaceId, "erro=confirmacao");
  await db.workspace.delete({ where: { id: ctx.workspace.id } }); // tudo do workspace vai junto (cascade)
  redirect("/app");
}
