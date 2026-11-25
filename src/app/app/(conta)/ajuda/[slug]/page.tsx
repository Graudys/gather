import Link from "next/link";
import type { Metadata } from "next";
import { getArticle } from "@/_data/help";
import { voteArticle } from "@/_data/help.actions";
import { Markdown } from "@/_components/help/Markdown";
import { Orbi } from "@/_components/help/Orbi";
import { AskOrbiButton } from "@/_components/help/OrbiWidget";
import { Icon } from "@/_components/ui/Icon";
import { PageCrumb } from "@/_components/shell/ShellContext";
import s from "@/_styles/help/Help.module.css";

export const metadata: Metadata = { title: "Ajuda" };

// Artigo da ajuda (mockup "AjudaArtigo").
export default async function Artigo({ params, searchParams }: PageProps<"/app/ajuda/[slug]">) {
  const { slug } = await params;
  const { votou } = (await searchParams) as { votou?: string };
  const a = await getArticle(slug.slice(0, 120));
  const words = a.body.split(/\s+/).length;
  // O título já vem no texto (# Título): tira para mostrar no cabeçalho do artigo.
  const body = a.body.replace(/^#\s+.+\n+/, "");
  return (
    <div className={`${s.page} ${s.articlePage}`}>
      <PageCrumb label={a.title} />
      <article className={s.grow}>
        <div className={s.crumbs}><Link href="/app/ajuda">Central de ajuda</Link> › <Link href={`/app/ajuda?cat=${a.category.slug}#${a.category.slug}`}>{a.category.name}</Link></div>
        <h1 className={s.articleTitle}>{a.title}</h1>
        <div className={s.muted}>Atualizado em {a.updatedAt.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(".", "")} · {Math.max(1, Math.round(words / 200))} min de leitura</div>
        <div className={s.articleBody}><Markdown text={body} /></div>
        {a.actionLabel && a.actionPath?.startsWith("/") && (
          <div className={s.note}><Icon name="info" size={16} /><span>Quer ir direto? <Link href={a.actionPath}>{a.actionLabel}</Link></span></div>
        )}
        <section className={`${s.card} ${s.feedback}`}>
          {votou ? (
            <span className={s.grow}>Obrigado pela resposta! Se ainda tiver dúvida, pergunte ao Orbi.</span>
          ) : (
            <>
              <span className={s.grow}>Este artigo ajudou?</span>
              {(["sim", "nao"] as const).map((v) => (
                <form key={v} action={voteArticle}>
                  <input type="hidden" name="slug" value={a.slug} />
                  <input type="hidden" name="helpful" value={v} />
                  <button className={s.btn2}>{v === "sim" ? <><Icon name="check" size={14} /> Sim</> : "Não"}</button>
                </form>
              ))}
            </>
          )}
        </section>
      </article>
      <aside className={s.aside}>
        {a.related.length > 0 && (
          <section className={s.card}>
            <h3>Relacionados</h3>
            {a.related.map((r) => <Link key={r.slug} href={`/app/ajuda/${r.slug}`} className={s.catLink}>{r.title}</Link>)}
          </section>
        )}
        <section className={`${s.card} ${s.center}`}>
          <Orbi mood="feliz" size={64} />
          <div style={{ fontSize: 14, margin: "8px 0 12px" }}>Ficou alguma dúvida?</div>
          <AskOrbiButton className={s.btn} question={a.title}>Perguntar ao Orbi</AskOrbiButton>
        </section>
      </aside>
    </div>
  );
}
