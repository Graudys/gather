import Link from "next/link";
import type { Metadata } from "next";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { listAdminActions } from "@/_data/admin-log";
import { Button } from "@/_components/ui/Button";
import { dataHora } from "@/lib/format";
import tbl from "@/_styles/admin/ErrorsTable.module.css";
import s from "@/_styles/admin/AdminPages.module.css";

export const metadata: Metadata = { title: "Registro de ações" };
const KINDS = [["", "Todas as ações"], ["workspaces", "Workspaces"], ["pessoas", "Pessoas"], ["config", "Configurações e rotinas"], ["ajuda", "Central de ajuda"]] as const;

export default async function Registro({ searchParams }: PageProps<"/admin/registro">) {
  const { tipo = "", periodo = "30d" } = (await searchParams) as { tipo?: string; periodo?: string };
  const rows = await listAdminActions(tipo, periodo);
  const q = (o: Record<string, string>) => `/admin/registro?${new URLSearchParams({ tipo, periodo, ...o }).toString()}`;
  return (
    <>
      <div className={s.inline}>
        <div className={s.grow}><AdminTitle title="Registro de ações" sub="Tudo o que os admins fizeram, com o motivo. Nenhuma tela edita nem apaga este registro." /></div>
        <a href={`/admin/registro/csv?${new URLSearchParams({ tipo, periodo })}`}><Button variant="ghost">Baixar CSV</Button></a>
      </div>
      <nav className={s.tabs}>
        {KINDS.map(([v, l]) => <Link key={v} href={q({ tipo: v })} className={`${s.tab} ${tipo === v ? s.tabOn : ""}`}>{l}</Link>)}
        <span className={s.spacer} />
        <Link href={q({ periodo: "30d" })} className={`${s.tab} ${periodo !== "12m" ? s.tabOn : ""}`}>30 dias</Link>
        <Link href={q({ periodo: "12m" })} className={`${s.tab} ${periodo === "12m" ? s.tabOn : ""}`}>12 meses</Link>
      </nav>
      <div className={tbl.card}>
        {rows.length === 0 ? <p className={tbl.empty}>Nada neste período.</p> : (
          <table className={tbl.table}>
            <thead><tr><th>Quando</th><th>Ação</th><th>Alvo</th><th>Motivo</th><th>Quem</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={tbl.muted}>{dataHora(r.at)}</td>
                  <td>{r.action}</td>
                  <td className={tbl.muted}>{r.target}</td>
                  <td>{r.reason}</td>
                  <td className={tbl.muted}>{r.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
