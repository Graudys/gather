"use client";
import { useRef, useState } from "react";
import { sendMessage } from "@/_data/chat.actions";
import { Button } from "@/_components/ui/Button";
import { LIMITES } from "@/lib/validation";
import s from "@/_styles/chat/Chat.module.css";

type Target = { channelId?: string; conversationId?: string };

/** Caixa de mensagem. Enter envia, Shift+Enter quebra a linha. */
export function Composer({ workspaceId, target, parentId, placeholder, compact }: {
  workspaceId: string; target: Target; parentId?: string; placeholder: string; compact?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);

  const grow = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  async function action(fd: FormData) {
    if (!String(fd.get("content") ?? "").trim()) return;
    setSending(true);
    try {
      await sendMessage(fd);
      form.current?.reset();
      grow();
    } finally {
      setSending(false);
      area.current?.focus();
    }
  }

  return (
    <form ref={form} action={action} className={compact ? s.threadComposer : s.composer}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="channelId" value={target.channelId ?? ""} />
      <input type="hidden" name="conversationId" value={target.conversationId ?? ""} />
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      <div className={s.box}>
        <textarea
          ref={area}
          name="content"
          rows={1}
          required
          maxLength={LIMITES.mensagem}
          placeholder={placeholder}
          className={s.textarea}
          onInput={grow}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }}
          aria-label={placeholder}
        />
        <Button>{sending ? "Enviando…" : "Enviar"}</Button>
      </div>
      {!compact && <p className={s.hint}>Enter envia · Shift + Enter quebra a linha</p>}
    </form>
  );
}
