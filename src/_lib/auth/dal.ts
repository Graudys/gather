import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/_lib/supabase/server";

/**
 * Camada de acesso (DAL). Toda página, Server Action e rota passa por aqui
 * antes de ler ou mudar dados. O RLS no banco é a segunda barreira.
 */

export type SessionUser = { id: string; email: string | null; aal: string };

/** Pessoa da sessão, com o JWT conferido. `null` se não entrou. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const c = data.claims;
  return { id: c.sub, email: (c.email as string | undefined) ?? null, aal: (c.aal as string | undefined) ?? "aal1" };
});

export async function requireUser(next?: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Conta ativa e com 18+ e termos aceitos (contas do Google confirmam em /boas-vindas). */
export async function requireReadyUser(next?: string) {
  const user = await requireUser(next);
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, status, onboarding_step")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status !== "ACTIVE") redirect("/conta-bloqueada");
  if (profile.onboarding_step < 1) redirect("/boas-vindas");
  return { ...user, displayName: profile.display_name as string };
}

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

/** Garante que a pessoa é membro do workspace. Devolve o papel dela. */
export async function requireMember(workspaceId: string, allowed?: WorkspaceRole[]) {
  const user = await requireReadyUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, kind, suspended_at)")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  // Não dizer se o workspace existe para quem não é membro.
  if (!data) notFound();
  const ws = data.workspaces as unknown as { id: string; name: string; kind: string; suspended_at: string | null };
  if (ws.suspended_at) redirect("/app?aviso=workspace-suspenso");
  const role = data.role as WorkspaceRole;
  if (allowed && !allowed.includes(role)) notFound();
  return { user, role, workspace: ws };
}

/**
 * Admin da plataforma: precisa estar em platform_admins E ter entrado com
 * segundo fator (aal2). Sem MFA vai para /admin/mfa.
 */
export async function requirePlatformAdmin() {
  const user = await requireUser("/admin");
  const supabase = await createClient();
  const { data: row } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!row) notFound();
  if (user.aal !== "aal2") redirect("/admin/mfa");
  return user;
}

/** Só confere se é admin (sem exigir MFA): usado pela própria tela de MFA. */
export async function isPlatformAdminRow(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
