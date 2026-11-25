import Link from "next/link";
import { Icon } from "@/_components/ui/Icon";
import type { Metadata } from "next";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { listWorkspacesAdmin } from "@/_data/admin-workspaces";
import { dataHora } from "@/lib/format";
import tbl from "@/_styles/admin/ErrorsTable.module.css";
import s from "@/_styles/admin/AdminPages.module.css";

export const metadata: Metadata = { title: "Workspaces" };
const FILTERS = [["", "Todos"], ["reunioes", "Com reuniões no mês"], ["inativos", "Inativos há 30 dias"], ["suspensos", "Suspensos"]] as const;

export default async function AdminWorkspaces({ searchParams }: PageProps<"/admin/workspaces">) {
  const { filtro } = (await searchParams) as { filtro?: string };
  const rows = await listWorkspacesAdmin(filtro);
  return (
    <>
      <AdminTitle title="Workspaces" sub="Workspaces de equipe. Espaços pessoais não aparecem aqui." />
      <nav className={s.tabs}>
        {FILTERS.map(([v, l]) => <Link key={v} href={v ? `/admin/workspaces?filtro=${v}` : "/admin/workspaces"} className={`${s.tab} ${(filtro ?? "") === v ? s.tabOn : ""}`}>{l}</Link>)}
      </nav>
      <div className={tbl.card} style={{ overflow: "visible" }}>
        {rows.length === 0 ? <p className={tbl.empty}>Nenhum workspace aqui.</p> : (
          <table className={tbl.table}>
            <thead><tr><th>Workspace</th><th>Dono</th><th className={tbl.num}>Pessoas</th><th>Última mensagem</th><th>Reuniões</th><th className={tbl.num}>Minutos no mês</th><th></th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td><Link href={`/admin/workspaces/${w.id}`} className={tbl.message}>{w.name}</Link>{w.suspended && <> <span className={`${s.chip} ${s.bad}`}>suspenso</span></>}</td>
                  <td className={tbl.muted}>{w.owner}</td>
                  <td className={tbl.num}>{w.people}</td>
                  <td className={tbl.muted}>{w.last ? dataHora(w.last) : "—"}</td>
                  <td><span className={`${s.chip} ${w.calls ? s.ok : ""}`}>{w.calls ? "ligadas" : "desligadas"}</span></td>
                  <td className={tbl.num}>{w.used} de {w.quota}</td>
                  <td className={s.rowActions}>
                    <details className={s.rowMenu}>
                      <summary className={s.manageBtn}>Gerenciar <Icon name="down" size={13} /></summary>
                      <div className={s.rowMenuBody}>
                        <Link href={`/admin/workspaces/${w.id}`}><Icon name="sliders" size={14} /> Abrir detalhes</Link>
                        <Link href={`/admin/workspaces/${w.id}?modal=transferir`}><Icon name="key" size={14} /> Transferir propriedade</Link>
                        <Link href={`/admin/workspaces/${w.id}?modal=adicionar`}><Icon name="plus" size={14} /> Adicionar pessoa</Link>
                        <Link href={`/admin/workspaces/${w.id}?modal=suspender`} className={s.menuDanger}><Icon name="shield" size={14} /> {w.suspended ? "Reativar" : "Suspender"}</Link>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className={s.faint}>{rows.length} {rows.length === 1 ? "workspace" : "workspaces"} · ordenado pela última mensagem.</p>
    </>
  );
}
