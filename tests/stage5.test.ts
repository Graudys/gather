import "./helpers";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setSessionUser, NotFound, Redirect } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { sendMessage, startConversation, createChannel } from "@/_data/chat.actions";
import { createProject, createTask, setAssignees } from "@/_data/projects.actions";
import { createEvent } from "@/_data/agenda.actions";
import { listNotifications, unreadCount } from "@/_data/notifications";
import { markAllRead } from "@/_data/notifications.actions";
import { searchWorkspace } from "@/_data/search";
import { askOrbi, sendQuestionToAdmin } from "@/_data/help.actions";
import { getArticle, getHelpAdmin } from "@/_data/help";
import { importStarter, saveArticle } from "@/_data/admin-help.actions";
import { bestArticle } from "@/lib/orbi";
import { Markdown } from "@/_components/help/Markdown";
import { STARTER_ARTICLES } from "@/_lib/help/starter";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const ana = randomUUID();
const beto = randomUUID();
const chefe = randomUUID(); // admin do Gather
let ws = "";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const as = (id: string, role = "user") => setSessionUser({ id, name: id === ana ? "Ana" : id === beto ? "Beto" : "Chefe", role });
async function to(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  return null;
}

beforeAll(async () => {
  await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  for (const [id, role] of [[ana, "user"], [beto, "user"], [chefe, "admin"]] as const) {
    await db.user.create({ data: { id, name: id === ana ? "Ana" : id === beto ? "Beto" : "Chefe", email: `${id}@t.test`, role, mustChangePassword: false } });
  }
  const r = await createTeamWorkspaceFor(ana, "Etapa 5");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  await db.workspaceMember.create({ data: { workspaceId: ws, userId: beto } });
});

afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [ana, beto, chefe] } } });
  await db.notification.deleteMany({ where: { userId: { in: [ana, beto, chefe] } } });
  await db.adminAction.deleteMany({ where: { adminId: { in: [ana, beto, chefe] } } });
  await db.helpArticle.deleteMany({ where: { slug: { in: ["rascunho-secreto", "link-ruim"] } } });
  await db.botQuestion.deleteMany({ where: { question: "como exporto para planilha" } });
  await db.user.deleteMany({ where: { id: { in: [ana, beto, chefe] } } });
  await db.$disconnect();
});

describe("notificações", () => {
  it("mensagens diretas viram um aviso só (com contagem) até ler", async () => {
    as(ana);
    const url = await to(startConversation(form({ workspaceId: ws, userIds: [beto] })));
    const conv = url!.split("/dm/")[1]!;
    for (const t of ["oi", "tudo bem?", "me avisa"]) await sendMessage(form({ workspaceId: ws, conversationId: conv, content: t }));
    as(beto);
    const list = await listNotifications();
    const dm = list.filter((n) => n.type === "dm");
    expect(dm).toHaveLength(1);
    expect(dm[0]!.count).toBe(3);
    expect(dm[0]!.body).toBe("me avisa");
    expect(await unreadCount()).toBeGreaterThan(0);
    await markAllRead();
    expect(await unreadCount()).toBe(0);
    as(ana);
    expect((await listNotifications()).filter((n) => n.type === "dm")).toHaveLength(0); // quem mandou não recebe
  });

  it("resposta em thread avisa quem escreveu a principal", async () => {
    as(ana);
    const geral = (await db.channel.findFirstOrThrow({ where: { workspaceId: ws, name: "geral" } })).id;
    await sendMessage(form({ workspaceId: ws, channelId: geral, content: "pergunta" }));
    const parent = await db.message.findFirstOrThrow({ where: { channelId: geral, content: "pergunta" } });
    as(beto);
    await sendMessage(form({ workspaceId: ws, channelId: geral, parentId: parent.id, content: "resposta" }));
    as(ana);
    expect((await listNotifications()).some((n) => n.type === "thread" && n.href.includes(`thread=${parent.id}`))).toBe(true);
  });

  it("tarefa: avisa só quem acabou de ser colocado", async () => {
    as(ana);
    const url = await to(createProject(form({ workspaceId: ws, name: "N", memberIds: [], columns: [] })));
    const pid = url!.split("/p/")[1]!;
    const st = await db.taskStatus.findFirstOrThrow({ where: { projectId: pid }, orderBy: { position: "asc" } });
    await createTask(form({ workspaceId: ws, projectId: pid, statusId: st.id, title: "Fazer X" }));
    const task = await db.task.findFirstOrThrow({ where: { projectId: pid } });
    await setAssignees(form({ workspaceId: ws, taskId: task.id, userIds: [beto, ana] }));
    await setAssignees(form({ workspaceId: ws, taskId: task.id, userIds: [beto, ana] })); // de novo: não repete
    as(beto);
    expect((await listNotifications()).filter((n) => n.type === "task_assigned")).toHaveLength(1);
    as(ana);
    expect((await listNotifications()).filter((n) => n.type === "task_assigned")).toHaveLength(0);
  });

  it("convite de evento e lembrete na hora certa (uma vez só)", async () => {
    as(ana);
    const start = new Date(Date.now() + 5 * 60_000);
    const day = start.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const hm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    if (hm(start) > hm(new Date(start.getTime() + 15 * 60_000))) return; // virada do dia: pula
    await to(createEvent(form({ workspaceId: ws, title: "Daily", date: day, start: hm(start), end: hm(new Date(start.getTime() + 15 * 60_000)), visibility: "PRIVATE", participantIds: [beto], reminder: "10" })));
    as(beto);
    const list = await listNotifications();
    expect(list.some((n) => n.type === "event_invite")).toBe(true);
    expect(list.filter((n) => n.type === "event_reminder" && n.title.includes("Daily"))).toHaveLength(1);
    await markAllRead();
    expect((await listNotifications()).filter((n) => n.type === "event_reminder" && n.title.includes("Daily"))).toHaveLength(1);
  });
});

