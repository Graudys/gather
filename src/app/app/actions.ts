"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember, requireReadyUser } from "@/lib/auth/dal";

export async function createWorkspace(form: FormData) {
  await requireReadyUser();
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) redirect("/app?erro=" + encodeURIComponent("Dê um nome de até 80 caracteres."));
  const supabase = await createClient();
  // A função no banco confere o limite de 1 workspace de equipe no plano grátis.
  const { data, error } = await supabase.rpc("create_team_workspace", { ws_name: name.data });
  if (error) redirect("/app?erro=" + encodeURIComponent(error.message.includes("Limite") ? "No plano grátis cada pessoa tem 1 workspace de equipe." : "Não foi possível criar agora."));
  redirect(`/app/w/${data}`);
}

const Msg = z.object({
  workspaceId: z.uuid(),
  channelId: z.uuid(),
  content: z.string().trim().min(1).max(4000),
});

export async function sendMessage(form: FormData) {
  const parsed = Msg.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { workspaceId, channelId, content } = parsed.data;
  const { user } = await requireMember(workspaceId);
  const supabase = await createClient();
  // O RLS confere de novo: canal do mesmo workspace, visível para a pessoa, remetente = ela.
  await supabase.from("messages").insert({ workspace_id: workspaceId, channel_id: channelId, sender_id: user.id, content });
  revalidatePath(`/app/w/${workspaceId}`);
}

export async function requestMeetings(form: FormData) {
  const ws = z.uuid().safeParse(form.get("workspaceId"));
  if (!ws.success) return;
  const { user } = await requireMember(ws.data);
  const supabase = await createClient();
  await supabase.from("meeting_requests").upsert({ workspace_id: ws.data, user_id: user.id }, { ignoreDuplicates: true });
  revalidatePath(`/app/w/${ws.data}`);
}
