import "./helpers";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setSessionUser, NotFound, Redirect } from "./helpers";
import { db } from "@/_lib/db/prisma";
import { getChatView, getWorkspaceShell } from "@/_data/chat";
import { createChannel, deleteMessage, editMessage, sendMessage, startConversation, toggleReaction, addChannelMembers } from "@/_data/chat.actions";
import { getWorkspaceSettingsView } from "@/_data/members";
import { addMember, removeMember, updateWorkspace } from "@/_data/members.actions";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const dona = randomUUID();
const membro = randomUUID();
const outro = randomUUID(); // tem acesso ao Gather, mas não ao workspace
let ws = "";
let geral = "";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const as = (id: string) => setSessionUser({ id });
async function catchRedirect(p: Promise<unknown>) {
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
  for (const id of [dona, membro, outro]) {
    await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  }
  const r = await createTeamWorkspaceFor(dona, "Chat teste");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  geral = (await db.channel.findFirstOrThrow({ where: { workspaceId: ws } })).id;
  as(dona);
  expect(await catchRedirect(addMember(form({ workspaceId: ws, email: `${membro}@t.test`, role: "MEMBER" })))).toContain("ok=adicionado");
});

afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: { in: [dona, membro, outro] } } });
  await db.adminAction.deleteMany({ where: { adminId: { in: [dona, membro, outro] } } });
  await db.user.deleteMany({ where: { id: { in: [dona, membro, outro] } } });
  await db.$disconnect();
});

describe("mensagens", () => {
  it("só quem escreveu edita; dona do workspace pode apagar a de outra pessoa", async () => {
    as(membro);
    await sendMessage(form({ workspaceId: ws, channelId: geral, content: "oi do membro" }));
    const msg = await db.message.findFirstOrThrow({ where: { channelId: geral, senderId: membro } });

    as(dona);
    await editMessage(form({ workspaceId: ws, messageId: msg.id, content: "editada pela dona" }));
    expect((await db.message.findUniqueOrThrow({ where: { id: msg.id } })).content).toBe("oi do membro");

    as(membro);
    await editMessage(form({ workspaceId: ws, messageId: msg.id, content: "corrigida" }));
    const edited = await db.message.findUniqueOrThrow({ where: { id: msg.id } });
    expect(edited.content).toBe("corrigida");
    expect(edited.editedAt).not.toBeNull();

    await toggleReaction(form({ workspaceId: ws, messageId: msg.id, emoji: "👍" }));
    as(dona);
    await deleteMessage(form({ workspaceId: ws, messageId: msg.id }));
    const gone = await db.message.findUniqueOrThrow({ where: { id: msg.id } });
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.content).toBe(""); // o texto sai do banco
    expect(await db.messageReaction.count({ where: { messageId: msg.id } })).toBe(0);
  });

  it("membro comum não apaga mensagem de outra pessoa", async () => {
    as(dona);
    await sendMessage(form({ workspaceId: ws, channelId: geral, content: "da dona" }));
    const msg = await db.message.findFirstOrThrow({ where: { channelId: geral, senderId: dona, deletedAt: null } });
    as(membro);
    await deleteMessage(form({ workspaceId: ws, messageId: msg.id }));
    expect((await db.message.findUniqueOrThrow({ where: { id: msg.id } })).deletedAt).toBeNull();
  });

  it("reação só com os emojis da lista", async () => {
    const msg = await db.message.findFirstOrThrow({ where: { channelId: geral, deletedAt: null } });
    as(membro);
    await toggleReaction(form({ workspaceId: ws, messageId: msg.id, emoji: "<script>" }));
    expect(await db.messageReaction.count({ where: { messageId: msg.id } })).toBe(0);
    await toggleReaction(form({ workspaceId: ws, messageId: msg.id, emoji: "🎉" }));
    await toggleReaction(form({ workspaceId: ws, messageId: msg.id, emoji: "🎉" })); // tira de novo
    expect(await db.messageReaction.count({ where: { messageId: msg.id } })).toBe(0);
  });

  it("thread: resposta só em mensagem principal do mesmo canal", async () => {
    const parent = await db.message.findFirstOrThrow({ where: { channelId: geral, deletedAt: null, parentMessageId: null } });
    as(membro);
    await sendMessage(form({ workspaceId: ws, channelId: geral, parentId: parent.id, content: "resposta" }));
    const reply = await db.message.findFirstOrThrow({ where: { parentMessageId: parent.id } });
    // Resposta de resposta não vale (um nível só).
    await sendMessage(form({ workspaceId: ws, channelId: geral, parentId: reply.id, content: "nível 2" }));
    expect(await db.message.count({ where: { parentMessageId: reply.id } })).toBe(0);
    const view = await getChatView(ws, { kind: "channel", id: geral }, { threadId: parent.id });
    expect(view.thread?.replies.map((r) => r.content)).toContain("resposta");
    expect(view.messages.find((m) => m.id === parent.id)?.replyCount).toBe(1);
  });

  it("não lidas aparecem para quem não leu e somem depois de abrir", async () => {
    as(dona);
    await sendMessage(form({ workspaceId: ws, channelId: geral, content: "novidade" }));
    as(membro);
    const before = await getWorkspaceShell(ws);
    expect(before.channels.find((c) => c.id === geral)!.unread).toBeGreaterThan(0);
    await getChatView(ws, { kind: "channel", id: geral }); // abrir marca como lido
    await new Promise((r) => setTimeout(r, 50));
    const { getWorkspaceShell: fresh } = await import("@/_data/chat");
    const after = await fresh(ws);
    expect(after.channels.find((c) => c.id === geral)!.unread).toBe(0);
  });
});

