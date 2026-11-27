import Link from "next/link";
import type { BoardView } from "@/types/domain";
import { Avatar } from "@/_components/chat/Avatar";
import { DueChip, PriorityChip } from "@/_components/projects/TaskBadges";
import s from "@/_styles/projects/Board.module.css";

/** Vista em lista: uma tabela por coluna do quadro. */
export function TaskList({ board, taskHref }: { board: BoardView; taskHref: string }) {
  return (
    <div className={s.list}>
      {board.statuses.map((st) => {
        const rows = board.tasks.filter((t) => t.statusId === st.id);
        return (
          <section key={st.id} className={s.group}>
            <div className={s.groupHead}>{st.name} <span className={s.count}>{rows.length}</span></div>
            {rows.length === 0 && <p className={s.empty}>Nada aqui.</p>}
            {rows.map((t) => (
              <Link key={t.id} href={`${taskHref}${t.id}`} scroll={false} className={s.row}>
                <span className={`${s.rowTitle} ${t.completed ? s.done : ""}`}>{t.title}</span>
                <span><PriorityChip p={t.priority} /></span>
                <span className={s.meta}>{t.dueAt ? <DueChip dueAt={t.dueAt} completed={t.completed} /> : "—"}</span>
                <span className={s.faces}>{t.assignees.slice(0, 4).map((a) => <Avatar key={a.id} id={a.id} name={a.name} small />)}</span>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}
