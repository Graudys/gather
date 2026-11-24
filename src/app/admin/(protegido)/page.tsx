import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/dal";

// Só números agregados. Nenhuma mensagem ou arquivo aparece aqui.
export default async function AdminHome() {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [p, w, t, e] = await Promise.all([
    db.from("profiles").select("*", head),
    db.from("workspaces").select("*", head).eq("kind", "TEAM"),
    db.from("support_tickets").select("*", head).in("status", ["OPEN", "WAITING_USER"]),
    db.from("error_events").select("*", head).in("status", ["NEW", "REGRESSED"]),
  ]);
  const [pessoas, workspaces, abertos, erros] = [p.count ?? 0, w.count ?? 0, t.count ?? 0, e.count ?? 0];
  const kpis = [["Pessoas", pessoas], ["Workspaces de equipe", workspaces], ["Chamados abertos", abertos], ["Erros novos", erros]] as const;
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Visão geral</h1>
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
            <small className="text-xs text-neutral-400">{k}</small>
            <b className="block text-3xl font-semibold">{v}</b>
          </div>
        ))}
      </div>
    </>
  );
}
