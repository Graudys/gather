import Link from "next/link";
import type { Metadata } from "next";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { getHelpAdmin } from "@/_data/help";
import { addCategory, dismissQuestion, importStarter } from "@/_data/admin-help.actions";
import { Button } from "@/_components/ui/Button";
import { dataHora } from "@/lib/format";
import tbl from "@/_styles/admin/ErrorsTable.module.css";
import s from "@/_styles/admin/HelpAdmin.module.css";

export const metadata: Metadata = { title: "Central de ajuda" };

export default async function AdminAjuda() {
  const d = await getHelpAdmin();
  const rate = d.stats.asked ? Math.round((d.stats.answered / d.stats.asked) * 100) : 0;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}><AdminTitle title="Central de ajuda" sub="Os artigos são a única fonte das respostas do Orbi." /></div>
        <Link href="/admin/ajuda/novo"><Button>Novo artigo</Button></Link>
      </div>
      <div className={s.kpis}>
        <div className={s.kpi}><div className={s.kpiLabel}>Artigos publicados</div><div className={s.kpiValue}>{d.stats.published}</div></div>
        <div className={s.kpi}><div className={s.kpiLabel}>Perguntas ao Orbi (90 dias)</div><div className={s.kpiValue}>{d.stats.asked}</div></div>
        <div className={s.kpi}><div className={s.kpiLabel}>O Orbi achou artigo</div><div className={s.kpiValue}>{rate}%</div></div>
      </div>

      <div className={s.grid}>
        <div className={tbl.card}>
          {d.articles.length === 0 ? (
            <div className={tbl.empty} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <span>Nenhum artigo ainda.</span>
              <form action={importStarter}><Button variant="ghost">Carregar 10 artigos iniciais</Button></form>
            </div>
          ) : (
            <table className={tbl.table}>
              <thead><tr><th>Artigo</th><th>Situação</th><th className={tbl.num}>Vistas</th><th className={tbl.num}>Ajudou</th><th>Atualizado</th></tr></thead>
              <tbody>
                {d.articles.map((a) => (
                  <tr key={a.id}>
                    <td><Link href={`/admin/ajuda/${a.id}`} className={tbl.message}>{a.title}</Link><div className={tbl.where}>{a.category.name}</div></td>
                    <td><span className={`${s.chip} ${a.status === "PUBLISHED" ? s.pub : ""}`}>{a.status === "PUBLISHED" ? "Publicado" : "Rascunho"}</span></td>
                    <td className={tbl.num}>{a.views}</td>
                    <td className={tbl.num}>{a.helpfulYes + a.helpfulNo ? `${Math.round((a.helpfulYes / (a.helpfulYes + a.helpfulNo)) * 100)}%` : "—"}</td>
                    <td className={tbl.muted}>{dataHora(a.updatedAt.toISOString())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className={s.card}>
            <b className={s.cardTitle}>Perguntas sem resposta</b>
            <p className={s.note}>O que o Orbi não achou, o que não ajudou e o que mandaram para você. Sem nome de quem perguntou (quem mandou para o admin aparece nas suas notificações).</p>
            {d.questions.length === 0 && <p className={s.note}>Nenhuma por enquanto.</p>}
            {d.questions.map((q) => (
              <div key={q.id} className={s.q}>
                <span>“{q.question}”</span>
                <div className={s.qMeta}>
                  <span>{q.sentToAdmin ? "Mandada para o admin" : q.helpful === false ? `Não ajudou: ${q.article?.title ?? ""}` : "Sem artigo"}</span>
                  <span>{dataHora(q.createdAt.toISOString())}</span>
                </div>
                <div className={s.qMeta}>
                  <Link className={s.link} href={`/admin/ajuda/novo?pergunta=${q.id}`}>Criar artigo</Link>
                  <form action={dismissQuestion}><input type="hidden" name="id" value={q.id} /><button className={s.linkBtn}>Dispensar</button></form>
                </div>
              </div>
            ))}
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Assuntos</b>
            {d.categories.map((c) => <span key={c.id} className={s.note}>{c.name} · {c._count.articles}</span>)}
            <form action={addCategory} className={s.row}>
              <input name="name" className={`${s.input} ${s.grow}`} placeholder="Novo assunto" maxLength={60} required />
              <Button variant="ghost">+</Button>
            </form>
            {d.articles.length > 0 && <form action={importStarter}><button className={s.linkBtn} style={{ color: "var(--text-muted)" }}>Carregar artigos iniciais que faltam</button></form>}
          </section>
        </div>
      </div>
    </>
  );
}
