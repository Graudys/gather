import type { WorkspaceView } from "@/types/domain";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspace.module.css";

export function ChannelSidebar({ view }: { view: WorkspaceView }) {
  return (
    <aside className={s.sidebar}>
      <b className={s.wsName}>{view.workspace.name}</b>
      {view.channels.length === 0 && <p className={s.retention}>{t.app.chat.semCanal}</p>}
      {view.channels.map((c) => (
        <a key={c.id} href={`?canal=${c.id}`} className={`${s.channel} ${c.id === view.current?.id ? s.active : ""}`}>
          {c.visibility === "PRIVATE" ? "🔒 " : "# "}{c.name}
        </a>
      ))}
      <p className={s.retention}>{t.app.chat.prazo(view.retention.messageMonths, view.retention.fileHours)}</p>
    </aside>
  );
}
