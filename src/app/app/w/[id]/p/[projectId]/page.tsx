import { PageCrumb } from "@/_components/shell/ShellContext";
import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoard, getTaskDetail } from "@/_data/projects";
import { getSessionUser } from "@/_lib/auth/dal";
import { Board } from "@/_components/projects/Board";
import { boardKey } from "@/_components/projects/boardKey";
import { TaskList } from "@/_components/projects/TaskList";
import { TaskPanel } from "@/_components/projects/TaskPanel";
import { NewTaskForm } from "@/_components/projects/NewTaskForm";
import { Avatar } from "@/_components/chat/Avatar";
import { Drawer, Modal } from "@/_components/ui/Modal";
import { AutoSubmit } from "@/_components/ui/AutoSubmit";
import { PROJECT_STATUS, shortDay } from "@/lib/projects";
import { id as Id } from "@/lib/validation";
import type { TaskCard } from "@/types/domain";
import s from "@/_styles/projects/Board.module.css";

export const metadata: Metadata = { title: "Projeto" };

const PRIO_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
const STATUS_COLOR = { ACTIVE: s.grn, PAUSED: s.amb, COMPLETED: s.blu, ARCHIVED: "" } as const;
type SP = { tarefa?: string; vista?: string; minhas?: string; q?: string; prio?: string; ordem?: string; nova?: string; coluna?: string; erro?: string; ok?: string };

