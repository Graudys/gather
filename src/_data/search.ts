import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { teamVisibleTo } from "@/_data/projects.access";
import { eventVisibleTo } from "@/_data/agenda.access";
import { retentionCutoff } from "@/_data/chat";
import { snippet } from "@/_lib/server/notify";

/**
 * Busca no workspace. Cada tipo usa as MESMAS regras de visibilidade das telas:
 * canal privado só para quem está nele, conversa só para quem participa,
 * projeto de equipe privada só para a equipe, evento "só convidados" só para eles.
 */
export async function searchWorkspace(workspaceId: string, raw: string) {
  const { user } = await requireMember(workspaceId);
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return null;
  const has = { contains: q, mode: "insensitive" as const };
  const settings = await db.workspaceSettings.findUnique({ where: { workspaceId }, select: { messageRetentionMonths: true } });

  const [messages, tasks, projects, events, people] = await Promise.all([
    db.message.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        content: has,
        createdAt: { gte: retentionCutoff(settings?.messageRetentionMonths ?? 3) },
        OR: [
          { channel: { OR: [{ visibility: "PUBLIC" }, { members: { some: { userId: user.id } } }] } },
          { conversation: { members: { some: { userId: user.id } } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, content: true, createdAt: true, channelId: true, conversationId: true, parentMessageId: true,
        sender: { select: { name: true } }, channel: { select: { name: true } },
      },
    }),
    db.task.findMany({
      where: { project: { team: { workspaceId, ...teamVisibleTo(user.id) } }, OR: [{ title: has }, { description: has }] },
      take: 15,
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, completedAt: true, project: { select: { id: true, name: true } } },
    }),
    db.project.findMany({
      where: { team: { workspaceId, ...teamVisibleTo(user.id) }, OR: [{ name: has }, { description: has }] },
      take: 10,
      select: { id: true, name: true, status: true },
    }),
    db.calendarEvent.findMany({
      where: { workspaceId, ...eventVisibleTo(user.id), OR: [{ title: has }, { description: has }] },
      orderBy: { startsAt: "desc" },
      take: 10,
      select: { id: true, title: true, startsAt: true },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId, user: { OR: [{ name: has }, { email: has }] } },
      take: 10,
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return {
    q,
    messages: messages.map((m) => {
      const base = m.channelId ? `/app/w/${workspaceId}/c/${m.channelId}` : `/app/w/${workspaceId}/dm/${m.conversationId}`;
      const thread = m.parentMessageId ?? m.id;
      return {
        id: m.id,
        text: snippet(m.content, 160),
        where: m.channel ? `#${m.channel.name}` : "Conversa direta",
        who: m.sender?.name ?? "Pessoa removida",
        at: m.createdAt.toISOString(),
        href: `${base}?thread=${thread}`,
      };
    }),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, done: Boolean(t.completedAt), project: t.project.name, href: `/app/w/${workspaceId}/p/${t.project.id}?tarefa=${t.id}` })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, status: p.status, href: `/app/w/${workspaceId}/p/${p.id}` })),
    events: events.map((e) => ({ id: e.id, title: e.title, at: e.startsAt.toISOString(), href: `/app/w/${workspaceId}/agenda?evento=${e.id}&dia=${e.startsAt.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}` })),
    people: people.map((p) => ({ ...p.user, isMe: p.user.id === user.id })),
  };
}
