"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { requireChannel } from "@/_data/chat.access";
import { requireNotes } from "@/_data/notes";
import { hit } from "@/_lib/server/rate-limit";
import { notify, snippet } from "@/_lib/server/notify";
import { createNoteShare } from "@/_lib/server/note-share";
import { id as Id } from "@/lib/validation";

/**
 * Enviar anotação (sem cópia): vira uma mensagem com o cartão da nota, na
 * conversa direta com a pessoa ou no canal. Quem recebe só lê a versão do envio.
 * Destino no formulário: "workspaceId:userId" ou "workspaceId:channelId".
 */
const Send = z.object({
  workspaceId: Id, // espaço pessoal de onde sai a nota
  noteId: Id,
  to: z.string().regex(/^[0-9a-f-]{36}:[0-9a-f-]{36}$/),
  text: z.string().trim().max(500).optional(),
});

async function loadNote(workspaceId: string, noteId: string) {
  const ctx = await requireNotes(workspaceId);
  const note = await db.note.findFirst({ where: { id: noteId, workspaceId }, select: { id: true, title: true, content: true, notebookId: true } });
  return { ctx, note };
}
const back = (ws: string, note: { id: string; notebookId: string } | null, q: string) =>
  redirect(`/app/w/${ws}/notas${note ? `?c=${note.notebookId}&n=${note.id}&` : "?"}${q}`);

export async function sendNoteToPerson(form: FormData) {
  const p = Send.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { ctx, note } = await loadNote(p.data.workspaceId, p.data.noteId);
  if (!note) return;
  const [targetWs, userId] = p.data.to.split(":") as [string, string];
  if (userId === ctx.user.id) return back(p.data.workspaceId, note, "enviada=erro");
  // Os dois precisam estar no workspace onde fica a conversa.
  const { workspace } = await requireMember(targetWs);
  if (workspace.kind !== "TEAM") return back(p.data.workspaceId, note, "enviada=erro");
  if (!(await db.workspaceMember.findFirst({ where: { workspaceId: targetWs, userId }, select: { userId: true } }))) return back(p.data.workspaceId, note, "enviada=erro");
  if (!(await hit("chatMessage", ctx.user.id))) return back(p.data.workspaceId, note, "enviada=muitas");

  const everyone = [ctx.user.id, userId].sort();
  const convId = await db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`conv:${targetWs}:${everyone.join(",")}`}))`;
    const found = await tx.conversation.findMany({
      where: { workspaceId: targetWs, kind: "DIRECT", members: { some: { userId: ctx.user.id } } },
      select: { id: true, members: { select: { userId: true } } },
    });
    const same = found.find((c) => c.members.map((m) => m.userId).sort().join(",") === everyone.join(","));
    if (same) return same.id;
    return (await tx.conversation.create({ data: { workspaceId: targetWs, kind: "DIRECT", createdById: ctx.user.id, members: { create: everyone.map((u) => ({ userId: u })) } }, select: { id: true } })).id;
  });
  const text = p.data.text || "";
  await createNoteShare({ senderId: ctx.user.id, note, workspaceId: targetWs, conversationId: convId, text });
  await notify([userId], {
    workspaceId: targetWs, type: "dm", key: `dm:${convId}`,
    title: `${ctx.user.name} te enviou uma anotação`, body: snippet(note.title || "Sem título"), href: `/app/w/${targetWs}/dm/${convId}`,
  });
  revalidatePath(`/app/w/${targetWs}`, "layout");
  back(p.data.workspaceId, note, "enviada=ok");
}

export async function sendNoteToChannel(form: FormData) {
  const p = Send.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { ctx, note } = await loadNote(p.data.workspaceId, p.data.noteId);
  if (!note) return;
  const [targetWs, channelId] = p.data.to.split(":") as [string, string];
  const ch = await requireChannel(targetWs, channelId); // precisa ver o canal
  if (!(await hit("chatMessage", ctx.user.id))) return back(p.data.workspaceId, note, "enviada=muitas");
  await createNoteShare({ senderId: ctx.user.id, note, workspaceId: targetWs, channelId, text: p.data.text || "" });
  const followers = await db.channelMember.findMany({ where: { channelId, userId: { not: ctx.user.id } }, select: { userId: true } });
  await notify(followers.map((f) => f.userId), {
    workspaceId: targetWs, type: "channel_message", key: `channel:${channelId}`,
    title: `Mensagens novas em #${ch.channel.name}`, body: `${ctx.user.name} enviou a anotação “${snippet(note.title || "Sem título", 60)}”`, href: `/app/w/${targetWs}/c/${channelId}`,
  });
  revalidatePath(`/app/w/${targetWs}`, "layout");
  back(p.data.workspaceId, note, "enviada=ok");
}
