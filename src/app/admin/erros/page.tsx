import { AdminTitle } from "@/_components/admin/AdminNav";
import { ErrorsTable } from "@/_components/admin/ErrorsTable";
import { AccessTable } from "@/_components/admin/AccessTable";
import { listOpenErrors, listRecentAccess } from "@/_data/admin";
import { t } from "@/_i18n";
import s from "@/_styles/admin/AdminShell.module.css";

export default async function AdminErros() {
  const [rows, access] = await Promise.all([listOpenErrors(), listRecentAccess()]);
  return (
    <>
      <AdminTitle title={t.admin.erros.titulo} sub={t.admin.erros.sub} />
      <ErrorsTable rows={rows} />
      <h2 className={s.h2}>{t.admin.erros.acessosTitulo}</h2>
      <AccessTable rows={access} />
    </>
  );
}
