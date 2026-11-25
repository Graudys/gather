import type { Metadata } from "next";
import { WorkspaceList } from "@/_components/app/WorkspaceList";
import { CreateWorkspaceForm } from "@/_components/app/CreateWorkspaceForm";
import { Alert } from "@/_components/ui/Alert";
import { getTeamWorkspaceLimit, listMyWorkspaces } from "@/_data/workspaces";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspaces.module.css";

export const metadata: Metadata = { title: "Workspaces" };

// Criar workspace (mockup "WorkspaceNovo") + a lista dos que a pessoa já tem.
export default async function NovoWorkspace({ searchParams }: PageProps<"/app/novo-workspace">) {
  const { erro, aviso } = (await searchParams) as { erro?: string; aviso?: string };
  const [items, limit] = await Promise.all([listMyWorkspaces(), getTeamWorkspaceLimit()]);
  return (
    <div className={s.page}>
      <h1 className={s.title}>Criar workspace</h1>
      <p className={s.lead}>Um workspace junta pessoas, canais, projetos e agenda. Você pode ter vários.</p>
      {erro === "limite" && <Alert>{t.app.workspaces.limiteAtingido}</Alert>}
      {erro === "nome" && <Alert>Dê um nome de até 80 caracteres.</Alert>}
      {aviso === "workspace-suspenso" && <Alert>{t.app.workspaces.suspenso}</Alert>}
      {limit.canCreate ? <CreateWorkspaceForm max={limit.max} /> : <Alert>{t.app.workspaces.limiteAtingido}</Alert>}
      <h2 className={s.subtitle}>Seus workspaces</h2>
      <WorkspaceList items={items} />
    </div>
  );
}
