import type { LabelView, Priority } from "@/types/domain";
import { PRIORITY } from "@/lib/projects";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/projects/Board.module.css";

export function PriorityChip({ p }: { p: Priority }) {
  return <span className={`${s.prio} ${s[p]}`}><Icon name="flag" size={11} />{PRIORITY[p]}</span>;
}

export function LabelChip({ l }: { l: LabelView }) {
  return <span className={s.label} style={{ color: l.color, background: `${l.color}22` }}>{l.name}</span>;
}
