import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import type { WorkspaceSummary } from "@/types/domain";

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
