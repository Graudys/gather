import type { ErrorRow } from "@/types/domain";
import { setErrorStatus } from "@/_data/admin.actions";
import { dataHora } from "@/lib/format";
import { Button } from "@/_components/ui/Button";
import { t } from "@/_i18n";
import s from "@/_styles/admin/ErrorsTable.module.css";

function StatusButton({ id, status, label, className }: { id: string; status: "RESOLVED" | "IGNORED"; label: string; className?: string }) {
  return (
    <form action={setErrorStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button variant="link" className={className}>{label}</Button>
    </form>
  );
}

export function ErrorsTable({ rows }: { rows: ErrorRow[] }) {
  if (!rows.length) return <div className={s.card}><p className={s.empty}>{t.admin.erros.vazio}</p></div>;
  const [cEstado, cErro, cOrigem, cVezes, cPessoas, cUltima] = t.admin.erros.colunas;
  return (
    <div className={s.card}>
      <table className={s.table}>
        <thead>
          <tr><th>{cEstado}</th><th>{cErro}</th><th>{cOrigem}</th><th className={s.num}>{cVezes}</th><th className={s.num}>{cPessoas}</th><th>{cUltima}</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td><span className={`${s.chip} ${s[e.status]}`}>{t.admin.erros.estado[e.status]}</span></td>
              <td><div className={s.message}>{e.message}</div><div className={s.where}>{e.location}{e.release ? ` · ${e.release}` : ""}</div></td>
              <td className={s.muted}>{e.source}</td>
              <td className={s.num}>{e.count}</td>
              <td className={s.num}>{e.usersAffected}</td>
              <td className={s.muted}>{dataHora(e.lastSeenAt)}</td>
              <td>
                <div className={s.actions}>
                  <StatusButton id={e.id} status="RESOLVED" label={t.admin.erros.resolver} className={s.resolve} />
                  <StatusButton id={e.id} status="IGNORED" label={t.admin.erros.ignorar} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
