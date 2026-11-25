import "server-only";
import { cache } from "react";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";

/** Configuração da plataforma, lida uma vez por requisição. */
export const platformConfig = cache(async () => db.platformConfig.findUnique({ where: { id: 1 } }));

export async function getConfigAdmin() {
  await requireAdmin();
  const cfg = (await platformConfig()) ?? (await db.platformConfig.create({ data: { id: 1 } }));
  const usage = await db.workspaceSettings.groupBy({ by: ["messageRetentionMonths", "fileRetentionHours"], _count: true });
  return { cfg, usage };
}
