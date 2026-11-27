"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import type { BoardView, TaskDetail } from "@/types/domain";
import { addComment, createLabel, deleteComment, deleteTask, moveTask, setAssignees, setLabels, updateTask } from "@/_data/projects.actions";
import { Avatar } from "@/_components/chat/Avatar";
import { Icon } from "@/_components/ui/Icon";
import { TaskFiles } from "@/_components/files/TaskFiles";
import { SendTaskToChannel } from "@/_components/projects/SendTaskToChannel";
import { LabelChip } from "@/_components/projects/TaskBadges";
import { Button } from "@/_components/ui/Button";
import { LABEL_COLORS, PRIORITY, inputDay } from "@/lib/projects";
import { dataHora } from "@/lib/format";
import s from "@/_styles/projects/Board.module.css";

/** Painel lateral da tarefa: cada campo salva sozinho ao mudar. */
export function TaskPanel({ task, board, workspaceId, closeHref }: { task: TaskDetail; board: BoardView; workspaceId: string; closeHref: string }) {
  const ids = { workspaceId, taskId: task.id };
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const save = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...ids, ...fields })) fd.set(k, v);
    return updateTask(fd);
  };

  return (
    <div className={s.panel}>
      <div className={s.panelHead}>
        <span className={s.chip}>{board.project.name}</span>
        {task.completed && <span className={`${s.chip} ${s.grn}`}>Concluída</span>}
        <span style={{ flex: 1 }} />
        <button type="button" className={`${s.btn2} ${sending ? s.btnOn : ""}`} onClick={() => setSending((v) => !v)} aria-expanded={sending}>
          <Icon name="send" size={14} /> Enviar pro canal
        </button>
        <Link href={closeHref} scroll={false} className={s.close} aria-label="Fechar tarefa"><Icon name="x" size={18} /></Link>
      </div>
      <div className={s.panelBody}>
        {sending && <SendTaskToChannel key={task.id} workspaceId={workspaceId} taskId={task.id} onClose={() => setSending(false)} />}
        <textarea
          key={`t-${task.title}`}
          className={s.titleInput}
          defaultValue={task.title}
          rows={2}
          maxLength={200}
          aria-label="Título"
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v && v !== task.title) save({ title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />

        <div className={s.fields}>
          <span className={s.fieldLabel}>Status</span>
          <select
            className={s.select}
            defaultValue={task.statusId}
            key={`st-${task.statusId}`}
            onChange={(e) => {
              const fd = new FormData();
              fd.set("workspaceId", workspaceId);
              fd.set("taskId", task.id);
              fd.set("statusId", e.currentTarget.value);
              moveTask(fd);
            }}
          >
            {board.statuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>

          <span className={s.fieldLabel}>Prioridade</span>
          <select className={s.select} defaultValue={task.priority} key={`p-${task.priority}`} onChange={(e) => save({ priority: e.currentTarget.value })}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <span className={s.fieldLabel}>Prazo</span>
          <input type="date" className={s.date} defaultValue={inputDay(task.dueAt)} key={`d-${task.dueAt}`} onChange={(e) => save({ dueAt: e.currentTarget.value })} />

          <span className={s.fieldLabel}>Responsáveis</span>
          <Assignees task={task} board={board} workspaceId={workspaceId} />

          <span className={s.fieldLabel}>Etiquetas</span>
          <Labels task={task} board={board} workspaceId={workspaceId} />
        </div>

        <div className={s.section}>
          <span className={s.sectionTitle}>Descrição</span>
          <textarea
            key={`desc-${task.description ?? ""}`}
            className={s.textarea}
            defaultValue={task.description ?? ""}
            maxLength={5000}
            placeholder="Detalhes, critérios, links…"
            onBlur={(e) => {
              const v = e.currentTarget.value;
              if (v !== (task.description ?? "")) save({ description: v });
            }}
          />
        </div>

        <div className={s.section}>
          <TaskFiles workspaceId={workspaceId} taskId={task.id} files={task.files} canManage={task.canDelete} />
        </div>

        <Comments task={task} workspaceId={workspaceId} />

        {task.activity.length > 0 && (
          <div className={s.section}>
            <span className={s.sectionTitle}>Atividade</span>
            <ul className={s.activity}>
              {task.activity.map((a, i) => <li key={i}>{a.text} · {dataHora(a.at)}</li>)}
            </ul>
          </div>
        )}

        <p className={s.muted}>
          Criada por {task.createdBy?.name ?? "alguém"} em {dataHora(task.createdAt)}
        </p>

        {task.canDelete && (
          confirming ? (
            <form action={deleteTask} className={s.section}>
              <input type="hidden" name="workspaceId" value={workspaceId} />
              <input type="hidden" name="taskId" value={task.id} />
              <span className={s.danger}>Apagar a tarefa com os comentários dela? Não dá para desfazer.</span>
              <span style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost">Apagar tarefa</Button>
                <Button type="button" variant="link" onClick={() => setConfirming(false)}>Cancelar</Button>
              </span>
            </form>
          ) : (
            <button type="button" className={s.linkBtn} onClick={() => setConfirming(true)}>Apagar tarefa</button>
          )
        )}
      </div>
    </div>
  );
}

function Assignees({ task, board, workspaceId }: { task: TaskDetail; board: BoardView; workspaceId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const chosen = new Set(task.assignees.map((a) => a.id));
  return (
    <details className={s.picker}>
      <summary>
        {task.assignees.length ? task.assignees.map((a) => <Avatar key={a.id} id={a.id} name={a.name} small />) : <span className={s.muted}>+ Adicionar</span>}
      </summary>
      <form ref={form} action={setAssignees} className={s.pickerBody} key={[...chosen].join()}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="taskId" value={task.id} />
        {board.people.map((p) => (
          <label key={p.id} className={s.pick}>
            <input type="checkbox" name="userIds" value={p.id} defaultChecked={chosen.has(p.id)} onChange={() => form.current?.requestSubmit()} />
            <Avatar id={p.id} name={p.name} small /> {p.name}
          </label>
        ))}
      </form>
    </details>
  );
}

function Labels({ task, board, workspaceId }: { task: TaskDetail; board: BoardView; workspaceId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const chosen = new Set(task.labels.map((l) => l.id));
  return (
    <details className={s.picker}>
      <summary>
        {task.labels.length ? task.labels.map((l) => <LabelChip key={l.id} l={l} />) : <span className={s.muted}>+ Etiqueta</span>}
      </summary>
      <div className={s.pickerBody}>
        <form ref={form} action={setLabels} key={[...chosen].join()}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="taskId" value={task.id} />
          {board.labels.length === 0 && <p className={s.muted}>Nenhuma etiqueta ainda.</p>}
          {board.labels.map((l) => (
            <label key={l.id} className={s.pick}>
              <input type="checkbox" name="labelIds" value={l.id} defaultChecked={chosen.has(l.id)} onChange={() => form.current?.requestSubmit()} />
              <LabelChip l={l} />
            </label>
          ))}
        </form>
        <form action={createLabel} className={s.section} style={{ borderTop: "1px solid var(--line-2)", paddingTop: 8 }}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="projectId" value={board.project.id} />
          <input type="hidden" name="taskId" value={task.id} />
          <input name="name" className={s.select} placeholder="Nova etiqueta" maxLength={30} required />
          <div className={s.colors}>
            {LABEL_COLORS.map((c, i) => (
              <label key={c} className={s.swatch}>
                <input type="radio" name="color" value={c} defaultChecked={i === 0} />
                <span style={{ background: c }} />
              </label>
            ))}
          </div>
          <Button variant="ghost">Criar</Button>
        </form>
      </div>
    </details>
  );
}

function Comments({ task, workspaceId }: { task: TaskDetail; workspaceId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <div className={s.section}>
      <span className={s.sectionTitle}>Comentários · {task.commentList.length}</span>
      {task.commentList.map((c) => (
        <div key={c.id} className={s.comment}>
          <Avatar id={c.author?.id ?? "x"} name={c.author?.name ?? "?"} small />
          <div>
            <div className={s.commentMeta}>
              <b style={{ color: "var(--text)" }}>{c.author?.name ?? "Pessoa removida"}</b> {dataHora(c.createdAt)}
              {(c.mine || task.canDelete) && (
                <form action={deleteComment}>
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="commentId" value={c.id} />
                  <button className={s.linkBtn}>apagar</button>
                </form>
              )}
            </div>
            <p className={s.commentText}>{c.content}</p>
          </div>
        </div>
      ))}
      <form
        ref={ref}
        action={async (fd) => {
          await addComment(fd);
          ref.current?.reset();
        }}
        className={s.section}
      >
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="taskId" value={task.id} />
        <textarea name="content" className={s.textarea} style={{ minHeight: 60 }} placeholder="Escreva um comentário" maxLength={4000} required />
        <span><Button>Comentar</Button></span>
      </form>
    </div>
  );
}
