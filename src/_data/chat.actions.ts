"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { requireChannel, requireConversation, requireMessage } from "@/_data/chat.access";
import { id as Id, textoMensagem } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { REACTIONS } from "@/lib/chat";
import { notify, snippet } from "@/_lib/server/notify";
import { landFiles } from "@/_data/files.server";
import { removeObjects } from "@/_lib/server/storage";

/**
 * Ações do chat. Cada uma confere o acesso com chat.access.ts antes de escrever.
 * Os ids que vêm do formulário nunca são usados sem essa conferência.
 */

const refresh = (workspaceId: string) => revalidatePath(`/app/w/${workspaceId}`, "layout");

const Send = z.object({
  workspaceId: Id,
  channelId: z.union([Id, z.literal("")]).optional(),
  conversationId: z.union([Id, z.literal("")]).optional(),
  parentId: z.union([Id, z.literal("")]).optional(),
  content: z.union([textoMensagem, z.literal("")]).default(""),
});

export async function sendMessage(form: FormData) {
  const p = Send.safeParse({ ...Object.fromEntries(form), content: String(form.get("content") ?? "").trim() });
  if (!p.success) return;
  const { workspaceId, channelId, conversationId, parentId, content } = p.data;
  if (Boolean(channelId) === Boolean(conversationId)) return; // exatamente um dos dois
  const tickets = form.getAll("files").map(String).filter(Boolean);
  if (!content && !tickets.length) return; // mensagem vazia sem arquivo

  const ctx = channelId ? await requireChannel(workspaceId, channelId) : await requireConversation(workspaceId, conversationId!);
  if (!(await hit("chatMessage", ctx.user.id))) return;
  const files = tickets.length
    ? await landFiles(tickets, { w: workspaceId, u: ctx.user.id, d: channelId ? `c:${channelId}` : `dm:${conversationId}` }, "m")
    : [];
  if (!content && !files.length) return;

  if (parentId) {
    // A resposta precisa ficar no mesmo lugar da mensagem principal, e só um nível de thread.
    const parent = await db.message.findFirst({
      where: { id: parentId, workspaceId, parentMessageId: null, deletedAt: null, ...(channelId ? { channelId } : { conversationId }) },
      select: { id: true },
    });
    if (!parent) return;
  }

  await db.message.create({
    data: {
      workspaceId,
      channelId: channelId || null,
      conversationId: conversationId || null,
      parentMessageId: parentId || null,
      senderId: ctx.user.id,
      content,
      attachments: { create: files.map((f) => ({ storagePath: f.path, fileName: f.name, mimeType: f.mime, sizeBytes: BigInt(f.size), createdById: ctx.user.id })) },
    },
  });
  const preview = content || (files.length === 1 ? `Arquivo: ${files[0]!.name}` : `${files.length} arquivos`);

  // Avisos: conversa direta → as outras pessoas; resposta em thread → quem escreveu a principal e quem já respondeu.
  const base = channelId ? `/app/w/${workspaceId}/c/${channelId}` : `/app/w/${workspaceId}/dm/${conversationId}`;
  if (parentId) {
    const involved = await db.message.findMany({
      where: { OR: [{ id: parentId }, { parentMessageId: parentId }], senderId: { not: null } },
      select: { senderId: true },
      distinct: ["senderId"],
    });
    await notify(involved.map((m) => m.senderId!).filter((u) => u !== ctx.user.id), {
      workspaceId, type: "thread", key: `thread:${parentId}`,
      title: `${ctx.user.name} respondeu numa thread`, body: snippet(preview), href: `${base}?thread=${parentId}`,
    });
  } else if (conversationId) {
    const others = await db.conversationMember.findMany({ where: { conversationId, userId: { not: ctx.user.id } }, select: { userId: true } });
    await notify(others.map((o) => o.userId), {
      workspaceId, type: "dm", key: `dm:${conversationId}`,
      title: `Mensagem de ${ctx.user.name}`, body: snippet(preview), href: base,
    });
  }
  refresh(workspaceId);
}

