import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";

/**
 * Regras de acesso do chat. Toda leitura e escrita de mensagem passa por uma
 * destas funções. Quem não pode ver recebe 404 (sem dizer que existe).
 *
 * - Canal público: qualquer membro do workspace.
 * - Canal privado: só quem está em channel_members.
 * - Conversa direta/grupo: só quem está em conversation_members.
 */

export async function requireChannel(workspaceId: string, channelId: string) {
  const ctx = await requireMember(workspaceId);
  const channel = await db.channel.findFirst({
    where: { id: channelId, workspaceId },
    select: {
      id: true, name: true, description: true, visibility: true, createdById: true,
      members: { where: { userId: ctx.user.id }, select: { role: true } },
    },
  });
  if (!channel) notFound();
  const memberRow = channel.members[0];
  if (channel.visibility === "PRIVATE" && !memberRow) notFound();
  const wsAdmin = ctx.role === "OWNER" || ctx.role === "ADMIN";
  const canManage = wsAdmin || channel.createdById === ctx.user.id || memberRow?.role === "CHANNEL_MODERATOR";
  return { ...ctx, channel, canManage, wsAdmin };
}

export async function requireConversation(workspaceId: string, conversationId: string) {
  const ctx = await requireMember(workspaceId);
  const conv = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId, members: { some: { userId: ctx.user.id } } },
    select: { id: true, kind: true, members: { select: { user: { select: { id: true, name: true } } } } },
  });
  if (!conv) notFound();
  return { ...ctx, conversation: conv, wsAdmin: ctx.role === "OWNER" || ctx.role === "ADMIN" };
}

/** Confere acesso à mensagem pelo lugar onde ela está. Devolve a mensagem e o contexto. */
export async function requireMessage(workspaceId: string, messageId: string) {
  const msg = await db.message.findFirst({
    where: { id: messageId, workspaceId },
    select: { id: true, channelId: true, conversationId: true, senderId: true, parentMessageId: true, deletedAt: true },
  });
  if (!msg) notFound();
  const ctx = msg.channelId
    ? await requireChannel(workspaceId, msg.channelId)
    : await requireConversation(workspaceId, msg.conversationId!);
  return { ...ctx, message: msg };
}
