import "server-only";
import { createAdminClient } from "@/_lib/supabase/admin";
import { createClient } from "@/_lib/supabase/server";
import { requirePlatformAdmin } from "@/_lib/auth/dal";
import type { AdminKpis, ErrorRow } from "@/types/domain";

/** Só números agregados. Nenhuma mensagem ou arquivo sai daqui. */
export async function getAdminKpis(): Promise<AdminKpis> {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [p, w, t, e] = await Promise.all([
    db.from("profiles").select("*", head),
    db.from("workspaces").select("*", head).eq("kind", "TEAM"),
    db.from("support_tickets").select("*", head).in("status", ["OPEN", "WAITING_USER"]),
    db.from("error_events").select("*", head).in("status", ["NEW", "REGRESSED"]),
  ]);
  return { pessoas: p.count ?? 0, workspaces: w.count ?? 0, chamados: t.count ?? 0, erros: e.count ?? 0 };
}

/** Erros abertos. Usa a sessão: o RLS confere de novo admin + MFA. */
export async function listOpenErrors(): Promise<ErrorRow[]> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_events")
    .select("id, status, source, message, location, count, users_affected, last_seen_at, release")
    .in("status", ["NEW", "REGRESSED", "OPEN"])
    .order("last_seen_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((e) => ({
    id: e.id, status: e.status, source: e.source, message: e.message, location: e.location,
    count: e.count, usersAffected: e.users_affected, lastSeenAt: e.last_seen_at, release: e.release,
  }));
}
