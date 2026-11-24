import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { hit } from "@/lib/server/rate-limit";
import { sameOrigin } from "@/lib/server/request";
import { audioToken, livekitUrl } from "@/lib/server/livekit";

// Entrar numa reunião: confere tudo no banco e devolve um token só de áudio.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "origem" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "sem sessão" }, { status: 401 });
  if (!(await hit("meetingToken", user.id))) return NextResponse.json({ error: "muitas tentativas" }, { status: 429 });

  const body = z.object({ meetingId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db.rpc("meeting_join_check", { p_meeting: body.data.meetingId, p_user: user.id });
  const check = Array.isArray(data) ? data[0] : data;
  if (error || !check?.ok) return NextResponse.json({ error: check?.reason ?? "não permitido" }, { status: 403 });

  const { data: profile } = await db.from("profiles").select("display_name").eq("id", user.id).single();
  const token = await audioToken(check.room_key, user.id, profile?.display_name ?? "Pessoa", check.seconds_left);
  return NextResponse.json({ token, url: livekitUrl(), secondsLeft: check.seconds_left });
}
