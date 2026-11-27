import Link from "next/link";
import type { ChatMessage } from "@/types/domain";
import { Icon } from "@/_components/ui/Icon";
import { DUE_LABEL, PRIORITY, dueState } from "@/lib/projects";
import s from "@/_styles/chat/Chat.module.css";

/** Cartão de reunião: "Entrar" enquanto está aberta; depois, encerrada com a duração. */
export function MeetingCard({ meeting, workspaceId }: { meeting: NonNullable<ChatMessage["meeting"]>; workspaceId: string }) {
  const href = `/app/w/${workspaceId}/reuniao/${meeting.id}`;
  const state = meeting.open ? "Áudio · aberta agora" : meeting.cancelled ? "Cancelada" : meeting.minutes ? `Encerrada · ${meeting.minutes} min` : "Encerrada";
  return (
    <div className={`${s.card} ${meeting.open ? "" : s.cardOff}`}>
      <span className={`${s.cardIc} ${s.cardIcMeet}`}><Icon name="mic" size={18} /></span>
      <span className={s.cardText}><b>{meeting.title}</b><small>{state}</small></span>
      {meeting.open ? <Link href={href} className={s.cardBtn}>Entrar</Link> : <Link href={href} className={s.cardLink}>Ver</Link>}
    </div>
  );
}

const PRIO_CLASS = { HIGH: s.cRed, MEDIUM: s.cOra, LOW: s.cGrn } as const;

/** Cartão de tarefa: mostra o estado atual. Sem acesso ao projeto, só o aviso. */
export function TaskCard({ task, workspaceId }: { task: NonNullable<ChatMessage["task"]>; workspaceId: string }) {
  if (task.hidden) {
    return (
      <div className={`${s.card} ${s.cardOff}`}>
        <span className={s.cardIc}><Icon name="lock" size={16} /></span>
        <span className={s.cardText}><b>Tarefa de um projeto privado</b><small>Só quem participa do projeto vê os detalhes.</small></span>
      </div>
    );
  }
  const due = dueState(task.dueAt, task.done);
  return (
    <Link href={`/app/w/${workspaceId}/p/${task.projectId}?tarefa=${task.id}`} className={`${s.card} ${s.cardTask}`}>
      <span className={`${s.cardIc} ${s.cardIcTask}`}><Icon name={task.done ? "ok" : "task"} size={18} /></span>
      <span className={s.cardText}>
        <span className={s.cardChips}>
          <span className={`${s.cChip} ${PRIO_CLASS[task.priority]}`}><Icon name="flag" size={11} /> {PRIORITY[task.priority]}</span>
          {(due === "late" || due === "today" || due === "tomorrow") && <span className={`${s.cChip} ${due === "late" ? s.cRed : s.cAmb}`}>{DUE_LABEL[due]}</span>}
          {task.done && <span className={`${s.cChip} ${s.cGrn}`}>Concluída</span>}
        </span>
        <b className={task.done ? s.cardDone : ""}>{task.title}</b>
        <small>{task.projectName} · {task.column}{task.who ? ` · ${task.who}` : ""}</small>
      </span>
    </Link>
  );
}
