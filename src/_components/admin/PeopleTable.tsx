import type { PersonRow } from "@/_data/people";
import { personAction } from "@/_data/people.actions";
import { IssuePasswordButton } from "@/_components/admin/IssuePasswordButton";
import { data } from "@/lib/format";
import { t } from "@/_i18n";
import tbl from "@/_styles/admin/ErrorsTable.module.css";
import s from "@/_styles/admin/People.module.css";

const P = t.admin.pessoas;

function Op({ userId, op, label, danger, reason }: { userId: string; op: string; label: string; danger?: boolean; reason?: boolean }) {
  return (
    <form action={personAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="op" value={op} />
      {reason && <input className={s.reason} name="reason" placeholder={P.motivo} maxLength={300} required />}
      <button className={`${s.menuItem} ${danger ? s.danger : ""}`}>{label}</button>
    </form>
  );
}

export function PeopleTable({ rows, appUrl }: { rows: PersonRow[]; appUrl: string }) {
  if (rows.length <= 1) return <div className={tbl.card}><p className={tbl.empty}>{P.vazio}</p></div>;
  const [cPessoa, cPapel, cSituacao, cCriado] = P.colunas;
  return (
    <div className={tbl.card}>
      <table className={tbl.table}>
        <thead><tr><th>{cPessoa}</th><th>{cPapel}</th><th>{cSituacao}</th><th>{cCriado}</th><th /></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <div className={s.person}>{p.name}{p.isMe && <span className={s.me}>(você)</span>}</div>
                <div className={s.mail}>{p.email}</div>
              </td>
              <td><span className={`${s.chip} ${p.role === "admin" ? s.admin : ""}`}>{P.papel[p.role]}</span></td>
              <td><span className={`${s.chip} ${s[p.status]}`}>{P.situacao[p.status]}</span></td>
              <td className={tbl.muted}>{data(p.createdAt.toISOString())}</td>
              <td>
                {!p.isMe && (
                  <details className={s.menu}>
                    <summary aria-label={`Ações para ${p.name}`}>•••</summary>
                    <div className={s.menuBody}>
                      <IssuePasswordButton userId={p.id} appUrl={appUrl} />
                      {p.role === "admin"
                        ? <Op userId={p.id} op="remove_admin" label={P.tirarAdmin} />
                        : <Op userId={p.id} op="make_admin" label={P.tornarAdmin} />}
                      <Op userId={p.id} op="revoke" label={P.encerrar} />
                      {p.status === "desativado"
                        ? <Op userId={p.id} op="enable" label={P.reativar} />
                        : <Op userId={p.id} op="disable" label={P.desativar} danger reason />}
                    </div>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