describe("busca", () => {
  it("não mostra canal privado nem conversa de outros", async () => {
    as(ana);
    const url = await to(createChannel(form({ workspaceId: ws, name: "segredo", visibility: "PRIVATE" })));
    const ch = url!.split("/c/")[1]!;
    await sendMessage(form({ workspaceId: ws, channelId: ch, content: "palavra-ultra-secreta" }));
    expect((await searchWorkspace(ws, "ultra-secreta"))!.messages).toHaveLength(1);
    as(beto);
    expect((await searchWorkspace(ws, "ultra-secreta"))!.messages).toHaveLength(0);
    expect((await searchWorkspace(ws, "tudo bem"))!.messages).toHaveLength(1); // a DM com a Ana ele vê
    expect(await searchWorkspace(ws, "a")).toBeNull();
  });

  it("quem não é do workspace não busca", async () => {
    as(chefe, "admin");
    await expect(searchWorkspace(ws, "oi")).rejects.toBeInstanceOf(NotFound);
  });
});

describe("ajuda e Orbi", () => {
  it("Orbi acha o artigo certo pelas palavras", () => {
    const arts = STARTER_ARTICLES.map((a) => ({ ...a, id: a.slug }));
    expect(bestArticle("esqueci minha senha, como faço?", arts)?.article.slug).toBe("esqueci-a-senha");
    expect(bestArticle("como crio um canal privado", arts)?.article.slug).toBe("criar-canal");
    expect(bestArticle("por que minhas mensagens sumiram", arts)?.article.slug).toBe("mensagens-somem");
    expect(bestArticle("quantos minutos de reunião tenho", arts)?.article.slug).toBe("minutos-de-reuniao");
    expect(bestArticle("receita de bolo de cenoura", arts)).toBeNull();
  });

  it("só admin mexe nos artigos; rascunho não aparece", async () => {
    as(ana);
    await expect(importStarter()).rejects.toBeInstanceOf(NotFound);
    as(chefe, "admin");
    await importStarter();
    await db.helpArticle.deleteMany({ where: { slug: { in: ["rascunho-secreto", "link-ruim"] } } });
    const cat = await db.helpCategory.findFirstOrThrow();
    const url = await to(saveArticle(form({ title: "Rascunho secreto", categoryId: cat.id, summary: "Ainda não pronto para ninguém", body: "x", status: "DRAFT" })));
    expect(url).toContain("ok=1");
    as(ana);
    await expect(getArticle("rascunho-secreto")).rejects.toBeInstanceOf(NotFound);
    const a = await askOrbi("como troco minha senha");
    expect(a.found && a.slug).toBe("trocar-senha");
    // atalho só com caminho interno
    as(chefe, "admin");
    expect(await to(saveArticle(form({ title: "Link ruim", categoryId: cat.id, summary: "Resumo com tamanho bom", body: "x", status: "DRAFT", actionPath: "https://mal.com" })))).toContain("erro=");
  });

  it("mandar para o admin avisa os admins com o nome de quem perguntou", async () => {
    as(beto);
    const a = await askOrbi("como exporto para planilha");
    expect(a.found).toBe(false);
    await sendQuestionToAdmin(a.questionId, "como exporto para planilha");
    as(chefe, "admin");
    const n = (await listNotifications()).find((x) => x.type === "help_question");
    expect(n?.title).toContain("Beto");
    expect((await getHelpAdmin()).questions.some((q) => q.question === "como exporto para planilha" && q.sentToAdmin)).toBe(true);
  });

  it("markdown não deixa passar HTML nem link javascript:", () => {
    const html = renderToStaticMarkup(createElement(Markdown, { text: "# Oi\n<script>alert(1)</script>\n[clique](javascript:alert(1)) e [ok](/app)" }));
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="/app"');
  });
});
