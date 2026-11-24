import { NextResponse } from "next/server";
import { createAdminClient } from "@/_lib/supabase/admin";
import { webhookReceiver } from "@/_lib/server/livekit";
import { reportError } from "@/_lib/server/observability";

// Eventos do LiveKit. A assinatura é conferida ANTES de qualquer coisa.
export async function POST(req: Request) {
  const body = await req.text();
  let event;
  try {
    event = await webhookReceiver().receive(body, req.headers.get("authorization") ?? undefined);
  } catch (e) {
    await reportError({ source: "WEBHOOK", message: "LiveKit webhook: assinatura inválida", location: "/api/livekit/webhook", stack: String(e) });
    return new NextResponse(null, { status: 401 });
  }

  const db = createAdminClient();
  const roomKey = event.room?.name;
  if (!roomKey) return new NextResponse(null, { status: 204 });
  const { data: meeting } = await db.from("meetings").select("id, workspace_id, status").eq("room_key", roomKey).maybeSingle();
  if (!meeting) return new NextResponse(null, { status: 204 });
  const identity = event.participant?.identity;

  if (event.event === "participant_joined" && identity) {
    await db.from("meeting_participants").insert({ meeting_id: meeting.id, user_id: identity, role: "PARTICIPANT" });
    if (meeting.status === "SCHEDULED") {
      await db.from("meetings").update({ status: "LIVE", started_at: new Date().toISOString() }).eq("id", meeting.id);
    }
  }

  if ((event.event === "participant_left" || event.event === "participant_connection_aborted") && identity) {
    const { data: rows } = await db
      .from("meeting_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("meeting_id", meeting.id).eq("user_id", identity).is("left_at", null)
      .select("joined_at");
    const seconds = (rows ?? []).reduce((s, r) => s + Math.max(0, (Date.now() - new Date(r.joined_at).getTime()) / 1000), 0);
    if (seconds > 0) await db.rpc("meeting_add_usage", { p_workspace: meeting.workspace_id, p_seconds: Math.ceil(seconds) });
  }

  if (event.event === "room_finished" && meeting.status !== "ENDED") {
    await db.from("meetings").update({ status: "ENDED", ended_at: new Date().toISOString(), end_reason: "EMPTY" }).eq("id", meeting.id);
  }
  return new NextResponse(null, { status: 204 });
}
