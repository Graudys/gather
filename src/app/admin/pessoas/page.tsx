import type { Metadata } from "next";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { PeopleTable } from "@/_components/admin/PeopleTable";
import { CreateAccessForm } from "@/_components/admin/CreateAccessForm";
import { listPeople, listTeamWorkspacesForAdmin } from "@/_data/people";
import { publicEnv } from "@/lib/env";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: "Pessoas" };

export default async function AdminPessoas() {
  const [rows, workspaces] = await Promise.all([listPeople(), listTeamWorkspacesForAdmin()]);
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "");
  return (
    <>
      <AdminTitle title={t.admin.pessoas.titulo} sub={t.admin.pessoas.sub} />
      <CreateAccessForm workspaces={workspaces} appUrl={appUrl} />
      <PeopleTable rows={rows} appUrl={appUrl} />
    </>
  );
}
