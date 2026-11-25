import "./helpers";
import { vi, beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { setSessionUser, NotFound, Redirect } from "./helpers";

// LiveKit falso: nada sai para a rede nos testes.
const closed: string[] = [];
vi.mock("@/_lib/server/livekit", () => ({
  livekitConfig: () => ({ url: "wss://teste.livekit.cloud", key: "k", secret: "s", http: "https://teste.livekit.cloud" }),
  joinToken: async () => "token-falso",
  ensureRoom: async () => undefined,
  closeRoom: async (room: string) => void closed.push(room),
  countInRoom: async () => null,
  webhookReceiver: () => null,
}));

import { db } from "@/_lib/db/prisma";
import { getEvent, listCalendar } from "@/_data/agenda";
import { createEvent, deleteEvent, respondEvent } from "@/_data/agenda.actions";
import { getMeetingView, listMeetings } from "@/_data/meetings";
import { addDecision, createTaskFromMeeting, endMeeting, joinMeeting, leaveMeeting, saveNotes, startMeetingNow } from "@/_data/meetings.actions";
import { enforceMeetingLimits, meetingUsage } from "@/_data/meetings.server";
import { createTeamWorkspaceFor } from "@/_data/workspaces.server";

const dona = randomUUID();
const ana = randomUUID();
const beto = randomUUID();
let ws = "";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const as = (id: string) => setSessionUser({ id, name: id === dona ? "Dona" : id === ana ? "Ana" : "Beto" });
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
  await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: { callsForAllWorkspaces: true, callMaxParticipants: 2 } });
  for (const id of [dona, ana, beto]) await db.user.create({ data: { id, name: `P ${id.slice(0, 4)}`, email: `${id}@t.test`, mustChangePassword: false } });
  const r = await createTeamWorkspaceFor(dona, "Reuniões teste");
  if (!r.ok) throw new Error("setup");
  ws = r.id;
  await db.workspaceMember.createMany({ data: [{ workspaceId: ws, userId: ana }, { workspaceId: ws, userId: beto }] });
});

afterAll(async () => {
  await db.platformConfig.update({ where: { id: 1 }, data: { callMaxParticipants: 5 } });
  await db.workspace.deleteMany({ where: { createdById: { in: [dona, ana, beto] } } });
  await db.user.deleteMany({ where: { id: { in: [dona, ana, beto] } } });
  await db.$disconnect();
});

describe("agenda", () => {
  let privateEvent = "";
  it("evento só para convidados: Beto não vê; horário de SP vira UTC", async () => {
    as(dona);
    const url = await to(createEvent(form({ workspaceId: ws, title: "1:1 com Ana", date: "2026-12-01", start: "10:00", end: "10:30", visibility: "PRIVATE", participantIds: [ana], reminder: "10", meeting: "on" })));
    privateEvent = new URL(url!, "http://x").searchParams.get("evento")!;
    const ev = await db.calendarEvent.findUniqueOrThrow({ where: { id: privateEvent }, include: { meeting: true } });
    expect(ev.startsAt.toISOString()).toBe("2026-12-01T13:00:00.000Z");
    expect(ev.meeting).not.toBeNull();

    as(ana);
    expect((await listCalendar(ws, "2026-11-30", "2026-12-06")).map((i) => i.id)).toContain(privateEvent);
    as(beto);
    expect((await listCalendar(ws, "2026-11-30", "2026-12-06")).map((i) => i.id)).not.toContain(privateEvent);
    await expect(getEvent(ws, privateEvent)).rejects.toBeInstanceOf(NotFound);
    // A sala do evento privado também some para o Beto.
    await expect(getMeetingView(ws, ev.meeting!.id)).rejects.toBeInstanceOf(NotFound);
  });

  it("fim antes do início é recusado", async () => {
    as(dona);
    expect(await to(createEvent(form({ workspaceId: ws, title: "x", date: "2026-12-01", start: "11:00", end: "10:00", visibility: "WORKSPACE", participantIds: [] })))).toContain("erro=horario");
  });

  it("resposta ao convite e só quem criou apaga", async () => {
    as(ana);
    await respondEvent(form({ workspaceId: ws, eventId: privateEvent, response: "TENTATIVE" }));
    expect((await getEvent(ws, privateEvent)).myResponse).toBe("TENTATIVE");
    await to(deleteEvent(form({ workspaceId: ws, eventId: privateEvent })));
    expect(await db.calendarEvent.count({ where: { id: privateEvent } })).toBe(1);
  });
});

