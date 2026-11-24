import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";
import type { AccessRow, AdminKpis, ErrorRow } from "@/types/domain";

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

/** Últimos acessos (Marco Civil). Mostra nome e e-mail só para o admin. */
export async function listRecentAccess(): Promise<AccessRow[]> {
  await requireAdmin();
  const rows = await db.accessLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])];
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: String(r.id),
    at: r.createdAt.toISOString(),
    person: r.userId ? (names.get(r.userId) ?? "Conta removida") : "—",
    event: r.event,
    ip: r.ip,
    device: r.userAgent ?? "",
  }));
}
