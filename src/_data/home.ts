import "server-only";
import { db } from "@/_lib/db/prisma";
import { requireMember } from "@/_lib/auth/dal";
import { getWorkspaceShell } from "@/_data/chat";
import { listCalendar } from "@/_data/agenda";
import { listMyTasks, listProjects } from "@/_data/projects";
import { dayWindow } from "@/lib/projects";

/** Tudo da tela Início (mockup "Home"), numa ida só. */
export async function getHome(workspaceId: string) {
  const { user } = await requireMember(workspaceId);
  const { today } = dayWindow();
  const [shell, calendar, tasks, projects, people, events] = await Promise.all([
    getWorkspaceShell(workspaceId),
    listCalendar(workspaceId, today, today),
    listMyTasks(workspaceId),
    listProjects(workspaceId, { status: "ACTIVE" }),
    db.workspaceMember.count({ where: { workspaceId } }),
    db.calendarEvent.count({ where: { workspaceId } }),
  ]);
  const meetings = calendar.flatMap((c) => (c.kind === "event" ? [c] : []));
  const dueToday = tasks.filter((t) => t.dueAt && t.dueAt.slice(0, 10) <= today);
  const unreadChats = [
    ...shell.conversations.filter((c) => c.unread > 0).map((c) => ({ id: c.id, href: `dm/${c.id}`, title: c.title, unread: c.unread, channel: false })),
    ...shell.channels.filter((c) => c.unread > 0).map((c) => ({ id: c.id, href: `c/${c.id}`, title: c.name, unread: c.unread, channel: true })),
  ];
  const steps = [
    { done: shell.channels.length > 1, label: "Criar um canal", href: "novo-canal" },
    { done: people > 1, label: "Chamar pessoas para o workspace", href: "configuracoes" },
    { done: projects.length > 0, label: "Criar o primeiro projeto", href: "projetos?novo=1" },
    { done: events > 0, label: "Marcar um evento na agenda", href: "agenda/novo" },
  ];
  return {
    me: { id: user.id, name: user.name },
    kind: shell.workspace.kind,
    canManage: shell.role !== "MEMBER",
    meetings,
    tasks: tasks.slice(0, 6),
    dueToday: dueToday.length,
    unreadChats: unreadChats.slice(0, 5),
    unreadTotal: unreadChats.reduce((n, c) => n + c.unread, 0),
    projects,
    steps: shell.workspace.kind === "TEAM" ? steps : steps.filter((s) => s.href !== "configuracoes"),
  };
}
