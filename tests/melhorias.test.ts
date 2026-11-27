import "./helpers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setSessionUser } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { createTeamWorkspaceFor, ensurePersonalWorkspace } from "@/_data/workspaces.server";
import { createProject, deleteProject, updateProject } from "@/_data/projects.actions";
import { updateWorkspace } from "@/_data/members.actions";
import { readNotification, recentNotifications } from "@/_data/notifications.actions";
import { setChatIcon, createChannel, sendMessage, reorderChannels } from "@/_data/chat.actions";
import { toggleTaskDone } from "@/_data/projects.actions";
import { runEventReminders } from "@/_lib/server/reminders";
import { extractHandles, handleOf } from "@/lib/mentions";
import { runDeadlineNotices } from "@/_lib/server/deadlines";
import { runNoteExpiryNotices } from "@/_lib/server/notes-expiry";
import { getNotesView, notesInWarning } from "@/_data/notes";
import { createNote, deleteNotebook, deleteWarnedNotes, keepWarnedNotes, saveNote, setNoteRetention } from "@/_data/notes.actions";
import { dueState } from "@/lib/projects";
import { noteState } from "@/lib/notes";

const ana = randomUUID();
const bia = randomUUID();
let team = "";
let pessoal = "";
let pessoalBia = "";
let projectId = "";
let statusId = "";
const as = (id: string) => setSessionUser({ id });
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
};
/** Ações que terminam em redirect: devolve para onde iriam. */
const go = async (p: Promise<unknown>) => {
  try {
    await p;
    return "";
  } catch (e) {
    return (e as { to?: string }).to ?? "";
  }
};
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

beforeAll(async () => {
  for (const id of [ana, bia]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(ana, "Melhorias");
  if (!r.ok) throw new Error("setup");
  team = r.id;
  await db.workspaceMember.create({ data: { workspaceId: team, userId: bia, role: "MEMBER" } });
  pessoal = await ensurePersonalWorkspace(ana, "Ana");
  pessoalBia = await ensurePersonalWorkspace(bia, "Bia");
  as(ana);
  const url = await go(createProject(form({ workspaceId: team, name: "Prazos", teamId: "" })));
  projectId = url.split("/p/")[1]!.split("?")[0]!;
  statusId = (await db.taskStatus.findFirstOrThrow({ where: { projectId }, orderBy: { position: "asc" } })).id;
});
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [ana, bia] } } });
  await db.user.deleteMany({ where: { id: { in: [ana, bia] } } });
});

describe("sino", () => {
  it("lista os recentes e marca como lido na hora", async () => {
    const n = await db.notification.create({ data: { userId: ana, type: "dm", title: "Oi", payload: { href: "/app/w/x/dm/y" } } });
    as(ana);
    const before = await recentNotifications();
    expect(before.unread).toBeGreaterThan(0);
    expect(before.items[0]?.id).toBe(n.id); // não lidas primeiro
    expect(await readNotification(n.id)).toEqual({ href: "/app/w/x/dm/y" });
    expect((await db.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).not.toBeNull();
  });

  it("não abre aviso de outra pessoa nem link para fora", async () => {
    const n = await db.notification.create({ data: { userId: bia, type: "dm", title: "Só da Bia", payload: { href: "https://atacante.com" } } });
    as(ana);
    expect(await readNotification(n.id)).toEqual({ href: "/app/notificacoes" });
    expect((await db.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).toBeNull();
    as(bia);
    expect(await readNotification(n.id)).toEqual({ href: "/app" });
  });
});

describe("prazos", () => {
  it("situação do prazo no fuso de SP", () => {
    const now = new Date("2026-11-26T15:00:00Z");
    expect(dueState("2026-11-25T15:00:00Z", false, now)).toBe("late");
    expect(dueState("2026-11-26T15:00:00Z", false, now)).toBe("today");
    expect(dueState("2026-11-27T15:00:00Z", false, now)).toBe("tomorrow");
    expect(dueState("2026-11-30T15:00:00Z", false, now)).toBe("ok");
    expect(dueState("2026-11-25T15:00:00Z", true, now)).toBe("done");
  });

  it("avisa atrasada e vence amanhã uma vez só, para quem está responsável", async () => {
    const late = await db.task.create({ data: { projectId, statusId, title: "Atrasada", position: "b", createdById: ana, dueAt: ago(3), assignees: { create: { userId: bia } } } });
    const soon = await db.task.create({ data: { projectId, statusId, title: "Amanhã", position: "c", createdById: ana, dueAt: new Date(Date.now() + DAY) } });
    await runDeadlineNotices();
    await runDeadlineNotices(); // não repete
    const biaN = await db.notification.findMany({ where: { userId: bia, type: "task_overdue" } });
    expect(biaN.filter((n) => (n.payload as { href: string }).href.includes(late.id))).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: ana, type: "task_overdue", payload: { path: ["href"], string_contains: late.id } } })).toBe(0);
    const anaSoon = await db.notification.findMany({ where: { userId: ana, type: "task_due_soon" } });
    expect(anaSoon.filter((n) => (n.payload as { href: string }).href.includes(soon.id))).toHaveLength(1);
  });

  it("tarefa concluída não avisa", async () => {
    const done = await db.task.create({ data: { projectId, statusId, title: "Feita", position: "d", createdById: ana, dueAt: ago(2), completedAt: new Date() } });
    await runDeadlineNotices();
    expect(await db.notification.count({ where: { payload: { path: ["href"], string_contains: done.id } } })).toBe(0);
  });
});

