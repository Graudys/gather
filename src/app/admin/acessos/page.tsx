import type { Metadata } from "next";
import { z } from "zod";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { getAccessLogFor, listPeopleForAccess, maskIp } from "@/_data/admin-log";
import { consultAccess } from "@/_data/admin-log.actions";
import { personAction } from "@/_data/people.actions";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import { dataHora } from "@/lib/format";
import { t } from "@/_i18n";
import tbl from "@/_styles/admin/ErrorsTable.module.css";
import s from "@/_styles/admin/AdminPages.module.css";

export const metadata: Metadata = { title: "Registros de acesso" };
const EV = t.admin.erros.evento;

export default async function Acessos({ searchParams }: PageProps<"/admin/acessos">) {
  const { pessoa, erro } = (await searchParams) as { pessoa?: string; erro?: string };
  const people = await listPeopleForAccess();
  const log = pessoa && z.uuid().safeParse(pessoa).success ? await getAccessLogFor(pessoa) : null;

  return (
    <>
      <AdminTitle title="Registros de acesso" sub="Quem entrou, quando e de onde. Só entrada, saída e troca de senha: não registramos cada clique." />
      {erro && <Alert>Escolha a pessoa e o motivo.</Alert>}
      <form action={consultAccess} className={s.card}>
        <b className={s.cardTitle}>Por que você está consultando?</b>
        <p className={s.faint}>Registros de acesso só abrem com motivo. A consulta entra no Registro de ações e vale por 30 minutos.</p>
        <div className={s.inline}>
          <label className={`${s.label} ${s.grow}`}>Pessoa
            <select name="personId" className={s.select} defaultValue={log?.person.id ?? ""} required>
              <option value="" disabled>Escolha</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
            </select>
          </label>
          <label className={`${s.label} ${s.grow}`}>Motivo
            <select name="reason" className={s.select} required defaultValue="">
              <option value="" disabled>Escolha</option>
              <option>Suspeita de acesso indevido</option>
              <option>Pedido da própria pessoa</option>
              <option>Ordem judicial</option>
              <option>Investigar erro</option>
            </select>
          </label>
        </div>
        <input name="detail" className={s.input} maxLength={200} placeholder="Detalhe (opcional)" />
        <div><Button>Consultar</Button></div>
      </form>

      {log && (
        <section className={s.card}>
          <div className={s.cardHead}>
            <b className={s.cardTitle}>{log.person.name}</b>
            <span className={s.faint}>{log.person.email} · motivo: {log.reason}</span>
            <span className={s.spacer} />
            <a href={`/admin/acessos/csv?pessoa=${log.person.id}`}><Button variant="ghost">Baixar CSV</Button></a>
            <form action={personAction}>
              <input type="hidden" name="userId" value={log.person.id} />
              <input type="hidden" name="op" value="revoke" />
              <input type="hidden" name="reason" value={`Após consulta de acesso: ${log.reason}`.slice(0, 300)} />
              <Button variant="ghost">Encerrar sessões</Button>
            </form>
          </div>
          {log.rows.length === 0 ? <p className={s.muted}>Nenhum registro nos últimos 6 meses.</p> : (
            <table className={tbl.table}>
              <thead><tr><th>Quando</th><th>Evento</th><th>Como</th><th>IP</th><th>Aparelho</th></tr></thead>
              <tbody>
                {log.rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td className={tbl.muted}>{dataHora(r.createdAt.toISOString())}</td>
                    <td><span className={`${tbl.chip} ${r.event === "LOGIN_FAILED" ? tbl.NEW : ""}`}>{EV[r.event as keyof typeof EV] ?? r.event}</span></td>
                    <td className={tbl.muted}>{r.method ?? "—"}</td>
                    <td className={tbl.muted}>{maskIp(r.ip)}</td>
                    <td className={tbl.muted}>{r.userAgent ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className={s.faint}>Guardamos IP, data e hora por 6 meses (Marco Civil). Na tela o IP aparece cortado; o completo só sai na exportação quando o motivo é ordem judicial.</p>
        </section>
      )}
    </>
  );
}
