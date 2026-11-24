"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember, requireReadyUser } from "@/_lib/auth/dal";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";
import { visibleChannelsWhere } from "@/_data/workspaces";
import { id as Id, nomeWorkspace, textoMensagem } from "@/lib/validation";

export async function createWorkspace(form: FormData) {
  const user = await requireReadyUser();
  const name = nomeWorkspace.safeParse(form.get("name"));
  if (!name.success) redirect("/app?erro=nome");
  const res = await createTeamWorkspaceFor(user.id, name.data!);
  if (!res.ok) redirect("/app?erro=limite");
  redirect(`/app/w/${res.id}`);
}

const Msg = z.object({ workspaceId: Id, channelId: Id, content: textoMensagem });

export async function sendMessage(form: FormData) {
  const parsed = Msg.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const { workspaceId, channelId, content } = parsed.data;
  const { user } = await requireMember(workspaceId);
  // O canal precisa ser deste workspace E visível para a pessoa (privado só para membros).
  const channel = await db.channel.findFirst({ where: { id: channelId, ...visibleChannelsWhere(workspaceId, user.id) }, select: { id: true } });
  if (!channel) return;
  await db.message.create({ data: { workspaceId, channelId, senderId: user.id, content } });
  revalidatePath(`/app/w/${workspaceId}`);
}
