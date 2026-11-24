import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  status: "ativo" | "pendente" | "vencida" | "desativado";
  createdAt: Date;
  workspaces: number;
  isMe: boolean;
};

/** Lista de acessos para Admin › Pessoas. Só nome, e-mail e situação. */
export async function listPeople(): Promise<PersonRow[]> {
  const me = await requireAdmin();
  const rows = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true, banned: true, mustChangePassword: true,
      tempPasswordExpiresAt: true, createdAt: true, _count: { select: { workspaceMemberships: true } },
    },
  });
  const now = new Date();
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === "admin" ? "admin" : "user",
    status: u.banned
      ? "desativado"
      : u.mustChangePassword
        ? u.tempPasswordExpiresAt && u.tempPasswordExpiresAt < now ? "vencida" : "pendente"
        : "ativo",
    createdAt: u.createdAt,
    workspaces: u._count.workspaceMemberships,
    isMe: u.id === me.id,
  }));
}

/** Workspaces de equipe para o campo "Adicionar ao workspace". */
export async function listTeamWorkspacesForAdmin() {
  await requireAdmin();
  return db.workspace.findMany({ where: { kind: "TEAM" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
