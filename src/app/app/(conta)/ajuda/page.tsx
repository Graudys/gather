import Link from "next/link";
import type { Metadata } from "next";
import { listHelp, searchHelp } from "@/_data/help";
import { Orbi } from "@/_components/help/Orbi";
import { AskOrbiButton } from "@/_components/help/OrbiWidget";
import { Icon, type IconName } from "@/_components/ui/Icon";
import s from "@/_styles/help/Help.module.css";

export const metadata: Metadata = { title: "Central de ajuda" };
const ICONS: Record<string, IconName> = { spark: "home", chat: "chat", board: "task", calendar: "cal", user: "user", users: "users", video: "video", shield: "shield" };

// Central de ajuda (mockup "AjudaCentral").
export default async function Ajuda({ searchParams }: PageProps<"/app/ajuda">) {
  const { q = "", cat } = (await searchParams) as { q?: string; cat?: string };
  const [cats, found] = await Promise.all([listHelp(), q ? searchHelp(q) : Promise.resolve(null)]);
  const open = cats.find((c) => c.slug === cat);
  return (
    <div className={s.page}>
      <div className={s.hero}>
        <div className={s.grow}>
          <h1 className={s.title}>Como podemos ajudar?</h1>
          <form className={s.searchBox} role="search" action="/app/ajuda">
            <Icon name="search" size={18} />
            <input type="search" name="q" defaultValue={q} placeholder="Ex.: adicionar pessoas, prazo das mensagens" aria-label="Buscar na ajuda" maxLength={100} />
          </form>
        </div>
        <span className={s.mascot}><Orbi mood={found && found.length === 0 ? "pensando" : "feliz"} size={120} /></span>
      </div>

      {found && (
        <section className={s.card}>
          <div className={s.catHead}><h3>Resultados para “{q}”</h3><Link href="/app/ajuda" className={s.lk}>Limpar</Link></div>
          {found.length === 0 && <p className={s.muted}>Nada encontrado. <AskOrbiButton className={s.lkBtn} question={q}>Pergunte ao Orbi</AskOrbiButton> ou mande a dúvida para o admin por ele.</p>}
          {found.map((a) => (
            <Link key={a.slug} href={`/app/ajuda/${a.slug}`} className={s.result}>
              <b>{a.title}</b>
              <span>{a.summary}</span>
            </Link>
          ))}
        </section>
      )}

      {cats.length === 0 ? (
        <p className={s.empty}>Ainda não há artigos publicados. O admin cria em Admin › Central de ajuda.</p>
      ) : (
        <div className={s.cats}>
          {cats.map((c, i) => {
            const all = open?.id === c.id;
            return (
              <section key={c.id} className={s.card} style={{ animationDelay: `${i * 40}ms` }} id={c.slug}>
                <div className={s.catHead}>
                  <span className={s.badge}><Icon name={ICONS[c.icon] ?? "help"} size={16} /></span>
                  <h3>{c.name}</h3>
                </div>
                {(all ? c.articles : c.articles.slice(0, 3)).map((a) => <Link key={a.slug} href={`/app/ajuda/${a.slug}`} className={s.catLink}>{a.title}</Link>)}
                {c.articles.length > 3 && (
                  <Link href={all ? "/app/ajuda" : `/app/ajuda?cat=${c.slug}#${c.slug}`} className={s.lk}>{all ? "Ver menos" : `Ver todos (${c.articles.length})`}</Link>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className={`${s.card} ${s.more}`}>
        <Orbi mood="feliz" size={52} />
        <div className={s.grow}>
          <b>Ainda precisa de ajuda?</b>
          <div className={s.muted}>Pergunte ao Orbi. Se ele não souber, manda a sua dúvida para o admin do Gather.</div>
        </div>
        <AskOrbiButton className={s.btn}>Perguntar ao Orbi</AskOrbiButton>
      </section>
    </div>
  );
}
