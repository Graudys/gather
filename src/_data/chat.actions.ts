"use server";
import { redirect } from "next/navigation";
import { removeUnusedImages } from "@/_lib/server/note-share";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { requireChannel, requireConversation, requireMessage } from "@/_data/chat.access";
import { id as Id, textoMensagem } from "@/lib/validation";
import { hit } from "@/_lib/server/rate-limit";
import { REACTIONS } from "@/lib/chat";
import { isChatIcon } from "@/lib/chat-icons";
import { extractHandles, handleOf } from "@/lib/mentions";
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
  const place = "channel" in ctx ? `#${ctx.channel.name}` : "uma conversa";

  // @menções: só quem pode ver este lugar (canal privado → membros dele; conversa → quem está nela).
  const handles = content ? extractHandles(content) : [];
  let mentioned: string[] = [];
  if (handles.length) {
    const candidates =
      "channel" in ctx
        ? ctx.channel.visibility === "PRIVATE"
          ? (await db.channelMember.findMany({ where: { channelId: ctx.channel.id }, select: { user: { select: { id: true, name: true, username: true } } } })).map((m) => m.user)
          : (await db.workspaceMember.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true, username: true } } } })).map((m) => m.user)
        : ctx.conversation.members.map((m) => m.user);
    mentioned = candidates.filter((u) => u.id !== ctx.user.id && handles.includes(handleOf(u))).map((u) => u.id);
    await notify(mentioned, {
      workspaceId, type: "mention", key: `mention:${channelId || conversationId}`,
      title: `${ctx.user.name} mencionou você em ${place}`, body: snippet(preview), href: parentId ? `${base}?thread=${parentId}` : base,
    });
  }

  if (parentId) {
    const involved = await db.message.findMany({
      where: { OR: [{ id: parentId }, { parentMessageId: parentId }], senderId: { not: null } },
      select: { senderId: true },
      distinct: ["senderId"],
    });
    await notify(involved.map((m) => m.senderId!).filter((u) => u !== ctx.user.id && !mentioned.includes(u)), {
      workspaceId, type: "thread", key: `thread:${parentId}`,
      title: `${ctx.user.name} respondeu numa thread`, body: snippet(preview), href: `${base}?thread=${parentId}`,
    });
  } else if (conversationId) {
    const others = await db.conversationMember.findMany({ where: { conversationId, userId: { not: ctx.user.id } }, select: { userId: true } });
    await notify(others.map((o) => o.userId).filter((u) => !mentioned.includes(u)), {
      workspaceId, type: "dm", key: `dm:${conversationId}`,
      title: `Mensagem de ${ctx.user.name}`, body: snippet(preview), href: base,
    });
  } else if (channelId) {
    // Canal: quem acompanha (abriu ou foi adicionado). Junta num aviso por canal
    // enquanto não lido ("4 mensagens novas em #geral"). Dá para desligar em Perfil.
    const followers = await db.channelMember.findMany({ where: { channelId, userId: { not: ctx.user.id } }, select: { userId: true } });
    await notify(followers.map((f) => f.userId).filter((u) => !mentioned.includes(u)), {
      workspaceId, type: "channel_message", key: `channel:${channelId}`,
      title: `Mensagens novas em ${place}`, body: `${ctx.user.name}: ${snippet(preview, 70)}`, href: base,
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
  const sharedImgs = await db.sharedNoteImage.findMany({ where: { sharedNote: { messageId: ctx.message.id } }, select: { storagePath: true } });
  await db.$transaction([
    db.messageReaction.deleteMany({ where: { messageId: ctx.message.id } }),
    db.messageAttachment.deleteMany({ where: { messageId: ctx.message.id } }),
    db.sharedNote.deleteMany({ where: { messageId: ctx.message.id } }), // cartão de anotação vai junto
    // Apagada também sai das fixadas.
    db.message.update({ where: { id: ctx.message.id }, data: { content: "", deletedAt: new Date(), pinnedAt: null, pinnedById: null } }),
  ]);
  await removeObjects(files.map((f) => f.storagePath));
  await removeUnusedImages(sharedImgs.map((i) => i.storagePath));
  refresh(p.data.workspaceId);
}

/** No máximo tantas fixadas por canal (a lista do topo precisa caber). */
const MAX_PINS = 30;

/**
 * Fixar/desafixar no topo do canal. Quem gerencia o canal (dono/admin do
 * workspace, quem criou, moderador). Só mensagem principal de canal (não thread,
 * não conversa direta). Fixada não some pelo prazo das mensagens.
 */
export async function togglePin(input: { workspaceId: unknown; messageId: unknown }) {
  const p = z.object({ workspaceId: Id, messageId: Id }).safeParse(input);
  if (!p.success) return { ok: false as const };
  const ctx = await requireMessage(p.data.workspaceId, p.data.messageId);
  if (!("channel" in ctx) || !ctx.canManage) return { ok: false as const };
  const m = await db.message.findUniqueOrThrow({ where: { id: ctx.message.id }, select: { pinnedAt: true, deletedAt: true, parentMessageId: true, channelId: true } });
  if (m.deletedAt || m.parentMessageId) return { ok: false as const };
  if (!m.pinnedAt && (await db.message.count({ where: { channelId: m.channelId, pinnedAt: { not: null } } })) >= MAX_PINS) return { ok: false as const, error: "limite" };
  await db.message.update({ where: { id: ctx.message.id }, data: m.pinnedAt ? { pinnedAt: null, pinnedById: null } : { pinnedAt: new Date(), pinnedById: ctx.user.id } });
  refresh(p.data.workspaceId);
  return { ok: true as const, pinned: !m.pinnedAt };
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
      icon: isChatIcon(form.get("icon")) ? (form.get("icon") as string) : null,
      createdById: user.id,
      members: { create: { userId: user.id, role: "CHANNEL_MODERATOR", lastReadAt: new Date() } },
    },
    select: { id: true },
  });
  refresh(workspaceId);
  redirect(`/app/w/${workspaceId}/c/${ch.id}`);
}

