import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/_lib/auth/auth";
import { db } from "@/_lib/db/prisma";
import type { WorkspaceRole } from "@/generated/prisma/enums";

/**
 * Camada de acesso (DAL). Toda página, Server Action e rota passa por aqui
 * antes de ler ou mudar dados. Sem RLS: esta é a barreira, por isso cada
 * função de src/_data/* chama uma destas antes de tocar no banco.
 */

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  mustChangePassword: boolean;
  ready: boolean; // trocou a senha e aceitou 18+ e termos
};

/** Pessoa da sessão (conferida no banco a cada requisição). `null` se não entrou. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user || s.user.banned) return null;
  const u = s.user;
  const mustChange = u.mustChangePassword !== false;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role === "admin" ? "admin" : "user",
    mustChangePassword: mustChange,
    ready: !mustChange && Boolean(u.ageConfirmedAt) && Boolean(u.termsAcceptedAt),
  };
});

export async function requireUser(next?: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Modo manutenção (Admin › Configurações): uma leitura por requisição. */
// Guardado 20 s na memória do servidor: não custa uma consulta por página.
let maint: { on: boolean; at: number } | null = null;
const maintenanceOn = cache(async () => {
  if (maint && Date.now() - maint.at < 20_000) return maint.on;
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { maintenanceMode: true } });
  maint = { on: Boolean(cfg?.maintenanceMode), at: Date.now() };
  return maint.on;
});
/** Chamado ao salvar as configurações, para valer na hora. */
export async function forgetMaintenanceCache() {
  maint = null;
}

/** Entrou E já fez o primeiro acesso (senha nova, 18+, termos). Em manutenção, só o admin passa. */
export async function requireReadyUser(next?: string) {
  const user = await requireUser(next);
  if (!user.ready) redirect("/primeiro-acesso");
  if (user.role !== "admin" && (await maintenanceOn())) redirect("/manutencao");
  return user;
}

/** Uma consulta de membro por workspace por requisição (layout e página reaproveitam). */
const memberRow = cache(async (workspaceId: string, userId: string) =>
  db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, workspace: { select: { id: true, name: true, kind: true, suspendedAt: true } } },
  }),
);

/** Garante que a pessoa é membro do workspace. Devolve o papel dela. */
export async function requireMember(workspaceId: string, allowed?: WorkspaceRole[]) {
  const user = await requireReadyUser();
  const m = await memberRow(workspaceId, user.id);
  // Não dizer se o workspace existe para quem não é membro.
  if (!m) notFound();
  if (m.workspace.suspendedAt) redirect("/app/novo-workspace?aviso=workspace-suspenso");
  if (allowed && !allowed.includes(m.role)) notFound();
  return { user, role: m.role, workspace: m.workspace };
}

/** Admin do Gather (role = "admin"). Quem não é recebe 404, sem dizer que a área existe. */
export async function requireAdmin() {
  const user = await requireReadyUser("/admin");
  if (user.role !== "admin") notFound();
  return user;
}
