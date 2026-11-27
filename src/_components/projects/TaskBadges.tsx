import type { LabelView, Priority } from "@/types/domain";
import { DUE_LABEL, PRIORITY, dueState, shortDay } from "@/lib/projects";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/projects/Board.module.css";

export function PriorityChip({ p }: { p: Priority }) {
  return <span className={`${s.prio} ${s[p]}`}><Icon name="flag" size={11} />{PRIORITY[p]}</span>;
}

export function LabelChip({ l }: { l: LabelView }) {
  return <span className={s.label} style={{ color: l.color, background: `${l.color}22` }}>{l.name}</span>;
}

/**
 * Prazo no cartão: vermelho "Atrasada", laranja "Vence hoje/amanhã",
 * verde quando concluída e neutro no resto. O texto diz a situação,
 * não só a cor (acessível para quem não distingue cores).
 */
export function DueChip({ dueAt, completed }: { dueAt: string; completed: boolean }) {
  const st = dueState(dueAt, completed);
  const cls = { late: s.dueLate, today: s.dueSoon, tomorrow: s.dueSoon, done: s.dueDone, ok: "" }[st];
  return (
    <span className={`${s.dueChip} ${cls}`} title={DUE_LABEL[st] || "Prazo"}>
      <Icon name={st === "done" ? "check" : "clock"} size={12} />
      {shortDay(dueAt)}
      {(st === "late" || st === "today" || st === "tomorrow") && <b>· {DUE_LABEL[st]}</b>}
    </span>
  );
}
