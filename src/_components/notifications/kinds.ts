import type { IconName } from "@/_components/ui/Icon";
import s from "@/_styles/app/Notifications.module.css";

/** Tipo do aviso → ícone, cor, rótulo do chip e filtro da página. Usado no sino e em Notificações. */
export const KIND: Record<string, [IconName, string, string, string]> = {
  dm: ["chat", s.blu, "Mensagem", "mencoes"],
  thread: ["chat", s.blu, "Resposta", "mencoes"],
  mention: ["chat", s.pur, "Menção", "mencoes"],
  channel_message: ["hash", s.blu, "Canal", "mencoes"],
  task_done: ["check", s.grn, "Concluída", "tarefas"],
  task_moved: ["board", s.grn, "Tarefa", "tarefas"],
  meeting_started: ["video", s.red, "Ao vivo", "reunioes"],
  task_assigned: ["task", s.grn, "Tarefa", "tarefas"],
  task_comment: ["task", s.grn, "Comentário", "tarefas"],
  task_due_soon: ["clock", s.ora, "Prazo", "tarefas"],
  task_overdue: ["clock", s.red, "Atrasada", "tarefas"],
  event_invite: ["cal", s.pur, "Convite", "reunioes"],
  event_reminder: ["clock", s.ora, "Lembrete", "reunioes"],
  workspace_added: ["users", s.pur, "Workspace", "convites"],
  help_question: ["help", s.ora, "Ajuda", "todas"],
  note_expiring: ["file", s.ora, "Notas", "todas"],
};
export const kindOf = (type: string) => KIND[type] ?? (["bell", s.blu, "Aviso", "todas"] as [IconName, string, string, string]);

export function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h`;
  if (min < 7 * 24 * 60) return `${Math.floor(min / 1440)} d`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
