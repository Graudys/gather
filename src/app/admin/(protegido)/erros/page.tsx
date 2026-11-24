import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/dal";

async function setStatus(form: FormData) {
  "use server";
  const user = await requirePlatformAdmin();
  const parsed = z.object({ id: z.uuid(), status: z.enum(["RESOLVED", "IGNORED", "OPEN"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  // Cliente da sessão: o RLS confere de novo que é admin com MFA.
  const supabase = await createClient();
  await supabase.from("error_events").update({
    status: parsed.data.status,
    resolved_at: parsed.data.status === "RESOLVED" ? new Date().toISOString() : null,
    resolved_by_id: parsed.data.status === "RESOLVED" ? user.id : null,
  }).eq("id", parsed.data.id);
  revalidatePath("/admin/erros");
}

const LABEL: Record<string, string> = { NEW: "Novo", OPEN: "Aberto", RESOLVED: "Resolvido", IGNORED: "Ignorado", REGRESSED: "Voltou" };

export default async function AdminErros() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data: errors } = await supabase
    .from("error_events")
    .select("id, status, source, message, location, count, users_affected, last_seen_at, release")
    .in("status", ["NEW", "REGRESSED", "OPEN"])
    .order("last_seen_at", { ascending: false })
    .limit(100);
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Erros do app</h1>
      <p className="mb-6 text-sm text-neutral-400">Agrupados por tipo. Ficam 30 dias. Sem texto de mensagem, e-mail ou token.</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-neutral-400">
          <tr><th className="py-2">Estado</th><th>Erro</th><th>Origem</th><th className="text-right">Vezes</th><th className="text-right">Pessoas</th><th>Última vez</th><th /></tr>
        </thead>
        <tbody>
          {errors?.map((e) => (
            <tr key={e.id} className="border-t border-white/10 align-top">
              <td className="py-3">{LABEL[e.status]}</td>
              <td className="max-w-md"><b className="font-medium">{e.message}</b><div className="text-xs text-neutral-500">{e.location} · {e.release}</div></td>
              <td>{e.source}</td>
              <td className="text-right">{e.count}</td>
              <td className="text-right">{e.users_affected}</td>
              <td className="text-neutral-400">{new Date(e.last_seen_at).toLocaleString("pt-BR")}</td>
              <td className="flex gap-2">
                <form action={setStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="RESOLVED" /><button className="text-emerald-300">Resolvido</button></form>
                <form action={setStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="IGNORED" /><button className="text-neutral-400">Ignorar</button></form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!errors?.length && <p className="text-neutral-400">Nenhum erro aberto. 🎉</p>}
    </>
  );
}
