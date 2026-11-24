import type { AccessRow } from "@/types/domain";
import { dataHora } from "@/lib/format";
import { t } from "@/_i18n";
import s from "@/_styles/admin/ErrorsTable.module.css";

const E = t.admin.erros;

export function AccessTable({ rows }: { rows: AccessRow[] }) {
  if (!rows.length) return <div className={s.card}><p className={s.empty}>—</p></div>;
  const [cQuando, cPessoa, cEvento, cIp, cAparelho] = E.acessosColunas;
  return (
    <div className={s.card}>
      <table className={s.table}>
        <thead><tr><th>{cQuando}</th><th>{cPessoa}</th><th>{cEvento}</th><th>{cIp}</th><th>{cAparelho}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={s.muted}>{dataHora(r.at)}</td>
              <td>{r.person}</td>
              <td><span className={`${s.chip} ${r.event === "LOGIN_FAILED" ? s.NEW : ""}`}>{E.evento[r.event as keyof typeof E.evento] ?? r.event}</span></td>
              <td className={s.muted}>{r.ip}</td>
              <td className={s.muted}>{r.device}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
