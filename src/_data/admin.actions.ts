"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/_lib/supabase/server";
import { requirePlatformAdmin } from "@/_lib/auth/dal";

export async function setErrorStatus(form: FormData) {
  const user = await requirePlatformAdmin();
  const parsed = z.object({ id: z.uuid(), status: z.enum(["RESOLVED", "IGNORED", "OPEN"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const resolved = parsed.data.status === "RESOLVED";
  const supabase = await createClient();
  await supabase
    .from("error_events")
    .update({ status: parsed.data.status, resolved_at: resolved ? new Date().toISOString() : null, resolved_by_id: resolved ? user.id : null })
    .eq("id", parsed.data.id);
  revalidatePath("/admin/erros");
}
