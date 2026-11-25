import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import type { AdminKpis, ErrorRow } from "@/types/domain";

/** Só números agregados. Nenhuma mensagem ou arquivo sai daqui. */
export async function getAdminKpis(): Promise<AdminKpis> {
  await requireAdmin();
  const [pessoas, workspaces, pendentes, erros] = await Promise.all([
    db.user.count({ where: { banned: false } }),
    db.workspace.count({ where: { kind: "TEAM" } }),
    db.user.count({ where: { banned: false, mustChangePassword: true } }),
    db.errorEvent.count({ where: { status: { in: ["NEW", "REGRESSED"] } } }),
  ]);
  return { pessoas, workspaces, pendentes, erros };
}

export async function listOpenErrors(): Promise<ErrorRow[]> {
  await requireAdmin();
  const rows = await db.errorEvent.findMany({
    where: { status: { in: ["NEW", "REGRESSED", "OPEN"] } },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    select: { id: true, status: true, source: true, message: true, location: true, count: true, usersAffected: true, lastSeenAt: true, release: true },
  });
  return rows.map((e) => ({ ...e, lastSeenAt: e.lastSeenAt.toISOString() }));
}
