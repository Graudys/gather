import { NextResponse } from "next/server";
import { z } from "zod";
import { leaveMeeting } from "@/_data/meetings.actions";
import { sameOrigin } from "@/_lib/server/request";

// Chamado com navigator.sendBeacon quando a aba fecha no meio da reunião.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const p = z.object({ workspaceId: z.uuid(), participantId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return new NextResponse(null, { status: 400 });
  try {
    await leaveMeeting(p.data.workspaceId, p.data.participantId);
  } catch {
    // sem sessão: o webhook do LiveKit fecha a presença
  }
  return new NextResponse(null, { status: 204 });
}
