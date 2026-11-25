import type { Metadata } from "next";
import Link from "next/link";
import { listNotifications } from "@/_data/notifications";
import { clearRead, markAllRead, openNotification } from "@/_data/notifications.actions";
import { Button } from "@/_components/ui/Button";
import { Icon, type IconName } from "@/_components/ui/Icon";
import { dataHora } from "@/lib/format";
import s from "@/_styles/app/Notifications.module.css";

export const metadata: Metadata = { title: "Notificações" };

const KIND: Record<string, [IconName, string, string, string]> = {
  // tipo: ícone, cor, rótulo do chip, filtro
  dm: ["chat", s.blu, "Mensagem", "mencoes"],
  thread: ["chat", s.blu, "Resposta", "mencoes"],
  task_assigned: ["task", s.grn, "Tarefa", "tarefas"],
  task_comment: ["task", s.grn, "Comentário", "tarefas"],
  event_invite: ["cal", s.pur, "Convite", "reunioes"],
  event_reminder: ["clock", s.ora, "Lembrete", "reunioes"],
  workspace_added: ["users", s.pur, "Workspace", "convites"],
  help_question: ["help", s.ora, "Ajuda", "todas"],
};
const FILTERS: [string, string][] = [["todas", "Todas"], ["naolidas", "Não lidas"], ["mencoes", "Menções"], ["convites", "Convites"], ["reunioes", "Reuniões"], ["tarefas", "Tarefas"]];

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h`;
  if (min < 7 * 24 * 60) return `${Math.floor(min / 1440)} d`;
  return dataHora(iso).slice(0, 5);
}

// Notificações (mockup "Notificacoes"): filtros por tipo e linhas com ícone, chip e hora.
export default async function Notificacoes({ searchParams }: PageProps<"/app/notificacoes">) {
  const { f = "todas" } = (await searchParams) as { f?: string };
  const all = await listNotifications();
  const unread = all.filter((n) => !n.read).length;
  const items = all.filter((n) => f === "todas" || (f === "naolidas" ? !n.read : KIND[n.type]?.[3] === f));
  return (
    <div className={s.page}>
      <div className={s.top}>
        <h1 className={s.title}>Notificações</h1>
        <span className={s.spacer} />
        {unread > 0 && <form action={markAllRead}><Button variant="ghost">Marcar todas como lidas</Button></form>}
        {all.length > unread && <form action={clearRead}><Button variant="link">Limpar lidas</Button></form>}
      </div>
      <nav className={s.filters} aria-label="Filtrar">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={k === "todas" ? "/app/notificacoes" : `/app/notificacoes?f=${k}`} className={f === k ? s.fOn : ""} aria-current={f === k ? "page" : undefined}>
            {label}{k === "naolidas" && unread > 0 ? ` · ${unread}` : ""}
          </Link>
        ))}
        <span className={s.spacer} />
        <Link href="/app/perfil#avisos" className={s.prefs}><Icon name="sliders" size={14} /> Preferências</Link>
      </nav>
      {items.length === 0 && (
        <div className={s.empty}>
          <Icon name="bell" size={26} />
          <b>Nada por aqui</b>
          <span>Mensagens diretas, respostas, tarefas, convites e lembretes aparecem aqui.</span>
        </div>
      )}
      <ul className={s.list}>
        {items.map((n, i) => {
          const [icon, color, chip] = KIND[n.type] ?? ["bell", s.blu, "Aviso"];
          return (
            <li key={n.id} style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
              <form action={openNotification}>
                <input type="hidden" name="id" value={n.id} />
                <button className={`${s.item} ${n.read ? "" : s.unread}`}>
                  <span className={`${s.icon} ${color}`}><Icon name={icon} size={16} /></span>
                  <span className={s.text}>
                    <span className={s.itemTitle}>{n.title}{n.count > 1 && <span className={s.count}> · {n.count} novas</span>}</span>
                    {n.body && <span className={s.body}>{n.body}</span>}
                    <span className={s.meta}><span className={s.chip}>{chip}</span>{n.workspace && <span>{n.workspace}</span>}</span>
                  </span>
                  <span className={s.time} title={dataHora(n.at)}>{ago(n.at)}</span>
                  {!n.read && <span className={s.dot} aria-label="Não lida" />}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