describe("ícones", () => {
  it("só emojis da lista e só quem gerencia o canal", async () => {
    as(ana);
    await go(createChannel(form({ workspaceId: team, name: "ideias", visibility: "PUBLIC", icon: "💡" })));
    const ch = await db.channel.findFirstOrThrow({ where: { workspaceId: team, name: "ideias" } });
    expect(ch.icon).toBe("💡");
    expect(await setChatIcon({ workspaceId: team, kind: "channel", id: ch.id, icon: "<script>" })).toEqual({ ok: false });
    as(bia);
    expect(await setChatIcon({ workspaceId: team, kind: "channel", id: ch.id, icon: "🚀" })).toEqual({ ok: false });
    as(ana);
    expect(await setChatIcon({ workspaceId: team, kind: "channel", id: ch.id, icon: "🚀" })).toEqual({ ok: true });
    expect(await setChatIcon({ workspaceId: team, kind: "channel", id: ch.id, icon: null })).toEqual({ ok: true });
    expect((await db.channel.findUniqueOrThrow({ where: { id: ch.id } })).icon).toBeNull();
  });
});

describe("notas", () => {
  it("espaço pessoal nasce com o caderno fixo Anotações", async () => {
    as(ana);
    const v = await getNotesView(pessoal);
    expect(v.notebooks[0]).toMatchObject({ name: "Anotações", isDefault: true });
    expect(v.months).toBe(12);
  });

  it("caderno fixo não pode ser apagado", async () => {
    as(ana);
    const nb = await db.notebook.findFirstOrThrow({ where: { workspaceId: pessoal, isDefault: true } });
    await go(deleteNotebook(form({ workspaceId: pessoal, notebookId: nb.id, confirm: "APAGAR" })));
    expect(await db.notebook.count({ where: { id: nb.id } })).toBe(1);
  });

  it("outra pessoa não vê nem edita as notas", async () => {
    as(ana);
    const nb = await db.notebook.findFirstOrThrow({ where: { workspaceId: pessoal, isDefault: true } });
    const url = await go(createNote(form({ workspaceId: pessoal, notebookId: nb.id })));
    const noteId = url.split("n=")[1]!;
    expect(await saveNote({ workspaceId: pessoal, noteId, title: "Diário", content: "hoje" })).toMatchObject({ ok: true });
    as(bia);
    await expect(getNotesView(pessoal)).rejects.toThrow();
    await expect(saveNote({ workspaceId: pessoal, noteId, title: "x", content: "x" })).rejects.toThrow();
    // nem pelo espaço dela, com o id da nota da Ana
    expect(await saveNote({ workspaceId: pessoalBia, noteId, title: "x", content: "x" })).toEqual({ ok: false });
    expect((await db.note.findUniqueOrThrow({ where: { id: noteId } })).title).toBe("Diário");
  });

  it("notas não existem em workspace de equipe", async () => {
    as(ana);
    await expect(getNotesView(team)).rejects.toThrow();
  });

  it("prazo mínimo de 1 ano; opções fechadas", async () => {
    as(ana);
    await go(setNoteRetention(form({ workspaceId: pessoal, months: "6" })));
    expect((await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: pessoal } })).noteRetentionMonths).toBe(12);
    await go(setNoteRetention(form({ workspaceId: pessoal, months: "24" })));
    expect((await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: pessoal } })).noteRetentionMonths).toBe(24);
    await go(setNoteRetention(form({ workspaceId: pessoal, months: "12" })));
  });

  it("avisa antes de vencer, nunca apaga sozinho, e mantém ou apaga só com confirmação", async () => {
    const nb = await db.notebook.findFirstOrThrow({ where: { workspaceId: pessoal, isDefault: true } });
    const velha = await db.note.create({ data: { workspaceId: pessoal, notebookId: nb.id, createdById: ana, title: "Velha", updatedAt: ago(400) } });
    const quase = await db.note.create({ data: { workspaceId: pessoal, notebookId: nb.id, createdById: ana, title: "Quase", updatedAt: ago(350) } });
    expect(noteState(ago(400), null, 12)).toBe("expired");
    expect(noteState(ago(350), null, 12)).toBe("expiring");

    expect(await runNoteExpiryNotices({ workspaceId: pessoal })).toBe(2);
    expect(await runNoteExpiryNotices({ workspaceId: pessoal })).toBe(0); // avisa uma vez
    const n = await db.notification.findFirstOrThrow({ where: { userId: ana, type: "note_expiring" } });
    expect((n.payload as { href: string }).href).toBe(`/app/w/${pessoal}/notas?vencendo=1`);

    // A rotina diária não apaga nada.
    expect(await db.note.count({ where: { id: { in: [velha.id, quase.id] } } })).toBe(2);

    as(ana);
    await go(keepWarnedNotes(form({ workspaceId: pessoal })));
    expect(await notesInWarning(pessoal, 12)).toHaveLength(0);

    // Volta a vencer e agora a pessoa apaga, digitando APAGAR.
    await db.note.updateMany({ where: { id: { in: [velha.id, quase.id] } }, data: { keepUntil: null } });
    await go(deleteWarnedNotes(form({ workspaceId: pessoal, confirm: "apagar" })));
    expect(await db.note.count({ where: { id: { in: [velha.id, quase.id] } } })).toBe(2);
    await go(deleteWarnedNotes(form({ workspaceId: pessoal, confirm: "APAGAR" })));
    expect(await db.note.count({ where: { id: { in: [velha.id, quase.id] } } })).toBe(0);
  });
});