const ChannelRef = z.object({ workspaceId: Id, channelId: Id });

/**
 * Ordem dos canais na lista: uma só, igual para todo mundo do workspace.
 * Só dono e admins mudam (no espaço pessoal, a dona/o dono). Recebe a lista
 * inteira na ordem nova; só grava canais deste workspace.
 */
export async function reorderChannels(input: { workspaceId: unknown; ids: unknown }) {
  const p = z.object({ workspaceId: Id, ids: z.array(Id).min(1).max(300) }).safeParse(input);
  if (!p.success) return { ok: false };
  const { user } = await requireMember(p.data.workspaceId, ["OWNER", "ADMIN"]);
  if (!(await hit("chatIcon", `order:${user.id}`))) return { ok: false };
  const mine = await db.channel.findMany({ where: { id: { in: p.data.ids }, workspaceId: p.data.workspaceId }, select: { id: true } });
  const ok = new Set(mine.map((v) => v.id));
  const ids = [...new Set(p.data.ids)].filter((id) => ok.has(id));
  await db.$transaction(ids.map((id, i) => db.channel.update({ where: { id }, data: { position: i } })));
  refresh(p.data.workspaceId);
  return { ok: true };
}

/**
 * Ícone do canal ou do grupo. Só emojis da lista fechada (src/lib/chat-icons.ts);
 * vazio volta para o # (ou cadeado). Canal: quem gerencia. Grupo: qualquer membro.
 * Conversa direta não tem ícone (mostra a foto da pessoa).
 */
export async function setChatIcon(input: { workspaceId: unknown; kind: unknown; id: unknown; icon: unknown }) {
  const p = z.object({ workspaceId: Id, kind: z.enum(["channel", "dm"]), id: Id }).safeParse(input);
  if (!p.success) return { ok: false };
  const icon = input.icon === null || input.icon === "" ? null : isChatIcon(input.icon) ? input.icon : undefined;
  if (icon === undefined) return { ok: false };
  if (!(await hit("chatIcon", `${p.data.workspaceId}:${p.data.id}`))) return { ok: false };
  if (p.data.kind === "channel") {
    const ctx = await requireChannel(p.data.workspaceId, p.data.id);
    if (!ctx.canManage) return { ok: false };
    await db.channel.update({ where: { id: ctx.channel.id }, data: { icon } });
  } else {
    const ctx = await requireConversation(p.data.workspaceId, p.data.id);
    if (ctx.conversation.kind !== "GROUP") return { ok: false };
    await db.conversation.update({ where: { id: ctx.conversation.id }, data: { icon } });
  }
  refresh(p.data.workspaceId);
  return { ok: true };
}

export async function updateChannel(form: FormData) {
  const p = ChannelRef.extend({ name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return;
  const ctx = await requireChannel(p.data.workspaceId, p.data.channelId);
  if (!ctx.canManage) return;
  const name = channelSlug(p.data.name);
  if (!name) return;
  const clash = await db.channel.findFirst({ where: { workspaceId: p.data.workspaceId, name, id: { not: ctx.channel.id } }, select: { id: true } });
  if (clash) return;
  // Ícone: só da lista; "" = volta para o #. Sem o campo no formulário, não mexe.
  const rawIcon = form.get("icon");
  const icon = rawIcon === null ? undefined : rawIcon === "" ? null : isChatIcon(rawIcon) ? rawIcon : undefined;
  await db.channel.update({ where: { id: ctx.channel.id }, data: { name, description: p.data.description || null, ...(icon !== undefined ? { icon } : {}) } });
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
