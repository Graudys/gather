import type { BoardView } from "@/types/domain";

/** Muda quando qualquer cartão muda de lugar, título ou dados visíveis: recria o quadro com os dados do servidor. */
export function boardKey(board: BoardView) {
  return board.tasks.map((t) => `${t.id}:${t.statusId}:${t.position}:${t.title.length}:${t.assignees.length}:${t.labels.length}:${t.comments}:${t.priority}:${t.dueAt ?? ""}`).join("|");
}
