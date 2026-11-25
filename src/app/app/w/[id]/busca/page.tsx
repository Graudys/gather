import Link from "next/link";
import type { Metadata } from "next";
import { searchWorkspace } from "@/_data/search";
import { startConversation } from "@/_data/chat.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { dataHora } from "@/lib/format";
import { weekdayShort, localTime } from "@/lib/time";
import { PROJECT_STATUS } from "@/lib/projects";
import s from "@/_styles/projects/Projects.module.css";

export const metadata: Metadata = { title: "Busca" };

/** Marca o termo dentro do texto (sem HTML: só pedaços de texto do React). */
function Hl({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark style={{ background: "rgba(124,92,240,.35)", color: "inherit", borderRadius: 3 }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default async function Busca({ params, searchParams }: PageProps<"/app/w/[id]/busca">) {
  const { id } = await params;
  const { q = "" } = (await searchParams) as { q?: string };
  const r = await searchWorkspace(id, q);
  const total = r ? r.messages.length + r.tasks.length + r.projects.length + r.events.length + r.people.length : 0;
  return (
    <div className={s.page}>
      <form className={s.top} role="search">
        <input name="q" defaultValue={q} placeholder="Buscar mensagens, tarefas, projetos, eventos e pessoas" autoFocus maxLength={100}
          style={{ flex: 1, background: "var(--bg-input)", border: "1px solid var(--line-2)", borderRadius: 10, padding: "11px 14px", fontSize: 15 }} />
      </form>
      {!r && <p className={s.sub} style={{ marginTop: 0 }}>Digite pelo menos 2 letras.</p>}
      {r && total === 0 && <div className={s.empty}><b>Nada encontrado para “{r.q}”.</b><span>A busca só olha o que você pode ver, e mensagens dentro do prazo do workspace.</span></div>}

      {r && r.messages.length > 0 && (
        <section>
          <h2 className={s.groupTitle}>Mensagens · {r.messages.length}</h2>
          <div className={s.rows}>
            {r.messages.map((m) => (
              <Link key={m.id} href={m.href} className={s.row}>
                <span className={s.rowTitle}><b>{m.who}</b> · <Hl text={m.text} q={r.q} /></span>
                <span className={s.rowMeta}>{m.where} · {dataHora(m.at)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {r && r.tasks.length > 0 && (
        <section>
          <h2 className={s.groupTitle}>Tarefas · {r.tasks.length}</h2>
          <div className={s.rows}>
            {r.tasks.map((t) => (
              <Link key={t.id} href={t.href} className={s.row}>
                <span className={s.rowTitle} style={t.done ? { textDecoration: "line-through", color: "var(--text-muted)" } : undefined}><Hl text={t.title} q={r.q} /></span>
                <span className={s.rowMeta}>{t.project}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {r && r.projects.length > 0 && (
        <section>
          <h2 className={s.groupTitle}>Projetos · {r.projects.length}</h2>
          <div className={s.rows}>
            {r.projects.map((p) => (
              <Link key={p.id} href={p.href} className={s.row}><span className={s.rowTitle}><Hl text={p.name} q={r.q} /></span><span className={s.rowMeta}>{PROJECT_STATUS[p.status]}</span></Link>
            ))}
          </div>
        </section>
      )}
      {r && r.events.length > 0 && (
        <section>
          <h2 className={s.groupTitle}>Eventos · {r.events.length}</h2>
          <div className={s.rows}>
            {r.events.map((e) => (
              <Link key={e.id} href={e.href} className={s.row}><span className={s.rowTitle}><Hl text={e.title} q={r.q} /></span><span className={s.rowMeta}>{weekdayShort(e.at)} · {localTime(e.at)}</span></Link>
            ))}
          </div>
        </section>
      )}
      {r && r.people.length > 0 && (
        <section>
          <h2 className={s.groupTitle}>Pessoas · {r.people.length}</h2>
          <div className={s.rows}>
            {r.people.map((p) => (
              <form key={p.id} action={startConversation} className={s.row}>
                <input type="hidden" name="workspaceId" value={id} />
                <input type="hidden" name="userIds" value={p.id} />
                <Avatar id={p.id} name={p.name} small />
                <span className={s.rowTitle}><Hl text={p.name} q={r.q} /> <span className={s.rowMeta}>{p.email}</span></span>
                {!p.isMe && <button className={s.tab} style={{ cursor: "pointer", background: "none" }}>Mandar mensagem</button>}
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
