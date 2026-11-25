import { AdminTitle } from "@/_components/admin/AdminNav";
import { ErrorsTable } from "@/_components/admin/ErrorsTable";
import { listOpenErrors } from "@/_data/admin";
import { t } from "@/_i18n";

export default async function AdminErros() {
  const rows = await listOpenErrors();
  return (
    <>
      <AdminTitle title={t.admin.erros.titulo} sub={t.admin.erros.sub} />
      <ErrorsTable rows={rows} />
    </>
  );
}