export async function editMessage(form: FormData) {
  const p = z.object({ workspaceId: Id, messageId: Id, content: textoMensagem }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMessage(p.data.workspaceId, p.data.messageId);
  // Só quem escreveu edita.
  if (ctx.message.senderId !== ctx.user.id || ctx.message.deletedAt) return;
  await db.message.update({ where: { id: ctx.message.id }, data: { content: p.data.content, editedAt: new Date() } });
  refresh(p.data.workspaceId);
}

export async function deleteMessage(form: FormData) {
  const p = z.object({ workspaceId: Id, messageId: Id }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMessage(p.data.workspaceId, p.data.messageId);
  // Quem escreveu, ou dono/admin do workspace (moderação).
  if (ctx.message.deletedAt || (ctx.message.senderId !== ctx.user.id && !ctx.wsAdmin)) return;
  // Apaga o texto de verdade: a linha fica só para manter a thread de pé.
  const files = await db.messageAttachment.findMany({ where: { messageId: ctx.message.id }, select: { storagePath: true } });
  await db.$transaction([
    db.messageReaction.deleteMany({ where: { messageId: ctx.message.id } }),
    db.messageAttachment.deleteMany({ where: { messageId: ctx.message.id } }),
    db.message.update({ where: { id: ctx.message.id }, data: { content: "", deletedAt: new Date() } }),
  ]);
  await removeObjects(files.map((f) => f.storagePath));
  refresh(p.data.workspaceId);
}

export async function toggleReaction(form: FormData) {
  const p = z.object({ workspaceId: Id, messageId: Id, emoji: z.enum(REACTIONS) }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireMessage(p.data.workspaceId, p.data.messageId);
  if (ctx.message.deletedAt) return;
  const key = { messageId_userId_emoji: { messageId: ctx.message.id, userId: ctx.user.id, emoji: p.data.emoji } };
  const existing = await db.messageReaction.findUnique({ where: key });
  if (existing) await db.messageReaction.delete({ where: key });
  else await db.messageReaction.create({ data: { messageId: ctx.message.id, userId: ctx.user.id, emoji: p.data.emoji } });
  refresh(p.data.workspaceId);
}

// ── Canais

/** "Produto Novo!" → "produto-novo". Acentos viram letra simples. */
function channelSlug(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const NewChannel = z.object({
  workspaceId: Id,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

export async function createChannel(form: FormData) {
  const p = NewChannel.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const { workspaceId, description, visibility } = p.data;
  const { user, workspace } = await requireMember(workspaceId);
  const back = `/app/w/${workspaceId}?novo=canal`;
  const name = channelSlug(p.data.name);
  if (!name) redirect(`${back}&erro=nome`);
  if (await db.channel.findFirst({ where: { workspaceId, name }, select: { id: true } })) redirect(`${back}&erro=existe`);
  const ch = await db.channel.create({
    data: {
      workspaceId,
      name,
      description: description || null,
      // No espaço pessoal só existe você: o canal fica privado.
      visibility: workspace.kind === "PERSONAL" ? "PRIVATE" : visibility,
      createdById: user.id,
      members: { create: { userId: user.id, role: "CHANNEL_MODERATOR", lastReadAt: new Date() } },
    },
    select: { id: true },
  });
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/c/${ch.id}`);
}

const ChannelRef = z.object({ workspaceId: Id, channelId: Id });

export async function updateChannel(form: FormData) {
  const p = ChannelRef.extend({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireChannel(p.data.workspaceId, p.data.channelId);
  if (!ctx.canManage) return;
  const name = channelSlug(p.data.name);
  if (!name) return;
  const clash = await db.channel.findFirst({ where: { workspaceId: p.data.workspaceId, name, id: { not: ctx.channel.id } }, select: { id: true } });
  if (clash) return;
  await db.channel.update({ where: { id: ctx.channel.id }, data: { name, description: p.data.description || null } });
  refresh(p.data.workspaceId);
}

export async function addChannelMembers(form: FormData) {
  const p = ChannelRef.extend({ userIds: z.array(Id).min(1).max(50) }).safeParse({
    workspaceId: form.get("workspaceId"),
    channelId: form.get("channelId"),
    userIds: form.getAll("userIds"),
  });
  if (!p.success) return;
  const ctx = await requireChannel(p.data.workspaceId, p.data.channelId);
  if (!ctx.canManage || ctx.channel.visibility !== "PRIVATE") return;
  // Só entra quem é do workspace.
  const valid = await db.workspaceMember.findMany({
    where: { workspaceId: p.data.workspaceId, userId: { in: p.data.userIds } },
    select: { userId: true },
  });
  await db.channelMember.createMany({
    data: valid.map((v) => ({ channelId: ctx.channel.id, userId: v.userId })),
    skipDuplicates: true,
  });
  refresh(p.data.workspaceId);
}

export async function leaveChannel(form: FormData) {
  const p = ChannelRef.safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireChannel(p.data.workspaceId, p.data.channelId);
  if (ctx.channel.visibility !== "PRIVATE") return;
  await db.channelMember.deleteMany({ where: { channelId: ctx.channel.id, userId: ctx.user.id } });
  refresh(p.data.workspaceId);
  redirect(`/app/w/${p.data.workspaceId}`);
}

export async function deleteChannel(form: FormData) {
  const p = ChannelRef.extend({ confirm: z.string() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireChannel(p.data.workspaceId, p.data.channelId);
  if (!ctx.canManage || p.data.confirm !== ctx.channel.name) return;
  const files = await db.messageAttachment.findMany({ where: { message: { channelId: ctx.channel.id } }, select: { storagePath: true } });
  await db.channel.delete({ where: { id: ctx.channel.id } }); // mensagens vão junto (cascade)
  await removeObjects(files.map((f) => f.storagePath));
  refresh(p.data.workspaceId);
  redirect(`/app/w/${p.data.workspaceId}`);
}

// ── Conversas diretas e em grupo

export async function startConversation(form: FormData) {
  const p = z.object({ workspaceId: Id, userIds: z.array(Id).min(1).max(8) }).safeParse({
    workspaceId: form.get("workspaceId"),
    userIds: form.getAll("userIds"),
  });
  if (!p.success) return;
  const { workspaceId } = p.data;
  const { user } = await requireMember(workspaceId);
  const wanted = [...new Set(p.data.userIds.filter((u) => u !== user.id))];
  if (!wanted.length) return;
  const valid = await db.workspaceMember.findMany({ where: { workspaceId, userId: { in: wanted } }, select: { userId: true } });
  if (valid.length !== wanted.length) return;

  const everyone = [user.id, ...wanted].sort();
  const id = await db.$transaction(async (tx) => {
    // Trava pelo grupo de pessoas: dois cliques não criam duas conversas iguais.
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`conv:${workspaceId}:${everyone.join(",")}`}))`;
    // Já existe uma conversa com exatamente estas pessoas? Reabre.
    const candidates = await tx.conversation.findMany({
      where: { workspaceId, kind: wanted.length === 1 ? "DIRECT" : "GROUP", members: { some: { userId: user.id } } },
      select: { id: true, members: { select: { userId: true } } },
    });
    const same = candidates.find((c) => c.members.map((m) => m.userId).sort().join(",") === everyone.join(","));
    if (same) return same.id;
    const conv = await tx.conversation.create({
      data: {
        workspaceId,
        kind: wanted.length === 1 ? "DIRECT" : "GROUP",
        createdById: user.id,
        members: { create: everyone.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    return conv.id;
  });
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/dm/${id}`);
}
