import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember, requireReadyUser } from "@/_lib/auth/dal";
import type { ChannelSummary, MessageView, WorkspaceSummary, WorkspaceView } from "@/types/domain";

// Toda leitura filtra pelo id da pessoa da sessão. Nada aqui aceita userId de fora.

export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  const user = await requireReadyUser("/app");
  const rows = await db.workspaceMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: { role: true, workspace: { select: { id: true, name: true, kind: true } } },
  });
  return rows.map((r) => ({ id: r.workspace.id, name: r.workspace.name, kind: r.workspace.kind, role: r.role }));
}

export async function getTeamWorkspaceLimit() {
  const user = await requireReadyUser("/app");
  const [cfg, owned] = await Promise.all([
    db.platformConfig.findUnique({ where: { id: 1 }, select: { maxOwnedTeamWorkspaces: true } }),
    db.workspaceMember.count({ where: { userId: user.id, role: "OWNER", workspace: { kind: "TEAM" } } }),
  ]);
  const max = cfg?.maxOwnedTeamWorkspaces ?? 3;
  return { max, owned, canCreate: owned < max };
}

/** Canais que a pessoa enxerga: públicos do workspace + privados em que ela está. */
export function visibleChannelsWhere(workspaceId: string, userId: string) {
  return { workspaceId, OR: [{ visibility: "PUBLIC" as const }, { members: { some: { userId } } }] };
}

export async function getWorkspaceView(workspaceId: string, channelId?: string): Promise<WorkspaceView> {
  const { workspace, role, user } = await requireMember(workspaceId);

  const [channels, settings, cfg] = await Promise.all([
    db.channel.findMany({ where: visibleChannelsWhere(workspaceId, user.id), select: { id: true, name: true, visibility: true }, orderBy: { name: "asc" } }),
    db.workspaceSettings.findUnique({ where: { workspaceId }, select: { messageRetentionMonths: true, fileRetentionHours: true, callsEnabled: true } }),
    db.platformConfig.findUnique({ where: { id: 1 }, select: { callsForAllWorkspaces: true } }),
  ]);
  const list = channels as ChannelSummary[];
  const current = list.find((c) => c.id === channelId) ?? list[0] ?? null;

  let messages: MessageView[] = [];
  if (current) {
    const rows = await db.message.findMany({
      where: { channelId: current.id, workspaceId, parentMessageId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, content: true, createdAt: true, deletedAt: true, sender: { select: { name: true } } },
    });
    messages = rows.map((m) => ({
      id: m.id,
      // Mensagem apagada não manda o texto para o navegador.
      content: m.deletedAt ? "" : m.content,
      createdAt: m.createdAt.toISOString(),
      deleted: Boolean(m.deletedAt),
      senderName: m.sender?.name ?? null,
    }));
  }

  return {
    workspace: { id: workspace.id, name: workspace.name, kind: workspace.kind },
    role,
    channels: list,
    current,
    messages,
    retention: { messageMonths: settings?.messageRetentionMonths ?? 3, fileHours: settings?.fileRetentionHours ?? 24 },
    callsEnabled: Boolean(settings?.callsEnabled || cfg?.callsForAllWorkspaces),
  };
}
