import type { MessageView } from "@/types/domain";
import { dataHora } from "@/lib/format";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspace.module.css";

// Texto renderizado pelo React: o que a pessoa digita nunca vira HTML.
export function MessageList({ messages }: { messages: MessageView[] }) {
  if (!messages.length) return <div className={s.messages}><p className={s.empty}>{t.app.chat.vazio}</p></div>;
  return (
    <ol className={s.messages}>
      {messages.map((m) => (
        <li key={m.id} className={s.message}>
          <b>{m.senderName ?? t.app.chat.removida}</b>
          <span className={s.when}>{dataHora(m.createdAt)}</span>
          <p className={`${s.text} ${m.deleted ? s.deleted : ""}`}>{m.deleted ? t.app.chat.apagada : m.content}</p>
        </li>
      ))}
    </ol>
  );
}
