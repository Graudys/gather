import { NextResponse } from "next/server";
import { db } from "@/_lib/db/prisma";
import { webhookReceiver } from "@/_lib/server/livekit";
import { closeParticipant, endMeetingNow } from "@/_data/meetings.server";

/**
 * Webhook do LiveKit (configure no painel: https://SEU-APP/api/livekit/webhook).
 * A assinatura é conferida com a API secret; sem ela, 401.
 * Deixa a contagem de minutos certa mesmo se alguém fechar o navegador.
 */
export async function POST(req: Request) {
  const receiver = webhookReceiver();
  if (!receiver) return new NextResponse(null, { status: 404 });
  const body = await req.text();
  let event;
  try {
    event = await receiver.receive(body, req.headers.get("authorization") ?? undefined);
  } catch {
    return new NextResponse(null, { status: 401 });
  }
  const roomKey = event.room?.name;
  if (!roomKey) return NextResponse.json({ ok: true });
  const meeting = await db.meeting.findUnique({ where: { roomKey }, select: { id: true, status: true } });
  if (!meeting) return NextResponse.json({ ok: true });
  const userId = event.participant?.identity;

  if (event.event === "participant_left" && userId) {
    const open = await db.meetingParticipant.findMany({ where: { meetingId: meeting.id, userId, leftAt: null }, select: { id: true } });
    for (const o of open) await closeParticipant(o.id);
  }
  if (event.event === "room_finished" && meeting.status === "LIVE") {
    await endMeetingNow(meeting.id, "EMPTY");
  }
  return NextResponse.json({ ok: true });
}
