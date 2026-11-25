import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import type { MemberRow } from "@/types/domain";

/** Configurações do workspace: só dono e admins. */
export async function getWorkspaceSettingsView(workspaceId: string) {
  const ctx = await requireMember(workspaceId, ["OWNER", "ADMIN"]);
  const [rows, settings, ws, cfg, actions] = await Promise.all([
    db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      select: { role: true, joinedAt: true, user: { select: { id: true, name: true, email: true } } },
    }),
    db.workspaceSettings.findUnique({ where: { workspaceId }, select: { messageRetentionMonths: true, fileRetentionHours: true, defaultChannelVisibility: true } }),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { description: true } }),
    db.platformConfig.findUnique({ where: { id: 1 }, select: { messageRetentionOptions: true, fileRetentionOptions: true } }),
    db.adminAction.findMany({
      where: { workspaceId, action: { startsWith: "ws_" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { action: true, reason: true, createdAt: true, admin: { select: { name: true } }, targetUser: { select: { name: true } } },
    }),
  ]);
  const members: MemberRow[] = rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
    isMe: r.user.id === ctx.user.id,
  }));
  return {
    role: ctx.role,
    workspace: ctx.workspace,
    description: ws?.description ?? "",
    channelVisibility: settings?.defaultChannelVisibility ?? "PUBLIC",
    members,
    retention: { messageMonths: settings?.messageRetentionMonths ?? 3, fileHours: settings?.fileRetentionHours ?? 24 },
    options: { months: cfg?.messageRetentionOptions ?? [1, 2, 3, 6, 12], hours: cfg?.fileRetentionOptions ?? [24, 168] },
    history: actions.map((a) => ({
      text: `${a.admin?.name ?? "Alguém"} · ${a.reason}${a.targetUser ? ` · ${a.targetUser.name}` : ""}`,
      at: a.createdAt.toISOString(),
    })),
  };
}
