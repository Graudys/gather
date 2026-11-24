import type { AdminKpis } from "@/types/domain";
import { t } from "@/_i18n";
import s from "@/_styles/admin/Kpis.module.css";

export function KpiGrid({ kpis }: { kpis: AdminKpis }) {
  const items = [
    [t.admin.visao.pessoas, kpis.pessoas],
    [t.admin.visao.workspaces, kpis.workspaces],
    [t.admin.visao.chamados, kpis.chamados],
    [t.admin.visao.erros, kpis.erros],
  ] as const;
  return (
    <div className={s.grid}>
      {items.map(([label, value]) => (
        <div key={label} className={s.kpi}>
          <small className={s.label}>{label}</small>
          <b className={s.value}>{value}</b>
        </div>
      ))}
    </div>
  );
}