describe("Minha rotina", () => {
  it("espaço pessoal tem o projeto fixo, que não apaga nem arquiva", async () => {
    const pr = await db.project.findFirstOrThrow({ where: { isFixed: true, team: { workspaceId: pessoal } } });
    expect(pr.name).toBe("Minha rotina");
    as(ana);
    await go(deleteProject(form({ workspaceId: pessoal, projectId: pr.id, confirm: "Minha rotina" })));
    expect(await db.project.count({ where: { id: pr.id } })).toBe(1);
    await go(updateProject(form({ workspaceId: pessoal, projectId: pr.id, name: "Rotina", status: "ARCHIVED" })));
    const after = await db.project.findUniqueOrThrow({ where: { id: pr.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.name).toBe("Rotina");
  });
});

describe("prazo das notas nas configurações", () => {
  it("só no espaço pessoal e só com as opções", async () => {
    as(ana);
    await go(updateWorkspace(form({ workspaceId: pessoal, aba: "retencao", noteMonths: "36" })));
    expect((await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: pessoal } })).noteRetentionMonths).toBe(36);
    await go(updateWorkspace(form({ workspaceId: pessoal, aba: "retencao", noteMonths: "3" })));
    expect((await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: pessoal } })).noteRetentionMonths).toBe(36);
    await go(updateWorkspace(form({ workspaceId: team, aba: "retencao", noteMonths: "24" })));
    expect((await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: team } })).noteRetentionMonths).toBe(12);
  });
});

