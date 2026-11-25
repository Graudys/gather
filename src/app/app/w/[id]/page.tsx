import type { Metadata } from "next";
import Link from "next/link";
import { getHome } from "@/_data/home";
import { Icon, type IconName } from "@/_components/ui/Icon";
import { Avatar } from "@/_components/chat/Avatar";
import { NewWorkspaceButton } from "@/_components/shell/ShellContext";
import { TZ, localTime, localDay } from "@/lib/time";
import s from "@/_styles/app/Home.module.css";

export const metadata: Metadata = { title: "Início" };

const PRIORITY = { HIGH: ["Alta", s.red], MEDIUM: ["Média", s.ora], LOW: ["Baixa", s.grn] } as const;

function greeting() {
  const h = Number(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
function when(iso: string | null) {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const today = localDay(new Date());
  if (day < today) return "Atrasada";
  if (day === today) return "Hoje";
  return new Date(`${day}T15:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: TZ }).replace(".", "").replace(/^./, (c) => c.toUpperCase());
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Início do workspace (mockup "Home" e, quando está tudo vazio, "InicioVazio").
export default async function Inicio({ params }: PageProps<"/app/w/[id]">) {
  const { id } = await params;
  const h = await getHome(id);
  const base = `/app/w/${id}`;
  const first = h.me.name.split(" ")[0];
  const doneSteps = h.steps.filter((x) => x.done).length;
  const fresh = doneSteps < h.steps.length && h.tasks.length === 0 && h.meetings.length === 0;
  const kpis: [IconName, string, number, string, string][] = [
    ["task", s.blu, h.dueToday, "Tarefas para hoje", `${base}/tarefas`],
    ["video", s.pur, h.meetings.length, "Eventos hoje", `${base}/agenda`],
    ["chat", s.ora, h.unreadTotal, "Mensagens não lidas", `${base}/mensagens`],
    ["folder", s.grn, h.projects.length, "Projetos ativos", `${base}/projetos`],
  ];

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1>{fresh ? `Boas-vindas, ${first}` : `${greeting()}, ${first}`}</h1>
        <span className={s.grow} />
        <Link href={h.projects[0] ? `${base}/p/${h.projects[0].id}` : `${base}/projetos?novo=1`} className={s.btn}><Icon name="plus" size={15} /> {h.projects[0] ? "Nova tarefa" : "Novo projeto"}</Link>
      </div>
      <p className={s.sub}>
        {h.meetings.length || h.dueToday
          ? `Você tem ${plural(h.meetings.length, "evento", "eventos")} e ${plural(h.dueToday, "tarefa", "tarefas")} para hoje.`
          : "Nada marcado para hoje. Bom momento para organizar o que vem pela frente."}
      </p>

      {h.kind === "PERSONAL" && (
        <div className={`${s.card} ${s.promo}`}>
          <span className={`${s.sp} ${s.pur}`}><Icon name="user" size={18} /></span>
          <div className={s.grow}>
            <b>Este é o seu espaço pessoal</b>
            <div className={s.mut}>Use o Gather sozinho aqui. Crie um workspace quando quiser trabalhar com outras pessoas.</div>
          </div>
          <NewWorkspaceButton className={s.btn}>Criar workspace</NewWorkspaceButton>
        </div>
      )}

      {fresh && (
        <section className={`${s.card} ${s.steps}`}>
          <div className={s.stepsHead}>
            <h3>Primeiros passos</h3>
            <span className={s.mut}>{doneSteps} de {h.steps.length}</span>
          </div>
          <div className={s.bar}><div style={{ width: `${(doneSteps / h.steps.length) * 100}%` }} /></div>
          {h.steps.map((x) => (
            <Link key={x.href} href={`${base}/${x.href}`} className={`${s.row} ${x.done ? s.done : ""}`}>
              <span className={s.tick}>{x.done && <Icon name="check" size={13} />}</span>
              <span className={s.grow}>{x.label}</span>
              {!x.done && <Icon name="right" size={14} />}
            </Link>
          ))}
        </section>
      )}

      <div className={s.kpis}>
        {kpis.map(([icon, color, n, label, href]) => (
          <Link key={label} href={href} className={`${s.card} ${s.kpi}`}>
            <span className={`${s.sp} ${color}`}><Icon name={icon} size={18} /></span>
            <div><b>{n}</b><small>{label}</small></div>
          </Link>
        ))}
      </div>

      <div className={s.grid}>
        <div className={s.fg}>
          <section className={s.card}>
            <h3>Agenda de hoje</h3>
            {h.meetings.length === 0 && <p className={s.empty}>Nenhum evento hoje. <Link href={`${base}/agenda/novo`}>Marcar um</Link></p>}
            {h.meetings.map((m) => (
              <div key={m.id} className={s.row}>
                <span className={s.time}>{localTime(m.startsAt)}</span>
                <span className={s.grow}><b>{m.title}</b><div className={s.mutSm}>até {localTime(m.endsAt)}</div></span>
                {m.hasMeeting && m.meetingId
                  ? <Link href={`${base}/reuniao/${m.meetingId}`} className={s.btn}><Icon name="video" size={14} /> Entrar</Link>
                  : <Link href={`${base}/agenda?evento=${m.id}`} className={s.btn2}>Detalhes</Link>}
              </div>
            ))}
          </section>
          <section className={s.card}>
            <h3>Minhas tarefas</h3>
            {h.tasks.length === 0 && <p className={s.empty}>Nenhuma tarefa com você agora.</p>}
            {h.tasks.map((t) => {
              const [label, color] = PRIORITY[t.priority];
              return (
                <Link key={t.id} href={`${base}/p/${t.project.id}?tarefa=${t.id}`} className={s.row}>
                  <span className={s.box} aria-hidden="true" />
                  <span className={s.grow}>{t.title}<div className={s.mutSm}>{t.project.name}</div></span>
                  <span className={`${s.chip} ${color}`}>{label}</span>
                  <span className={`${s.due} ${when(t.dueAt) === "Atrasada" ? s.late : ""}`}>{when(t.dueAt)}</span>
                </Link>
              );
            })}
            {h.tasks.length > 0 && <Link href={`${base}/tarefas`} className={s.more}>Ver todas</Link>}
          </section>
        </div>
        <div className={s.fg}>
          <section className={s.card}>
            <h3>Mensagens não lidas</h3>
            {h.unreadChats.length === 0 && <p className={s.empty}>Tudo lido por aqui.</p>}
            {h.unreadChats.map((c) => (
              <Link key={c.id} href={`${base}/${c.href}`} className={s.row}>
                {c.channel ? <span className={s.hash}><Icon name="hash" size={14} /></span> : <Avatar id={c.id} name={c.title} />}
                <span className={s.grow}><b>{c.channel ? `# ${c.title}` : c.title}</b><div className={s.mutSm}>{plural(c.unread, "mensagem nova", "mensagens novas")}</div></span>
                <span className={s.chip}>{c.unread}</span>
              </Link>
            ))}
          </section>
          <section className={s.card}>
            <h3>Projetos ativos</h3>
            {h.projects.length === 0 && <p className={s.empty}>Nenhum projeto ativo. <Link href={`${base}/projetos?novo=1`}>Criar projeto</Link></p>}
            {h.projects.slice(0, 5).map((p) => {
              const total = p.openTasks + p.doneTasks;
              const pct = total ? Math.round((p.doneTasks / total) * 100) : 0;
              return (
                <Link key={p.id} href={`${base}/p/${p.id}`} className={s.proj}>
                  <span className={s.projName}><span>{p.name}</span><small>{pct}%</small></span>
                  <span className={s.bar}><span style={{ width: `${pct}%` }} /></span>
                </Link>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
