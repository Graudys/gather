import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";

/** Nomes das ações em português (o código fica em inglês no banco). */
export const ACTION_LABEL: Record<string, string> = {
  access_created: "Acesso criado",
  temp_password_issued: "Senha temporária gerada",
  make_admin: "Tornou admin",
  remove_admin: "Tirou admin",
  revoke: "Sessões encerradas",
  disable: "Acesso desativado",
  enable: "Acesso reativado",
  ws_settings_changed: "Workspace: reuniões e prazos",
  ws_member_added: "Pessoa adicionada",
  ws_member_removed: "Pessoa removida",
  ws_role_changed: "Papel no workspace",
  ws_owner_transferred: "Propriedade transferida",
  ws_suspended: "Workspace suspenso",
  ws_resumed: "Workspace reativado",
  ws_retention: "Prazos mudados (pelo dono)",
  ws_change: "Workspace alterado",
  config_changed: "Configurações mudadas",
  help_article_created: "Artigo criado",
  help_article_updated: "Artigo editado",
  help_article_deleted: "Artigo apagado",
  access_log_viewed: "Registro de acesso consultado",
  cron_cleanup: "Limpeza diária",
};

const KINDS: Record<string, string[]> = {
  pessoas: ["access_created", "temp_password_issued", "make_admin", "remove_admin", "revoke", "disable", "enable", "access_log_viewed"],
  workspaces: ["ws_settings_changed", "ws_member_added", "ws_member_removed", "ws_role_changed", "ws_owner_transferred", "ws_suspended", "ws_resumed", "ws_retention", "ws_change"],
  config: ["config_changed", "cron_cleanup"],
  ajuda: ["help_article_created", "help_article_updated", "help_article_deleted"],
};

/** Registro de ações. Só leitura: nenhuma tela edita ou apaga. */
export async function listAdminActions(kind?: string, period?: string, limit = 200) {
  await requireAdmin();
  const since = new Date(Date.now() - (period === "12m" ? 365 : 30) * 86_400_000);
  const rows = await db.adminAction.findMany({
    where: { createdAt: { gte: since }, ...(kind && KINDS[kind] ? { action: { in: KINDS[kind] } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, action: true, reason: true, createdAt: true, metadata: true,
      admin: { select: { name: true } }, targetUser: { select: { name: true } }, workspace: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    action: ACTION_LABEL[r.action] ?? r.action,
    target: [r.workspace?.name, r.targetUser?.name].filter(Boolean).join(" · ") || "—",
    reason: r.reason,
    who: r.admin?.name ?? "Rotina",
  }));
}

/** Pessoas para escolher na consulta de acessos. */
export async function listPeopleForAccess() {
  await requireAdmin();
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } });
}

/** IP cortado na tela: 189.40.xx.xx (o completo só na exportação para ordem judicial). */
export function maskIp(ip: string) {
  if (ip.includes(":")) return `${ip.split(":").slice(0, 2).join(":")}:xxxx`;
  const p = ip.split(".");
  return p.length === 4 ? `${p[0]}.${p[1]}.xx.xx` : "—";
}

/** Só abre o registro de uma pessoa se este admin registrou o motivo há menos de 30 minutos. */
export async function getAccessLogFor(personId: string) {
  const admin = await requireAdmin();
  const consult = await db.adminAction.findFirst({
    where: { adminId: admin.id, action: "access_log_viewed", targetUserId: personId, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
    orderBy: { createdAt: "desc" },
    select: { reason: true },
  });
  if (!consult) return null;
  const [person, rows] = await Promise.all([
    db.user.findUnique({ where: { id: personId }, select: { id: true, name: true, email: true } }),
    db.accessLog.findMany({ where: { userId: personId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  if (!person) return null;
  return { person, reason: consult.reason, judicial: consult.reason.startsWith("Ordem judicial"), rows };
}
