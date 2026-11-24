import { AdminTitle } from "@/_components/admin/AdminNav";
import { KpiGrid } from "@/_components/admin/KpiGrid";
import { getAdminKpis } from "@/_data/admin";
import { t } from "@/_i18n";

export default async function AdminHome() {
  const kpis = await getAdminKpis();
  return (
    <>
      <AdminTitle title={t.admin.visao.titulo} />
      <KpiGrid kpis={kpis} />
    </>
  );
}
