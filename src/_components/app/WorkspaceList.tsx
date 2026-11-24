import Link from "next/link";
import type { WorkspaceSummary } from "@/types/domain";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspaces.module.css";

export function WorkspaceList({ items }: { items: WorkspaceSummary[] }) {
  return (
    <ul className={s.list}>
      {items.map((w) => (
        <li key={w.id}>
          <Link href={`/app/w/${w.id}`} className={s.item}>
            <span>{w.name}</span>
            <span className={s.role}>{w.kind === "PERSONAL" ? t.app.workspaces.pessoal : t.app.workspaces.papel[w.role]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