describe("canais privados e conversas", () => {
  it("canal privado: só quem foi adicionado vê; quem está fora não aparece na lista", async () => {
    as(dona);
    const to = await catchRedirect(createChannel(form({ workspaceId: ws, name: "Diretoria Ç", visibility: "PRIVATE" })));
    const chId = to!.split("/c/")[1]!;
    expect((await db.channel.findUniqueOrThrow({ where: { id: chId } })).name).toBe("diretoria-c");
    as(membro);
    await expect(getChatView(ws, { kind: "channel", id: chId })).rejects.toBeInstanceOf(NotFound);
    expect((await getWorkspaceShell(ws)).channels.map((c) => c.id)).not.toContain(chId);

    // Dona adiciona o membro e uma pessoa de fora do workspace (que é ignorada).
    as(dona);
    await addChannelMembers(form({ workspaceId: ws, channelId: chId, userIds: [membro, outro] }));
    expect(await db.channelMember.count({ where: { channelId: chId, userId: outro } })).toBe(0);
    as(membro);
    expect((await getChatView(ws, { kind: "channel", id: chId })).title).toBe("diretoria-c");
  });

  it("nome de canal repetido é recusado", async () => {
    as(dona);
    expect(await catchRedirect(createChannel(form({ workspaceId: ws, name: "geral", visibility: "PUBLIC" })))).toContain("erro=existe");
  });

  it("conversa direta: só os dois veem, e abrir de novo reaproveita a mesma", async () => {
    as(dona);
    const a = await catchRedirect(startConversation(form({ workspaceId: ws, userIds: [membro] })));
    const b = await catchRedirect(startConversation(form({ workspaceId: ws, userIds: [membro] })));
    expect(a).toBe(b);
    const convId = a!.split("/dm/")[1]!;
    as(membro);
    await sendMessage(form({ workspaceId: ws, conversationId: convId, content: "só nós" }));
    expect((await getChatView(ws, { kind: "dm", id: convId })).messages.at(-1)?.content).toBe("só nós");

    // Alguém que entra depois no workspace não vê a conversa.
    as(dona);
    await catchRedirect(addMember(form({ workspaceId: ws, email: `${outro}@t.test`, role: "MEMBER" })));
    as(outro);
    await expect(getChatView(ws, { kind: "dm", id: convId })).rejects.toBeInstanceOf(NotFound);
    await expect(sendMessage(form({ workspaceId: ws, conversationId: convId, content: "intruso" }))).rejects.toBeInstanceOf(NotFound);
  });

  it("não dá para abrir conversa com quem não é do workspace", async () => {
    const estranho = randomUUID();
    await db.user.create({ data: { id: estranho, name: "Fora", email: `${estranho}@t.test`, mustChangePassword: false } });
    as(dona);
    await startConversation(form({ workspaceId: ws, userIds: [estranho] }));
    expect(await db.conversationMember.count({ where: { userId: estranho } })).toBe(0);
    await db.user.delete({ where: { id: estranho } });
  });
});

describe("configurações do workspace", () => {
  it("membro comum não abre as configurações", async () => {
    as(membro);
    await expect(getWorkspaceSettingsView(ws)).rejects.toBeInstanceOf(NotFound);
  });

  it("prazo fora das opções é recusado", async () => {
    as(dona);
    expect(await catchRedirect(updateWorkspace(form({ workspaceId: ws, name: "Chat teste", months: "99", hours: "24" })))).toContain("erro=prazo");
    expect(await catchRedirect(updateWorkspace(form({ workspaceId: ws, name: "Chat teste", months: "6", hours: "168" })))).toContain("ok=salvo");
    expect((await db.workspaceSettings.findUniqueOrThrow({ where: { workspaceId: ws } })).messageRetentionMonths).toBe(6);
  });

  it("remover alguém tira dos canais privados e das conversas", async () => {
    as(dona);
    await removeMember(form({ workspaceId: ws, userId: membro }));
    expect(await db.channelMember.count({ where: { userId: membro, channel: { workspaceId: ws } } })).toBe(0);
    expect(await db.conversationMember.count({ where: { userId: membro, conversation: { workspaceId: ws } } })).toBe(0);
    as(membro);
    await expect(getChatView(ws, { kind: "channel", id: geral })).rejects.toBeInstanceOf(NotFound);
  });

  it("e-mail sem acesso ao Gather não entra", async () => {
    as(dona);
    expect(await catchRedirect(addMember(form({ workspaceId: ws, email: "ninguem@nada.test", role: "MEMBER" })))).toContain("erro=semAcesso");
  });
});
