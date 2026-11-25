import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { requireChannel, requireConversation } from "@/_data/chat.access";
import type { ChatMessage, ChatTarget, ChatView, SidebarChannel, SidebarConversation, WorkspaceShell } from "@/types/domain";


export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** Corte da retenção: o que for mais velho que isso já foi (ou vai ser) apagado. */
export function retentionCutoff(months: number, now = new Date()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Barra lateral do workspace: canais visíveis, conversas da pessoa e não lidas. */
export const getWorkspaceShell = cache(async (workspaceId: string): Promise<WorkspaceShell> => {
  const { user, role, workspace } = await requireMember(workspaceId);

  const [workspaces, settings, channelRows, convRows] = await Promise.all([
    db.workspaceMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "asc" },
      select: { workspace: { select: { id: true, name: true, kind: true } } },
    }),
    db.workspaceSettings.findUnique({ where: { workspaceId }, select: { messageRetentionMonths: true, fileRetentionHours: true } }),
    // Não lidas = mensagens principais de outras pessoas depois da última leitura
    // (ou da entrada no workspace, se nunca abriu o canal).
    db.$queryRaw<{ id: string; name: string; visibility: "PUBLIC" | "PRIVATE"; unread: bigint }[]>`
      select c.id, c.name, c.visibility::text as visibility,
             count(m.id) filter (where m.created_at > coalesce(cm.last_read_at, wm.joined_at)) as unread
      from channels c
      join workspace_members wm on wm.workspace_id = c.workspace_id and wm.user_id = ${user.id}::uuid
      left join channel_members cm on cm.channel_id = c.id and cm.user_id = ${user.id}::uuid
      left join messages m on m.channel_id = c.id and m.parent_message_id is null
           and m.deleted_at is null and m.sender_id is distinct from ${user.id}::uuid
      where c.workspace_id = ${workspaceId}::uuid
        and (c.visibility = 'PUBLIC' or cm.user_id is not null)
      group by c.id, c.name, c.visibility
      order by c.name`,
    db.$queryRaw<{ id: string; kind: "DIRECT" | "GROUP"; unread: bigint; last: Date | null }[]>`
      select cv.id, cv.kind::text as kind,
             count(m.id) filter (where m.created_at > coalesce(me.last_read_at, me.joined_at)) as unread,
             max(m.created_at) as last
      from conversations cv
      join conversation_members me on me.conversation_id = cv.id and me.user_id = ${user.id}::uuid
      left join messages m on m.conversation_id = cv.id and m.parent_message_id is null
           and m.deleted_at is null and m.sender_id is distinct from ${user.id}::uuid
      where cv.workspace_id = ${workspaceId}::uuid
      group by cv.id, cv.kind, cv.created_at
      order by coalesce(max(m.created_at), cv.created_at) desc`,
  ]);

  const convMembers = convRows.length
    ? await db.conversationMember.findMany({
        where: { conversationId: { in: convRows.map((c) => c.id) }, userId: { not: user.id } },
        select: { conversationId: true, user: { select: { name: true } } },
      })
    : [];
  const others = new Map<string, string[]>();
  for (const m of convMembers) others.set(m.conversationId, [...(others.get(m.conversationId) ?? []), m.user.name]);

  const channels: SidebarChannel[] = channelRows.map((c) => ({ id: c.id, name: c.name, visibility: c.visibility, unread: Number(c.unread) }));
  const conversations: SidebarConversation[] = convRows.map((c) => {
    const names = others.get(c.id) ?? [];
    const title = c.kind === "DIRECT" ? (names[0] ?? "Só você") : names.map(firstName).join(", ") || "Só você";
    return { id: c.id, kind: c.kind, title, initials: initials(names.length === 1 ? names[0]! : title), unread: Number(c.unread) };
  });

  return {
    workspace: { id: workspace.id, name: workspace.name, kind: workspace.kind },
    role,
    me: { id: user.id, name: user.name },
    workspaces: workspaces.map((w) => w.workspace),
    channels,
    conversations,
    retention: { messageMonths: settings?.messageRetentionMonths ?? 3, fileHours: settings?.fileRetentionHours ?? 24 },
  };
});

const messageSelect = {
    id: true,
    content: true,
    createdAt: true,
    editedAt: true,
    deletedAt: true,
    senderId: true,
    sender: { select: { id: true, name: true } },
    reactions: { select: { emoji: true, userId: true } },
    _count: { select: { replies: { where: { deletedAt: null } } } },
} as const;

type Row = {
  id: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  senderId: string | null;
  sender: { id: string; name: string } | null;
  reactions: { emoji: string; userId: string }[];
  _count: { replies: number };
};

