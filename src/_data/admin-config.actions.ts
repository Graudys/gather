"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { forgetMaintenanceCache, requireAdmin } from "@/_lib/auth/dal";

const MONTHS = [1, 2, 3, 6, 12];
const HOURS = [24, 168, 720];
const on = z.enum(["on"]).optional();

const Config = z.object({
  callsForAllWorkspaces: on,
  lgpdEnabled: on,
  botEnabled: on,
  maintenanceMode: on,
  maintenanceMessage: z.string().trim().max(300).optional(),
  months: z.array(z.coerce.number().int().refine((n) => MONTHS.includes(n))).min(1),
  hours: z.array(z.coerce.number().int().refine((n) => HOURS.includes(n))).min(1),
  defaultMessageMonths: z.coerce.number().int(),
  defaultFileHours: z.coerce.number().int(),
  callMinutesPerWorkspace: z.coerce.number().int().min(0).max(100_000),
  callMaxParticipants: z.coerce.number().int().min(2).max(50),
  callMaxDurationMin: z.coerce.number().int().min(5).max(240),
  livekitMonthlyMinutes: z.coerce.number().int().min(0).max(1_000_000),
  maxOwnedTeamWorkspaces: z.coerce.number().int().min(0).max(50),
  tempPasswordHours: z.coerce.number().int().min(1).max(720),
  reason: z.string().trim().min(3).max(300),
});

/** Admin › Configurações. Tudo num formulário só, com motivo no registro. */
export async function saveConfig(form: FormData) {
  const admin = await requireAdmin();
  const p = Config.safeParse({ ...Object.fromEntries(form), months: form.getAll("months"), hours: form.getAll("hours") });
  if (!p.success) redirect(`/admin/configuracoes?erro=${encodeURIComponent(String(p.error.issues[0]?.path[0] ?? "dados"))}`);
  const d = p.data!;
  const months = [...new Set(d.months)].sort((a, b) => a - b);
  const hours = [...new Set(d.hours)].sort((a, b) => a - b);
  if (!months.includes(d.defaultMessageMonths) || !hours.includes(d.defaultFileHours)) redirect("/admin/configuracoes?erro=padrao");

  const before = await db.platformConfig.findUnique({ where: { id: 1 } });
  const data = {
    callsForAllWorkspaces: Boolean(d.callsForAllWorkspaces),
    lgpdEnabled: Boolean(d.lgpdEnabled),
    botEnabled: Boolean(d.botEnabled),
    maintenanceMode: Boolean(d.maintenanceMode),
    maintenanceMessage: d.maintenanceMessage || null,
    messageRetentionOptions: months,
    fileRetentionOptions: hours,
    defaultMessageMonths: d.defaultMessageMonths,
    defaultFileHours: d.defaultFileHours,
    callMinutesPerWorkspace: d.callMinutesPerWorkspace,
    callMaxParticipants: d.callMaxParticipants,
    callMaxDurationMin: d.callMaxDurationMin,
    livekitMonthlyMinutes: d.livekitMonthlyMinutes,
    maxOwnedTeamWorkspaces: d.maxOwnedTeamWorkspaces,
    tempPasswordHours: d.tempPasswordHours,
  };
  await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });

  // Quem usava uma opção desligada passa para a maior opção ainda ligada.
  const maxM = months.at(-1)!;
  const maxH = hours.at(-1)!;
  const movedM = await db.workspaceSettings.updateMany({ where: { messageRetentionMonths: { notIn: months } }, data: { messageRetentionMonths: maxM } });
  const movedH = await db.workspaceSettings.updateMany({ where: { fileRetentionHours: { notIn: hours } }, data: { fileRetentionHours: maxH } });

  const changed: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const [k, v] of Object.entries(data)) {
    const old = (before as Record<string, unknown> | null)?.[k];
    if (JSON.stringify(old) !== JSON.stringify(v)) changed[k] = { antes: old ?? null, depois: v };
  }
  await db.adminAction.create({
    data: { adminId: admin.id, action: "config_changed", reason: d.reason, metadata: { mudou: changed, workspacesAjustados: movedM.count + movedH.count } as object },
  });
  await forgetMaintenanceCache();
  revalidatePath("/", "layout");
  redirect(`/admin/configuracoes?ok=1&ajustados=${movedM.count + movedH.count}`);
}