// Quadro do projeto (mockup "Board"); a tarefa abre no painel lateral ("Ov_TarefaPainel").
export default async function ProjectPage({ params, searchParams }: PageProps<"/app/w/[id]/p/[projectId]">) {
  const { id, projectId } = await params;
  if (!Id.safeParse(projectId).success) notFound();
  const sp = (await searchParams) as SP;
  const [board, me] = await Promise.all([getBoard(id, projectId), getSessionUser()]);

  const list = sp.vista === "lista";
  const base = `/app/w/${id}/p/${projectId}`;
  const keep: Record<string, string | undefined> = { vista: list ? "lista" : undefined, minhas: sp.minhas, q: sp.q, prio: sp.prio, ordem: sp.ordem };
  const q = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...extra })) if (v) u.set(k, v);
    const str = u.toString();
    return str ? `${base}?${str}` : base;
  };
  const here = q({});
  const term = sp.q?.trim().toLowerCase();
  let tasks: TaskCard[] = board.tasks.filter((t) =>
    (sp.minhas !== "1" || t.assignees.some((a) => a.id === me?.id)) &&
    (!sp.prio || t.priority === sp.prio) &&
    (!term || t.title.toLowerCase().includes(term) || (t.description ?? "").toLowerCase().includes(term)),
  );
  if (sp.ordem === "prazo") tasks = [...tasks].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  if (sp.ordem === "prioridade") tasks = [...tasks].sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority]);
  const shown = { ...board, tasks };
  const filtering = Boolean(sp.minhas || sp.prio || term);
  const taskId = sp.tarefa && Id.safeParse(sp.tarefa).success ? sp.tarefa : null;
  const task = taskId && board.tasks.some((t) => t.id === taskId) ? await getTaskDetail(id, taskId) : null;
  const p = board.project;
  const taskHref = `${here}${here.includes("?") ? "&" : "?"}tarefa=`;
  const people = board.people;

  return (
    <div className={s.wrap}>
      <PageCrumb label={p.name} />
      <header className={s.head}>
        <div className={s.headRow}>
          <h1 className={s.title}>{p.name}</h1>
          {board.canManage && <Link href={`${base}/ajustes`} className={s.ic} aria-label="Editar projeto" title="Editar projeto"><Icon name="edit" size={16} /></Link>}
          <span className={`${s.chip} ${STATUS_COLOR[p.status]}`}>{PROJECT_STATUS[p.status]}</span>
          <span className={s.grow} />
          <span className={s.stk} title={people.map((x) => x.name).join(", ")}>
            {people.slice(0, 4).map((x) => <Avatar key={x.id} id={x.id} name={x.name} />)}
            {people.length > 4 && <span className={s.more}>+{people.length - 4}</span>}
          </span>
          {p.channelId && <Link href={`/app/w/${id}/c/${p.channelId}`} className={s.btn2}><Icon name="hash" size={14} /> Canal</Link>}
          {board.canManage && <Link href={`${base}/ajustes`} className={s.btn2}><Icon name="sliders" size={14} /> Ajustes</Link>}
        </div>
        <div className={s.meta}>
          {p.startDate || p.dueDate ? <>Prazo: <b>{p.startDate ? shortDay(p.startDate) : "—"} a {p.dueDate ? shortDay(p.dueDate) : "—"}</b></> : "Sem prazo"}
          {p.team.name !== "Geral" && <> · Equipe: <b>{p.team.name}</b></>}
          {p.description && <> · {p.description}</>}
        </div>

        <div className={s.toolbar}>
          <div className={s.seg} role="group" aria-label="Ver como">
            <Link href={q({ vista: undefined })} className={!list ? s.on : ""}><Icon name="kanban" size={14} /> Quadro</Link>
            <Link href={q({ vista: "lista" })} className={list ? s.on : ""}><Icon name="list" size={14} /> Lista</Link>
            {board.canSeeInsights && <Link href={`${base}/desempenho`} title="Só dono e admin veem"><Icon name="chart" size={14} /> Desempenho</Link>}
          </div>
          <span className={s.grow} />
          <form action={base} className={s.srch} role="search">
            <Icon name="search" size={14} />
            <input name="q" defaultValue={sp.q} placeholder="Buscar tarefas" aria-label="Buscar tarefas" maxLength={80} />
            {Object.entries(keep).filter(([k, v]) => v && k !== "q").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <AutoSubmit />
          </form>
          <details className={s.drop}>
            <summary className={`${s.btn2} ${filtering ? s.btnOn : ""}`}><Icon name="filter" size={14} /> Filtrar{filtering ? " ·" : ""}</summary>
            <div className={s.menu}>
              <span className={s.menuTitle}>Prioridade</span>
              {([["", "Qualquer"], ["HIGH", "Alta"], ["MEDIUM", "Média"], ["LOW", "Baixa"]] as const).map(([v, l]) => (
                <Link key={v} href={q({ prio: v || undefined })} className={`${s.menuItem} ${(sp.prio ?? "") === v ? s.menuOn : ""}`}>{l}{(sp.prio ?? "") === v && <Icon name="check" size={14} />}</Link>
              ))}
              <span className={s.menuSep} />
              <Link href={q({ minhas: sp.minhas ? undefined : "1" })} className={`${s.menuItem} ${sp.minhas ? s.menuOn : ""}`}>Só as minhas{sp.minhas && <Icon name="check" size={14} />}</Link>
              {filtering && <Link href={q({ minhas: undefined, prio: undefined, q: undefined })} className={s.menuItem}>Limpar filtros</Link>}
            </div>
          </details>
          <details className={s.drop}>
            <summary className={s.btn2}><Icon name="sort" size={14} /> Ordenar</summary>
            <div className={s.menu}>
              {([["", "Manual (arrastar)"], ["prazo", "Prazo"], ["prioridade", "Prioridade"]] as const).map(([v, l]) => (
                <Link key={v} href={q({ ordem: v || undefined })} className={`${s.menuItem} ${(sp.ordem ?? "") === v ? s.menuOn : ""}`}>{l}{(sp.ordem ?? "") === v && <Icon name="check" size={14} />}</Link>
              ))}
            </div>
          </details>
          <Link href={q({ nova: "1" })} scroll={false} className={s.btn}><Icon name="plus" size={14} /> Nova tarefa</Link>
        </div>
      </header>

      {list ? (
        <TaskList board={shown} taskHref={taskHref} />
      ) : (
        <Board key={boardKey(shown)} board={shown} workspaceId={id} taskHref={taskHref} newHref={`${here}${here.includes("?") ? "&" : "?"}nova=1&coluna=`} manageHref={board.canManage ? `${base}/ajustes` : null} />
      )}

      {task && (
        <Drawer closeHref={here} label={task.title}>
          <TaskPanel key={task.id} task={task} board={board} workspaceId={id} closeHref={here} />
        </Drawer>
      )}
      {sp.nova && (
        <Modal title="Nova tarefa" closeHref={here} width={620}>
          <NewTaskForm
            workspaceId={id}
            closeHref={here}
            me={me?.id ?? ""}
            erro={Boolean(sp.erro)}
            ok={Boolean(sp.ok)}
            project={{ id: p.id, statuses: board.statuses, people: board.people, labels: board.labels }}
            statusId={sp.coluna}
          />
        </Modal>
      )}
    </div>
  );
}
