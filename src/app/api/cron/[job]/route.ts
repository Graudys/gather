import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/_lib/supabase/admin";
import { serverEnv } from "@/_lib/server/env";
import { reportError } from "@/_lib/server/observability";
import { roomService } from "@/_lib/server/livekit";

export const maxDuration = 60;

/** Chamado pelo pg_cron (pg_net) com "Authorization: Bearer CRON_SECRET". */
function authorized(req: Request) {
  const secret = serverEnv().CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

const jobs: Record<string, () => Promise<Record<string, number>>> = {
  // Arquivos do chat vencidos (24 h ou 7 dias): apaga do Storage e marca expired_at.
  async arquivos() {
    const db = createAdminClient();
    const { data } = await db.rpc("expired_chat_files", { lim: 500 });
    const rows = (data ?? []) as { id: string; storage_path: string }[];
    if (!rows.length) return { apagados: 0 };
    const { error } = await db.storage.from("chat").remove(rows.map((r) => r.storage_path));
    if (error) throw error;
    await db.from("message_attachments").update({ expired_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
    return { apagados: rows.length };
  },

  // Reuniões que passaram do limite de tempo ou da cota: encerra a sala no LiveKit.
  async reunioes() {
    const db = createAdminClient();
    const { data } = await db.rpc("meetings_to_end");
    const rows = (data ?? []) as { id: string; room_key: string; reason: string }[];
    for (const m of rows) {
      try {
        await roomService().deleteRoom(m.room_key);
      } catch {
        // sala já não existe no LiveKit
      }
      await db.from("meetings").update({ status: "ENDED", ended_at: new Date().toISOString(), end_reason: m.reason }).eq("id", m.id);
      await db.from("meeting_participants").update({ left_at: new Date().toISOString() }).eq("meeting_id", m.id).is("left_at", null);
    }
    return { encerradas: rows.length };
  },

  // Uma vez por dia: anexos de chamados fechados, cópias de dados vencidas e contas excluídas.
  async diario() {
    const db = createAdminClient();
    const { data: files } = await db.rpc("closed_ticket_files", { lim: 500 });
    const tf = (files ?? []) as { id: string; storage_path: string }[];
    if (tf.length) {
      await db.storage.from("support").remove(tf.map((f) => f.storage_path));
      await db.from("support_attachments").update({ deleted_at: new Date().toISOString() }).in("id", tf.map((f) => f.id));
    }
    const { data: exports } = await db.from("data_export_requests").select("id, storage_path")
      .eq("status", "READY").lt("expires_at", new Date().toISOString()).limit(200);
    const ex = (exports ?? []).filter((e) => e.storage_path);
    if (ex.length) {
      await db.storage.from("exports").remove(ex.map((e) => e.storage_path as string));
      await db.from("data_export_requests").update({ status: "EXPIRED", storage_path: null }).in("id", ex.map((e) => e.id));
    }
    const { data: accounts } = await db.rpc("accounts_to_delete", { lim: 100 });
    let contas = 0;
    for (const a of (accounts ?? []) as { id: string }[]) {
      // Apagar o usuário do Auth apaga o perfil em cascata; mensagens ficam sem autor.
      const { error } = await db.auth.admin.deleteUser(a.id);
      if (!error) contas++;
    }
    return { anexosChamados: tf.length, copiasDeDados: ex.length, contas };
  },
};

export async function POST(req: Request, ctx: RouteContext<"/api/cron/[job]">) {
  if (!authorized(req)) return new NextResponse(null, { status: 401 });
  const { job } = await ctx.params;
  const run = jobs[job];
  if (!run) return new NextResponse(null, { status: 404 });
  try {
    return NextResponse.json({ job, ...(await run()) });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    await reportError({ source: "CRON", message: `${err.name}: ${err.message}`, location: `cron ${job}`, stack: err.stack });
    return NextResponse.json({ job, erro: true }, { status: 500 });
  }
}
