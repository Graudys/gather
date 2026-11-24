import type { WorkspaceView } from "@/types/domain";
import { Button } from "@/_components/ui/Button";
import { requestMeetings } from "@/_data/workspaces.actions";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspace.module.css";

export function ChannelSidebar({ view }: { view: WorkspaceView }) {
  return (
    <aside className={s.sidebar}>
      <b className={s.wsName}>{view.workspace.name}</b>
      {view.channels.map((c) => (
        <a key={c.id} href={`?canal=${c.id}`} className={`${s.channel} ${c.id === view.current?.id ? s.active : ""}`}>
          {c.visibility === "PRIVATE" ? "🔒 " : "# "}{c.name}
        </a>
      ))}
      <p className={s.retention}>{t.app.chat.prazo(view.retention.messageMonths, view.retention.fileHours)}</p>
      {view.workspace.kind === "TEAM" && !view.callsEnabled && (
        <form action={requestMeetings} className={s.request}>
          <input type="hidden" name="workspaceId" value={view.workspace.id} />
          <Button variant="ghost" block>{t.app.chat.reunioesEmBreve}</Button>
        </form>
      )}
    </aside>
  );
}
