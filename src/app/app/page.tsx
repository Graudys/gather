import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireReadyUser } from "@/lib/auth/dal";
import { Alert, Button, Field } from "@/components/ui";
import { createWorkspace } from "./actions";

export const metadata: Metadata = { title: "Seus workspaces" };

export default async function AppHome({ searchParams }: PageProps<"/app">) {
  await requireReadyUser("/app");
  const { erro, aviso } = (await searchParams) as { erro?: string; aviso?: string };
  const supabase = await createClient();
  // O RLS só devolve os workspaces de que a pessoa é membro.
  const { data: list } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, kind)")
    .order("joined_at");
  const items = (list ?? []).map((r) => ({ role: r.role as string, ...(r.workspaces as unknown as { id: string; name: string; kind: string }) }));
  const ownsTeam = items.some((w) => w.kind === "TEAM" && w.role === "OWNER");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Seus workspaces</h1>
      {erro && <Alert>{erro}</Alert>}
      {aviso === "senha-alterada" && <Alert tone="ok">Senha alterada. Os outros aparelhos saíram da conta.</Alert>}
      {aviso === "workspace-suspenso" && <Alert>Este workspace está suspenso. Fale com o suporte.</Alert>}
      <ul className="flex flex-col gap-2">
        {items.map((w) => (
          <li key={w.id}>
            <Link href={`/app/w/${w.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 hover:border-white/25">
              <span>{w.name}</span>
              <span className="text-xs text-neutral-400">{w.kind === "PERSONAL" ? "Espaço pessoal" : w.role === "OWNER" ? "Dono" : w.role === "ADMIN" ? "Admin" : "Membro"}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!ownsTeam && (
        <form action={createWorkspace} className="flex flex-col gap-3 rounded-xl border border-white/10 p-4">
          <Field label="Novo workspace de equipe" name="name" required maxLength={80} placeholder="Ex.: Estúdio Lumen" />
          <Button>Criar workspace</Button>
          <p className="text-xs text-neutral-500">No plano grátis, cada pessoa pode ser dona de 1 workspace de equipe e participar de quantos quiser.</p>
        </form>
      )}
    </main>
  );
}