function toView(m: Row, me: string, wsAdmin: boolean): ChatMessage {
  const byEmoji = new Map<string, { count: number; mine: boolean }>();
  for (const r of m.reactions) {
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    byEmoji.set(r.emoji, { count: cur.count + 1, mine: cur.mine || r.userId === me });
  }
  const deleted = Boolean(m.deletedAt);
  return {
    id: m.id,
    // Mensagem apagada não manda o texto para o navegador.
    content: deleted ? "" : m.content,
    createdAt: m.createdAt.toISOString(),
    edited: Boolean(m.editedAt) && !deleted,
    deleted,
    sender: m.sender,
    replyCount: m._count.replies,
    reactions: deleted ? [] : [...byEmoji].map(([emoji, v]) => ({ emoji, ...v })),
    canEdit: !deleted && m.senderId === me,
    canDelete: !deleted && (m.senderId === me || wsAdmin),
  };
}

/** Conversa aberta (canal ou direta) com as últimas mensagens e, se pedido, a thread. */
export async function getChatView(
  workspaceId: string,
  target: ChatTarget,
  opts: { threadId?: string; limit?: number } = {},
): Promise<ChatView> {
  const { threadId } = opts;
  const PAGE = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const isChannel = target.kind === "channel";
  const ctx = isChannel ? await requireChannel(workspaceId, target.id) : await requireConversation(workspaceId, target.id);
  const me = ctx.user.id;
  const where = isChannel ? { channelId: target.id } : { conversationId: target.id };

  // O layout já buscou a barra lateral nesta requisição (cache): o prazo vem de lá, sem outra consulta.
  const shell = await getWorkspaceShell(workspaceId);
  const cutoff = retentionCutoff(shell.retention.messageMonths);

  const rows = await db.message.findMany({
    where: { ...where, workspaceId, parentMessageId: null, createdAt: { gte: cutoff } },
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    select: messageSelect,
  });
  const hasMore = rows.length > PAGE;
  const messages = rows.slice(0, PAGE).reverse().map((m) => toView(m, me, ctx.wsAdmin));

  let thread: ChatView["thread"] = null;
  if (threadId) {
    const parent = await db.message.findFirst({ where: { id: threadId, ...where, workspaceId, parentMessageId: null }, select: messageSelect });
    if (parent) {
      const replies = await db.message.findMany({
        where: { parentMessageId: parent.id, workspaceId },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: messageSelect,
      });
      thread = { parent: toView(parent, me, ctx.wsAdmin), replies: replies.map((r) => toView(r, me, ctx.wsAdmin)) };
    }
  }

  let title: string;
  let description: string | null = null;
  let members: { id: string; name: string }[];
  let canManage = false;
  let visibility: "PUBLIC" | "PRIVATE" | undefined;
  if ("channel" in ctx) {
    title = ctx.channel.name;
    description = ctx.channel.description;
    visibility = ctx.channel.visibility;
    canManage = ctx.canManage;
    members =
      ctx.channel.visibility === "PRIVATE"
        ? (await db.channelMember.findMany({ where: { channelId: target.id }, select: { user: { select: { id: true, name: true } } } })).map((m) => m.user)
        : (await db.workspaceMember.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true } } } })).map((m) => m.user);
  } else {
    members = ctx.conversation.members.map((m: { user: { id: string; name: string } }) => m.user);
    const others = members.filter((m) => m.id !== me);
    title = others.length ? others.map((o) => (others.length > 1 ? firstName(o.name) : o.name)).join(", ") : "Só você";
  }

  // Marca como lido depois de responder (não atrasa a página).
  after(() => markRead(target, me));

  return { target, title, description, visibility, members, canManage, messages, hasMore, cutoff: cutoff.toISOString(), thread };
}

/** Grava a última leitura. Só chamado depois de requireChannel/requireConversation. */
async function markRead(target: ChatTarget, userId: string) {
  const now = new Date();
  try {
    if (target.kind === "channel") {
      await db.channelMember.upsert({
        where: { channelId_userId: { channelId: target.id, userId } },
        create: { channelId: target.id, userId, lastReadAt: now },
        update: { lastReadAt: now },
      });
    } else {
      await db.conversationMember.update({ where: { conversationId_userId: { conversationId: target.id, userId } }, data: { lastReadAt: now } });
    }
  } catch {
    // Ler não pode quebrar a página.
  }
}

/** Pessoas do workspace (para nova conversa e para adicionar em canal privado). */
export async function listWorkspacePeople(workspaceId: string) {
  const { user } = await requireMember(workspaceId);
  const rows = await db.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { user: { name: "asc" } },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => ({ ...r.user, isMe: r.user.id === user.id }));
}

/** Primeiro canal visível (para abrir o workspace direto numa conversa). */
export async function firstChannelId(workspaceId: string) {
  const { user } = await requireMember(workspaceId);
  const c = await db.channel.findFirst({
    where: { workspaceId, OR: [{ visibility: "PUBLIC" }, { members: { some: { userId: user.id } } }] },
    orderBy: [{ visibility: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  return c?.id ?? null;
}
