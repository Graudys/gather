"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireReadyUser } from "@/_lib/auth/dal";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { nomeWorkspace } from "@/lib/validation";

/** Criar workspace (janela "Criar workspace"): nome, descrição e prazos iniciais. */
export async function createWorkspace(form: FormData) {
  const user = await requireReadyUser();
  const name = nomeWorkspace.safeParse(form.get("name"));
  if (!name.success) redirect("/app/novo-workspace?erro=nome");
  const res = await createTeamWorkspaceFor(user.id, name.data!);
  if (!res.ok) redirect("/app/novo-workspace?erro=limite");
  const extra = z.object({
    description: z.string().trim().max(200).optional(),
    months: z.coerce.number().int().optional(),
    hours: z.coerce.number().int().optional(),
  }).safeParse({ description: form.get("description") ?? undefined, months: form.get("months") ?? undefined, hours: form.get("hours") ?? undefined });
  if (extra.success) {
    const { description, months, hours } = extra.data;
    const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { messageRetentionOptions: true, fileRetentionOptions: true } });
    if (description) await db.workspace.update({ where: { id: res.id }, data: { description } });
    const okM = months && (cfg?.messageRetentionOptions ?? [1, 2, 3, 6, 12]).includes(months);
    const okH = hours && (cfg?.fileRetentionOptions ?? [24, 168]).includes(hours);
    if (okM || okH) {
      await db.workspaceSettings.updateMany({
        where: { workspaceId: res.id },
        data: { ...(okM ? { messageRetentionMonths: months } : {}), ...(okH ? { fileRetentionHours: hours } : {}) },
      });
    }
  }
  redirect(`/app/w/${res.id}`);
}
