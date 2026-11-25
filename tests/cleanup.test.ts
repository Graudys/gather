import "./helpers";
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/_lib/db/prisma";
import { runDailyCleanup } from "@/_lib/server/cleanup";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const u = randomUUID();
afterAll(async () => {
  await db.workspace.deleteMany({ where: { createdById: u } });
  await db.user.deleteMany({ where: { id: u } });
  await db.$disconnect();
});

describe("limpeza diária", () => {
  it("apaga mensagens mais velhas que o prazo do workspace (e as respostas junto)", async () => {
    await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
    await db.user.create({ data: { id: u, name: "Limpeza", email: `${u}@t.test`, mustChangePassword: false } });
    const r = await createTeamWorkspaceFor(u, "Limpeza");
    if (!r.ok) throw new Error("setup");
    await db.workspaceSettings.update({ where: { workspaceId: r.id }, data: { messageRetentionMonths: 1 } });
    const ch = await db.channel.findFirstOrThrow({ where: { workspaceId: r.id } });
    const old = new Date(Date.now() - 40 * 86_400_000);
    const velha = await db.message.create({ data: { workspaceId: r.id, channelId: ch.id, senderId: u, content: "velha", createdAt: old } });
    await db.message.create({ data: { workspaceId: r.id, channelId: ch.id, senderId: u, content: "resposta nova", parentMessageId: velha.id } });
    await db.message.create({ data: { workspaceId: r.id, channelId: ch.id, senderId: u, content: "nova" } });

    await runDailyCleanup();
    const left = await db.message.findMany({ where: { channelId: ch.id }, select: { content: true } });
    expect(left.map((m) => m.content)).toEqual(["nova"]);
  });
});
