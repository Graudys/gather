import Link from "next/link";
import type { Metadata } from "next";
import { listMyTasks, listProjects } from "@/_data/projects";
import { toggleTaskDone } from "@/_data/projects.actions";
import { requireReadyUser } from "@/_lib/auth/dal";
import { Icon } from "@/_components/ui/Icon";
import { Modal } from "@/_components/ui/Modal";
import { AutoSubmit } from "@/_components/ui/AutoSubmit";
import { NewTaskForm } from "@/_components/projects/NewTaskForm";
import { DoneBox } from "@/_components/projects/DoneBox";
import { dayWindow, inputDay, shortDay } from "@/lib/projects";
import { TZ } from "@/lib/time";
import type { MyTask } from "@/types/domain";
import s from "@/_styles/app/Page.module.css";

export const metadata: Metadata = { title: "Minhas tarefas" };

const PRIO = { HIGH: ["Alta", s.red], MEDIUM: ["Média", s.ora], LOW: ["Baixa", s.grn] } as const;
const ORDER = ["Atrasadas", "Hoje", "Esta semana", "Depois", "Sem prazo"] as const;

function groupOf(t: MyTask, today: string, weekEnd: string) {
  if (!t.dueAt) return "Sem prazo";
  const d = inputDay(t.dueAt);
  if (d < today) return "Atrasadas";
  if (d === today) return "Hoje";
  if (d <= weekEnd) return "Esta semana";
  return "Depois";
}
function when(t: MyTask, g: string) {
  if (!t.dueAt) return "—";
  if (g === "Hoje") return "Hoje";
  if (g === "Esta semana") return new Date(t.dueAt).toLocaleDateString("pt-BR", { weekday: "short", timeZone: TZ }).replace(".", "").replace(/^./, (c) => c.toUpperCase());
  return shortDay(t.dueAt);
}

// Minhas tarefas (mockup "MinhasTarefas"): filtros, lista ou quadro, concluir na caixinha.
export default async function MinhasTarefas({ params, searchParams }: PageProps<"/app/w/[id]/tarefas">) {
  const { id } = await params;
  const sp = (await searchParams) as { projeto?: string; prioridade?: string; vista?: string; nova?: string; erro?: string; ok?: string };
  const [all, projects, me] = await Promise.all([listMyTasks(id), listProjects(id, { status: "ACTIVE" }), requireReadyUser()]);
  const { today, weekEnd } = dayWindow();
  const tasks = all.filter((t) => (!sp.projeto || t.project.id === sp.projeto) && (!sp.prioridade || t.priority === sp.prioridade));
  const groups = ORDER.map((g) => ({ g, items: tasks.filter((t) => groupOf(t, today, weekEnd) === g) }));
  const board = sp.vista === "quadro";
  const base = `/app/w/${id}/tarefas`;
  const qs = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ projeto: sp.projeto, prioridade: sp.prioridade, vista: sp.vista, ...extra })) if (v) u.set(k, v);
    const str = u.toString();
    return str ? `${base}?${str}` : base;
  };
  const taskProjects = [...new Map(all.map((t) => [t.project.id, t.project.name])).entries()];

  const row = (t: MyTask, g: string) => {
    const [label, color] = PRIO[t.priority];
    return (
      <div key={t.id} className={s.row}>
        <DoneBox action={toggleTaskDone} workspaceId={id} taskId={t.id} title={t.title} />
        <Link href={`/app/w/${id}/p/${t.project.id}?tarefa=${t.id}`} className={s.taskTitle}>{t.title}</Link>
        <span className={`${s.chip} ${s.hideSm}`}>{t.project.name}</span>
        <span className={`${s.chip} ${color}`}>{label}</span>
        <span className={`${s.mut} ${s.sm}`} style={{ width: 64, textAlign: "right", color: g === "Atrasadas" ? "var(--danger-text)" : undefined }}>{when(t, g)}</span>
      </div>
    );
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <h1>Minhas tarefas</h1>
        <span className={s.grow} />
        {projects.length > 0 && <Link href={qs({ nova: "1" })} scroll={false} className={s.btn}><Icon name="plus" size={15} /> Nova tarefa</Link>}
      </div>
      <p className={s.sub}>Tudo o que está atribuído a você e ainda não foi concluído, em todos os projetos deste workspace.</p>

      <form className={s.tools} action={base}>
        <select name="projeto" defaultValue={sp.projeto ?? ""} className={s.in} style={{ width: 200 }} aria-label="Projeto">
          <option value="">Todos os projetos</option>
          {taskProjects.map(([pid, name]) => <option key={pid} value={pid}>{name}</option>)}
        </select>
        <select name="prioridade" defaultValue={sp.prioridade ?? ""} className={s.in} style={{ width: 180 }} aria-label="Prioridade">
          <option value="">Qualquer prioridade</option>
          <option value="HIGH">Alta</option>
          <option value="MEDIUM">Média</option>
          <option value="LOW">Baixa</option>
        </select>
        {sp.vista && <input type="hidden" name="vista" value={sp.vista} />}
        <AutoSubmit />
        <div className={s.seg} role="group" aria-label="Ver como">
          <Link href={qs({ vista: undefined })} className={!board ? s.on : ""}><Icon name="list" size={14} /> Lista</Link>
          <Link href={qs({ vista: "quadro" })} className={board ? s.on : ""}><Icon name="kanban" size={14} /> Quadro</Link>
        </div>
      </form>

      {tasks.length === 0 && (
        <div className={s.empty}>
          <Icon name="task" size={26} />
          <b>{all.length ? "Nada com esses filtros" : "Nada pendente com você"}</b>
          <span>{all.length ? "Tente outro projeto ou prioridade." : "Quando alguém te colocar numa tarefa, ela aparece aqui."}</span>
        </div>
      )}

      {tasks.length > 0 && !board && groups.filter((x) => x.items.length).map(({ g, items }) => (
        <section key={g} style={{ marginBottom: 22 }}>
          <h3 className={s.sec}>{g} <span className={s.mut} style={{ fontWeight: 400 }}>· {items.length}</span></h3>
          <div className={`${s.card} ${s.rows}`} style={{ padding: "4px 18px" }}>{items.map((t) => row(t, g))}</div>
        </section>
      ))}

      {tasks.length > 0 && board && (
        <div className={s.kanban}>
          {groups.map(({ g, items }, i) => (
            <div key={g} className={s.kcol}>
              <div className={`${s.kh} ${s[`k${(i % 4) + 1}`]}`}><span>{g}</span><span className={s.kn}>{items.length}</span></div>
              {items.map((t) => {
                const [label, color] = PRIO[t.priority];
                return (
                  <div key={t.id} className={s.tk}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span className={`${s.chip} ${color}`}><Icon name="flag" size={11} /> {label}</span>
                      <span className={`${s.mut}`} style={{ marginLeft: "auto", fontSize: 11 }}>{when(t, g)}</span>
                    </div>
                    <Link href={`/app/w/${id}/p/${t.project.id}?tarefa=${t.id}`} className={s.tkTitle}>{t.title}</Link>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={s.chip}>{t.project.name}</span>
                      <span className={s.grow} />
                      <DoneBox action={toggleTaskDone} workspaceId={id} taskId={t.id} title={t.title} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {sp.nova && projects.length > 0 && (
        <Modal title="Nova tarefa" closeHref={qs({})} width={620}>
          <NewTaskForm workspaceId={id} closeHref={qs({})} projects={projects.map((p) => ({ id: p.id, name: p.name }))} me={me.id} erro={Boolean(sp.erro)} ok={Boolean(sp.ok)} />
        </Modal>
      )}
    </div>
  );
}
