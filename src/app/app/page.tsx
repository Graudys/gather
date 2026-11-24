import type { Metadata } from "next";
import { WorkspaceList } from "@/_components/app/WorkspaceList";
import { CreateWorkspaceForm } from "@/_components/app/CreateWorkspaceForm";
import { Alert } from "@/_components/ui/Alert";
import { getTeamWorkspaceLimit, listMyWorkspaces } from "@/_data/workspaces";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspaces.module.css";

export const metadata: Metadata = { title: t.app.workspaces.titulo };

export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const { erro, aviso } = (await searchParams) as { erro?: string; aviso?: string };
  const [items, limit] = await Promise.all([listMyWorkspaces(), getTeamWorkspaceLimit()]);
  return (
    <main className={s.page}>
      <h1 className={s.title}>{t.app.workspaces.titulo}</h1>
      {erro === "limite" && <Alert>{t.app.workspaces.limiteAtingido}</Alert>}
      {erro === "nome" && <Alert>Dê um nome de até 80 caracteres.</Alert>}
      {aviso === "workspace-suspenso" && <Alert>{t.app.workspaces.suspenso}</Alert>}
      <WorkspaceList items={items} />
      {limit.canCreate && <CreateWorkspaceForm max={limit.max} />}
    </main>
  );
}
