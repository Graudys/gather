import type { Metadata } from "next";
import { WorkspaceList } from "@/_components/app/WorkspaceList";
import { CreateWorkspaceForm } from "@/_components/app/CreateWorkspaceForm";
import { Alert } from "@/_components/ui/Alert";
import { listMyWorkspaces } from "@/_data/workspaces";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspaces.module.css";

export const metadata: Metadata = { title: t.app.workspaces.titulo };

export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const { erro, aviso } = (await searchParams) as { erro?: string; aviso?: string };
  const items = await listMyWorkspaces();
  const ownsTeam = items.some((w) => w.kind === "TEAM" && w.role === "OWNER");
  return (
    <main className={s.page}>
      <h1 className={s.title}>{t.app.workspaces.titulo}</h1>
      {erro && <Alert>{erro}</Alert>}
      {aviso === "senha-alterada" && <Alert tone="ok">{t.app.workspaces.senhaAlterada}</Alert>}
      {aviso === "workspace-suspenso" && <Alert>{t.app.workspaces.suspenso}</Alert>}
      <WorkspaceList items={items} />
      {!ownsTeam && <CreateWorkspaceForm />}
    </main>
  );
}
