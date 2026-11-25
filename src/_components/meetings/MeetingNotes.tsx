"use client";
import { Icon } from "@/_components/ui/Icon";
import { useRef, useState } from "react";
import type { MeetingView } from "@/types/domain";
import { addDecision, createTaskFromMeeting, removeDecision, saveNotes } from "@/_data/meetings.actions";
import { Button } from "@/_components/ui/Button";
import s from "@/_styles/meetings/Meetings.module.css";

/** Notas compartilhadas, decisões e "Criar tarefa". Salva ao sair do campo. */
export function MeetingNotes({ m, workspaceId, projects }: { m: MeetingView; workspaceId: string; projects: { id: string; name: string }[] }) {
  const [state, setState] = useState<"" | "salvando" | "salvo">("");
  const decisionForm = useRef<HTMLFormElement>(null);
  const taskForm = useRef<HTMLFormElement>(null);
  const ids = (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="meetingId" value={m.id} />
    </>
  );

  return (
    <aside className={s.notes} aria-label="Notas da reunião">
      <b className={s.cardTitle}>Notas</b>
      <textarea
        key={m.notes.updatedAt ?? "vazio"}
        className={s.notesArea}
        defaultValue={m.notes.content}
        maxLength={20000}
        placeholder="O que foi falado, combinados, links…"
        onBlur={async (e) => {
          const content = e.currentTarget.value;
          if (content === m.notes.content) return;
          setState("salvando");
          const fd = new FormData();
          fd.set("workspaceId", workspaceId);
          fd.set("meetingId", m.id);
          fd.set("content", content);
          await saveNotes(fd);
          setState("salvo");
        }}
      />
      <span className={s.saved}>{state === "salvando" ? "Salvando…" : state === "salvo" ? "Notas salvas." : "Salva quando você clica fora do campo. Todo mundo da reunião vê."}</span>

      <b className={s.cardTitle}>Decisões</b>
      {m.notes.decisions.length === 0 && <p className={s.note}>Nenhuma ainda.</p>}
      {m.notes.decisions.map((d, i) => (
        <div key={i} className={s.decision}>
          <span>{d.text} <span className={s.by}>· {d.by}</span></span>
          <form action={removeDecision}>
            {ids}
            <input type="hidden" name="index" value={i} />
            <button className={s.x} aria-label="Tirar decisão">×</button>
          </form>
        </div>
      ))}
      <form
        ref={decisionForm}
        className={s.inline}
        action={async (fd) => {
          await addDecision(fd);
          decisionForm.current?.reset();
        }}
      >
        {ids}
        <input name="text" className={s.input} placeholder="Adicionar decisão" maxLength={300} required />
        <Button variant="ghost">+</Button>
      </form>

      <b className={s.cardTitle}>Tarefas desta reunião</b>
      {m.tasks.map((t) => (
        <a key={t.id} href={`/app/w/${workspaceId}/p/${t.projectId}?tarefa=${t.id}`} className={s.decision}><Icon name="box" size={14} /> <span>{t.title}</span></a>
      ))}
      {projects.length > 0 ? (
        <form
          ref={taskForm}
          className={s.label}
          action={async (fd) => {
            await createTaskFromMeeting(fd);
            taskForm.current?.reset();
          }}
        >
          {ids}
          <input name="title" className={s.input} placeholder="Nova tarefa" maxLength={200} required />
          <select name="projectId" className={s.select} defaultValue={m.project?.id ?? projects[0]!.id}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button variant="ghost">Criar tarefa</Button>
        </form>
      ) : (
        <p className={s.note}>Crie um projeto para mandar tarefas daqui para o quadro.</p>
      )}
    </aside>
  );
}
