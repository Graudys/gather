"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireAdmin } from "@/_lib/auth/dal";

export async function setErrorStatus(form: FormData) {
  const user = await requireAdmin();
  const parsed = z.object({ id: z.uuid(), status: z.enum(["RESOLVED", "IGNORED", "OPEN"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const resolved = parsed.data.status === "RESOLVED";
  await db.errorEvent.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status, resolvedAt: resolved ? new Date() : null, resolvedById: resolved ? user.id : null },
  });
  revalidatePath("/admin/erros");
}
