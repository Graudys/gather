"use client";
import { Icon } from "@/_components/ui/Icon";
import Link from "next/link";
import { useRef, useState } from "react";
import type { BoardView, TaskCard } from "@/types/domain";
import { createTask, moveTask } from "@/_data/projects.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { DueChip, LabelChip, PriorityChip } from "@/_components/projects/TaskBadges";
import s from "@/_styles/projects/Board.module.css";

type Drop = { statusId: string; index: number } | null;

/**
 * Quadro com arrastar e soltar. Ao soltar, o cartão muda na hora (otimista)
 * e o servidor grava só a posição dele (entre as vizinhas).
 * Sem mouse: abra a tarefa e troque o Status no painel.
 */
export function Board({ board, workspaceId, taskHref, newHref, manageHref }: { board: BoardView; workspaceId: string; taskHref: string; newHref: string; manageHref: string | null }) {
  const [tasks, setTasks] = useState<TaskCard[]>(board.tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  // Dados novos do servidor chegam com outra `key` (ver BoardKey) e recriam o estado.

  const columns = board.statuses.map((st) => ({ ...st, tasks: tasks.filter((t) => t.statusId === st.id) }));

  async function onDrop(statusId: string, index: number) {
    const id = dragId;
    setDragId(null);
    setDrop(null);
    if (!id) return;
    const col = tasks.filter((t) => t.statusId === statusId && t.id !== id);
    const before = col[index - 1]?.id ?? "";
    const after = col[index]?.id ?? "";
    const moving = tasks.find((t) => t.id === id);
    if (!moving) return;
    // Otimista: tira de onde estava e coloca na nova posição.
    const rest = tasks.filter((t) => t.id !== id);
    const moved = { ...moving, statusId, completed: board.statuses.find((x) => x.id === statusId)?.isCompleted ?? false };
    const anchor = after ? rest.findIndex((t) => t.id === after) : before ? rest.findIndex((t) => t.id === before) + 1 : rest.length;
    setTasks([...rest.slice(0, anchor), moved, ...rest.slice(anchor)]);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("taskId", id);
    fd.set("statusId", statusId);
    fd.set("beforeId", before);
    fd.set("afterId", after);
    await moveTask(fd);
  }

  return (
    <div className={s.board}>
      {columns.map((col, ci) => (
        <section
          key={col.id}
          className={`${s.col} ${drop?.statusId === col.id ? s.colOver : ""}`}
          aria-label={col.name}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            if (drop?.statusId !== col.id) setDrop({ statusId: col.id, index: col.tasks.filter((t) => t.id !== dragId).length });
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (drop) onDrop(drop.statusId, drop.index);
          }}
        >
          <div className={`${s.kh} ${s[`k${col.isCompleted ? 4 : Math.min(ci + 1, 3)}`]}`}>
            <Icon name={col.isCompleted ? "task" : ci === 0 ? "list" : "clock"} size={14} />
            <span className={s.khName}>{col.name}</span>
            <span className={s.n}>{col.tasks.length}</span>
            <span className={s.khTools}>
              <Link href={`${newHref}${col.id}`} scroll={false} aria-label={`Nova tarefa em ${col.name}`} title="Nova tarefa"><Icon name="plus" size={14} /></Link>
              {manageHref && <Link href={manageHref} aria-label="Ajustar colunas" title="Ajustar colunas"><Icon name="more" size={14} /></Link>}
            </span>
          </div>
          <div className={s.cards}>
            {col.tasks.map((t) => {
                const visible = col.tasks.filter((x) => x.id !== dragId);
                const idx = visible.findIndex((x) => x.id === t.id);
                return (
                  <div key={t.id}>
                    {drop?.statusId === col.id && drop.index === idx && t.id !== dragId && <div className={s.dropLine} />}
                    <Card
                      t={t}
                      href={`${taskHref}${t.id}`}
                      dragging={dragId === t.id}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDrop(null);
                      }}
                      onDragOver={(e) => {
                        if (!dragId || t.id === dragId) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        const below = e.clientY > r.top + r.height / 2;
                        setDrop({ statusId: col.id, index: idx + (below ? 1 : 0) });
                      }}
                    />
                  </div>
                );
              })}
            {drop?.statusId === col.id && drop.index >= col.tasks.filter((x) => x.id !== dragId).length && <div className={s.dropLine} />}
          </div>
          <QuickAdd workspaceId={workspaceId} projectId={board.project.id} statusId={col.id} />
        </section>
      ))}
    </div>
  );
}

function Card({ t, href, dragging, onDragStart, onDragEnd, onDragOver }: {
  t: TaskCard; href: string; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; onDragOver: (e: React.DragEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`${s.card} ${dragging ? s.dragging : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <div className={s.cardTop}>
        <PriorityChip p={t.priority} />
        {t.labels.slice(0, 3).map((l) => <LabelChip key={l.id} l={l} />)}
      </div>
      <h4 className={`${s.cardTitle} ${t.completed ? s.done : ""}`}>{t.title}</h4>
      {t.description && <p className={s.cardDesc}>{t.description}</p>}
      {t.dueAt && <div className={s.due}><DueChip dueAt={t.dueAt} completed={t.completed} /></div>}
      <div className={s.cardFoot}>
        <span className={s.faces}>
          {t.assignees.slice(0, 4).map((a) => <Avatar key={a.id} id={a.id} name={a.name} small />)}
        </span>
        <span className={s.counts}>
          <span title="Comentários"><Icon name="chat" size={13} /> {t.comments}</span>
        </span>
      </div>
    </Link>
  );
}

function QuickAdd({ workspaceId, projectId, statusId }: { workspaceId: string; projectId: string; statusId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={s.add}
      action={async (fd) => {
        if (!String(fd.get("title") ?? "").trim()) return;
        await createTask(fd);
        ref.current?.reset();
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="statusId" value={statusId} />
      <input name="title" className={s.addInput} placeholder="+ Adicionar tarefa" maxLength={200} aria-label="Nova tarefa nesta coluna" autoComplete="off" />
    </form>
  );
}