describe("mais avisos", () => {
  it("apelido e leitura de @menções", () => {
    expect(handleOf({ name: "Ana Clara Souza" })).toBe("ana.clara.souza");
    expect(handleOf({ name: "João", username: "Joao_Dev" })).toBe("joao.dev");
    expect(extractHandles("oi @ana.clara.souza e @joao.dev, email a@b.com")).toEqual(["ana.clara.souza", "joao.dev"]);
  });

  it("@menção avisa quem foi citado; quem acompanha o canal recebe aviso de canal", async () => {
    const bName = (await db.user.findUniqueOrThrow({ where: { id: bia } })).name;
    const ch = await db.channel.findFirstOrThrow({ where: { workspaceId: team, name: "ideias" } });
    await db.channelMember.create({ data: { channelId: ch.id, userId: bia } });
    as(ana);
    await sendMessage(form({ workspaceId: team, channelId: ch.id, conversationId: "", parentId: "", content: `oi @${handleOf({ name: bName })}` }));
    expect(await db.notification.count({ where: { userId: bia, type: "mention" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: bia, type: "channel_message" } })).toBe(0); // menção já avisou
    await sendMessage(form({ workspaceId: team, channelId: ch.id, conversationId: "", parentId: "", content: "sem menção" }));
    await sendMessage(form({ workspaceId: team, channelId: ch.id, conversationId: "", parentId: "", content: "outra" }));
    const c = await db.notification.findMany({ where: { userId: bia, type: "channel_message" } });
    expect(c).toHaveLength(1); // junta num aviso
    expect((c[0]!.payload as { count: number }).count).toBe(2);
    expect(await db.notification.count({ where: { userId: ana, type: { in: ["mention", "channel_message"] } } })).toBe(0); // quem enviou não recebe
  });

  it("concluir tarefa avisa responsável e quem criou, menos quem concluiu", async () => {
    const t = await db.task.create({ data: { projectId, statusId, title: "Concluir", position: "e", createdById: ana, assignees: { create: { userId: bia } } } });
    as(ana);
    await toggleTaskDone(form({ workspaceId: team, taskId: t.id }));
    expect(await db.notification.count({ where: { userId: bia, type: "task_done", payload: { path: ["href"], string_contains: t.id } } })).toBe(1);
    expect(await db.notification.count({ where: { userId: ana, type: "task_done" } })).toBe(0);
  });

  it("lembrete de evento sai na hora certa para todos os participantes, uma vez", async () => {
    const ev = await db.calendarEvent.create({
      data: { workspaceId: team, title: "Daily", startsAt: new Date(Date.now() + 10 * 60_000), endsAt: new Date(Date.now() + 40 * 60_000), reminderMin: 15, timezone: "America/Sao_Paulo", createdById: ana, participants: { create: [{ userId: ana, response: "ACCEPTED" }, { userId: bia }] } },
    });
    expect(await runEventReminders()).toBe(2);
    expect(await runEventReminders()).toBe(0);
    await db.calendarEvent.delete({ where: { id: ev.id } });
  });
});

describe("ordem dos canais", () => {
  it("dono/admin muda a ordem para todos; membro não", async () => {
    const chs = await db.channel.findMany({ where: { workspaceId: team }, select: { id: true }, orderBy: { name: "asc" } });
    const ids = chs.map((c) => c.id).reverse();
    as(bia);
    await expect(reorderChannels({ workspaceId: team, ids })).rejects.toThrow();
    as(ana);
    expect(await reorderChannels({ workspaceId: team, ids })).toEqual({ ok: true });
    const after = await db.channel.findMany({ where: { workspaceId: team }, orderBy: { position: "asc" }, select: { id: true } });
    expect(after.map((c) => c.id)).toEqual(ids);
    // canal de outro workspace é ignorado
    const other = await db.channel.findFirstOrThrow({ where: { workspaceId: { not: team } }, select: { id: true, position: true } });
    await reorderChannels({ workspaceId: team, ids: [other.id, ...ids] });
    expect((await db.channel.findUniqueOrThrow({ where: { id: other.id } })).position).toBe(other.position);
  });
});

describe("fixar mensagens", () => {
  it("quem gerencia fixa; membro não; fixada não some pelo prazo; apagar desafixa", async () => {
    const { togglePin, deleteMessage } = await import("@/_data/chat.actions");
    const { runDailyCleanup } = await import("@/_lib/server/cleanup");
    const ch = await db.channel.findFirstOrThrow({ where: { workspaceId: team, name: "ideias" } });
    const old = new Date(Date.now() - 400 * 86_400_000); // bem além de qualquer prazo
    const keep = await db.message.create({ data: { workspaceId: team, channelId: ch.id, senderId: ana, content: "doc importante", createdAt: old } });
    const gone = await db.message.create({ data: { workspaceId: team, channelId: ch.id, senderId: ana, content: "papo velho", createdAt: old } });
    const reply = await db.message.create({ data: { workspaceId: team, channelId: ch.id, senderId: bia, content: "resposta", parentMessageId: keep.id, createdAt: old } });
    as(bia);
    expect(await togglePin({ workspaceId: team, messageId: keep.id })).toEqual({ ok: false });
    as(ana);
    expect(await togglePin({ workspaceId: team, messageId: keep.id })).toEqual({ ok: true, pinned: true });
    expect(await togglePin({ workspaceId: team, messageId: reply.id })).toEqual({ ok: false }); // thread não
    await runDailyCleanup();
    expect(await db.message.count({ where: { id: keep.id } })).toBe(1);
    expect(await db.message.count({ where: { id: reply.id } })).toBe(1); // resposta da fixada fica
    expect(await db.message.count({ where: { id: gone.id } })).toBe(0);
    const f = new FormData();
    f.set("workspaceId", team);
    f.set("messageId", keep.id);
    await deleteMessage(f);
    expect((await db.message.findUniqueOrThrow({ where: { id: keep.id } })).pinnedAt).toBeNull();
  });
});
