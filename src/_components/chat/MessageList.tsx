import Link from "next/link";
import type { ChatMessage } from "@/types/domain";
import { MessageItem } from "@/_components/chat/MessageItem";
import s from "@/_styles/chat/Chat.module.css";

const TZ = "America/Sao_Paulo";
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ });

function dayLabel(iso: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  const k = dayKey(iso);
  if (k === today) return "Hoje";
  if (k === yesterday) return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

/** Lista de mensagens com separador de dia e agrupamento por pessoa. */
export function MessageList({ messages, workspaceId, threadBase, header, inThread }: {
  messages: ChatMessage[];
  workspaceId: string;
  threadBase?: string; // ex.: /app/w/1/c/2?thread= (ausente dentro da thread)
  header?: React.ReactNode;
  inThread?: boolean; // sem separador de dia e sem margem extra
}) {
  // Calcula antes de renderizar: separador de dia e se a mensagem "cola" na anterior.
  const rows = messages.map((m, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const day = dayKey(m.createdAt);
    const newDay = !prev || dayKey(prev.createdAt) !== day;
    const compact =
      !newDay && !!prev && !prev.deleted && !m.deleted && prev.sender?.id === m.sender?.id &&
      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
    return { m, label: newDay && !inThread ? dayLabel(m.createdAt) : null, compact };
  });
  return (
    <ol className={inThread ? s.listThread : s.list}>
      {header}
      {rows.map(({ m, label, compact }) => (
        <FragmentWithDay key={m.id} label={label}>
          <MessageItem m={m} workspaceId={workspaceId} time={hhmm(m.createdAt)} compact={compact} threadHref={threadBase ? `${threadBase}${m.id}` : undefined} />
        </FragmentWithDay>
      ))}
    </ol>
  );
}

function FragmentWithDay({ label, children }: { label: string | null; children: React.ReactNode }) {
  return (
    <>
      {label && <li className={s.day} role="separator">{label}</li>}
      {children}
    </>
  );
}

export function LoadMore({ href }: { href: string }) {
  return <Link href={href} className={s.more} scroll={false}>Carregar mensagens anteriores</Link>;
}
