import { Button } from "@/_components/ui/Button";
import { Input } from "@/_components/ui/Field";
import { sendMessage } from "@/_data/workspaces.actions";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspace.module.css";

export function Composer({ workspaceId, channelId, channelName }: { workspaceId: string; channelId: string; channelName: string }) {
  return (
    <form action={sendMessage} className={s.composer}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="channelId" value={channelId} />
      <Input name="content" required maxLength={LIMITES.mensagem} placeholder={t.app.chat.placeholder(channelName)} autoComplete="off" />
      <Button>{t.app.chat.enviar}</Button>
    </form>
  );
}
