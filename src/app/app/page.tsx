import { redirect } from "next/navigation";
import { requireReadyUser } from "@/_lib/auth/dal";
import { lastWorkspaceId } from "@/_data/shell";

// /app abre direto o último workspace (ou o primeiro). Sem nenhum: criar.
export default async function AppHome() {
  const user = await requireReadyUser("/app");
  const ws = await lastWorkspaceId(user.id);
  redirect(ws ? `/app/w/${ws}` : "/app/novo-workspace");
}