describe("reuniões", () => {
  let meetingId = "";
  it("iniciar agora e entrar: vira AO VIVO com prazo de fim; sala tem limite de pessoas", async () => {
    as(dona);
    const url = await to(startMeetingNow(form({ workspaceId: ws, title: "Rápida" })));
    meetingId = url!.split("/reuniao/")[1]!;
    const j1 = await joinMeeting(ws, meetingId);
    expect(j1.ok).toBe(true);
    const m = await db.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(m.status).toBe("LIVE");
    expect(m.hardEndAt!.getTime() - m.startedAt!.getTime()).toBe(m.maxDurationMin * 60_000);

    as(ana);
    expect((await joinMeeting(ws, meetingId)).ok).toBe(true);
    as(beto);
    expect(await joinMeeting(ws, meetingId)).toEqual({ ok: false, error: "cheia" }); // limite 2 no teste

    // Entrar de novo (outra aba) não ocupa outra vaga.
    as(ana);
    const again = await joinMeeting(ws, meetingId);
    expect(again.ok).toBe(true);
    expect(await db.meetingParticipant.count({ where: { meetingId, userId: ana, leftAt: null } })).toBe(1);
    if (again.ok) {
      as(beto);
      await leaveMeeting(ws, again.participantId); // Beto não fecha a presença da Ana
      expect(await db.meetingParticipant.count({ where: { id: again.participantId, leftAt: null } })).toBe(1);
      as(ana);
      await leaveMeeting(ws, again.participantId);
      expect(await db.meetingParticipant.count({ where: { id: again.participantId, leftAt: null } })).toBe(0);
    }
  });

  it("notas, decisões e tarefa criada na reunião", async () => {
    as(ana);
    await saveNotes(form({ workspaceId: ws, meetingId, content: "Combinado o escopo" }));
    await addDecision(form({ workspaceId: ws, meetingId, text: "Lançar sexta" }));
    // Projeto para a tarefa
    const team = await db.team.create({ data: { workspaceId: ws, name: "Geral", slug: "geral", createdById: dona } });
    const proj = await db.project.create({ data: { teamId: team.id, name: "P", slug: `p-${Date.now()}`, createdById: dona, taskStatuses: { create: [{ name: "A fazer", position: 0 }] } } });
    await createTaskFromMeeting(form({ workspaceId: ws, meetingId, projectId: proj.id, title: "Escrever release" }));
    const v = await getMeetingView(ws, meetingId);
    expect(v.notes.content).toBe("Combinado o escopo");
    expect(v.notes.decisions.map((d) => d.text)).toEqual(["Lançar sexta"]);
    expect(v.tasks.map((t) => t.title)).toEqual(["Escrever release"]);
  });

  it("só quem criou (ou admin) encerra; minutos entram no saldo", async () => {
    as(ana);
    await to(endMeeting(form({ workspaceId: ws, meetingId })));
    expect((await db.meeting.findUniqueOrThrow({ where: { id: meetingId } })).status).toBe("LIVE");
    as(dona);
    await to(endMeeting(form({ workspaceId: ws, meetingId })));
    const m = await db.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(m.status).toBe("ENDED");
    expect(closed).toContain(m.roomKey);
    expect(await db.meetingParticipant.count({ where: { meetingId, leftAt: null } })).toBe(0);
    expect((await meetingUsage(ws)).used).toBeGreaterThan(0);
    expect(await joinMeeting(ws, meetingId)).toEqual({ ok: false, error: "encerrada" });
  });

  it("passou do tempo: encerra sozinha quando alguém abre", async () => {
    as(dona);
    const url = await to(startMeetingNow(form({ workspaceId: ws, title: "Longa" })));
    const id = url!.split("/reuniao/")[1]!;
    await joinMeeting(ws, id);
    await db.meeting.update({ where: { id }, data: { hardEndAt: new Date(Date.now() - 1000) } });
    await enforceMeetingLimits(id);
    expect((await db.meeting.findUniqueOrThrow({ where: { id } })).endReason).toBe("MAX_DURATION");
  });

  it("sem saldo, não entra", async () => {
    const month = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7)}-01T00:00:00Z`);
    await db.workspaceMeetingUsage.upsert({ where: { workspaceId_month: { workspaceId: ws, month } }, create: { workspaceId: ws, month, minutesUsed: 10_000 }, update: { minutesUsed: 10_000 } });
    as(dona);
    expect(await to(startMeetingNow(form({ workspaceId: ws, title: "Sem saldo" })))).toContain("erro=cota");
    expect((await listMeetings(ws)).usage.left).toBe(0);
  });
});
