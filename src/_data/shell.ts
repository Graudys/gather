import "server-only";
import { photoVersion } from "@/lib/images";
import { ensureRoutineProject } from "@/_data/workspaces.server";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/_lib/db/prisma";
import { requireMember, requireReadyUser } from "@/_lib/auth/dal";
import { teamVisibleTo } from "@/_data/projects.access";
import { unreadCount } from "@/_data/notifications";

export const LAST_WS_COOKIE = "gather.ws";

export type AppShellData = {
  me: { id: string; name: string; email: string; role: "admin" | "user"; photoV: string };
  workspaces: { id: string; name: string; kind: "PERSONAL" | "TEAM"; role: "OWNER" | "ADMIN" | "MEMBER"; people: number; icon: string | null; photoV: string }[];
  current: { id: string; name: string; kind: "PERSONAL" | "TEAM"; role: "OWNER" | "ADMIN" | "MEMBER"; routine: { id: string; name: string } | null; projects: { id: string; name: string }[]; teams: { id: string; name: string }[] } | null;
  createWs: { max: number; canCreate: boolean; months: number[]; hours: number[] };
  unread: number; // avisos no sino
};

/** Último workspace aberto (cookie), conferindo se a pessoa ainda é membro. */
export async function lastWorkspaceId(userId: string) {
  const fromCookie = (await cookies()).get(LAST_WS_COOKIE)?.value;
  if (fromCookie && /^[0-9a-f-]{36}$/.test(fromCookie)) {
    const m = await db.workspaceMember.findFirst({ where: { workspaceId: fromCookie, userId, workspace: { suspendedAt: null } }, select: { workspaceId: true } });
    if (m) return m.workspaceId;
  }
  // Sem cookie: o primeiro de equipe; se não tiver, o pessoal.
  const first = await db.workspaceMember.findFirst({
    where: { userId, workspace: { suspendedAt: null } },
    orderBy: [{ workspace: { kind: "desc" } }, { joinedAt: "asc" }],
    select: { workspaceId: true },
  });
  return first?.workspaceId ?? null;
}

/** Tudo que a barra lateral e o topo precisam (uma vez por requisição). */
export const getAppShell = cache(async (workspaceId: string | null): Promise<AppShellData> => {
  const user = await requireReadyUser();
  const wsId = workspaceId ?? (await lastWorkspaceId(user.id));
  if (workspaceId) await requireMember(workspaceId); // confere acesso (e suspensão)

  const [rows, unread, projects, teams, cfg] = await Promise.all([
    db.workspaceMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "asc" },
      select: { role: true, workspace: { select: { id: true, name: true, kind: true, icon: true, imagePath: true, _count: { select: { members: true } } } } },
    }),
    unreadCount(),
    wsId
      ? db.project.findMany({
          where: { isFixed: false, status: { in: ["ACTIVE", "PAUSED"] }, team: { workspaceId: wsId, ...teamVisibleTo(user.id) } },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    wsId
      ? db.team.findMany({
          where: { workspaceId: wsId, slug: { not: "geral" }, ...teamVisibleTo(user.id) },
          orderBy: { name: "asc" },
          take: 8,
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    db.platformConfig.findUnique({ where: { id: 1 }, select: { maxOwnedTeamWorkspaces: true, messageRetentionOptions: true, fileRetentionOptions: true } }),
  ]);
  const workspaces = rows.map((r) => ({
    id: r.workspace.id, name: r.workspace.name, kind: r.workspace.kind, role: r.role, people: r.workspace._count.members,
    icon: r.workspace.icon, photoV: photoVersion(r.workspace.imagePath),
  }));
  const meRow = await db.user.findUnique({ where: { id: user.id }, select: { image: true } });
  const cur = workspaces.find((w) => w.id === wsId) ?? null;
  // Espaço pessoal: projeto fixo "Minha rotina" no topo da árvore (cria se faltar).
  const routine = cur?.kind === "PERSONAL" && cur.role === "OWNER" ? await ensureRoutineProject(cur.id, user.id) : null;
  return {
    me: { id: user.id, name: user.name, email: user.email, role: user.role, photoV: photoVersion(meRow?.image) },
    workspaces,
    current: cur ? { id: cur.id, name: cur.name, kind: cur.kind, role: cur.role, routine, projects, teams } : null,
    unread,
    createWs: {
      max: cfg?.maxOwnedTeamWorkspaces ?? 3,
      canCreate: workspaces.filter((w) => w.kind === "TEAM" && w.role === "OWNER").length < (cfg?.maxOwnedTeamWorkspaces ?? 3),
      months: cfg?.messageRetentionOptions ?? [1, 2, 3, 6, 12],
      hours: cfg?.fileRetentionOptions ?? [24, 168],
    },
  };
});
