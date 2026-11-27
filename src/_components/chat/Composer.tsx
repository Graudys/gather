"use client";
import { useRef, useState } from "react";
import { sendMessage } from "@/_data/chat.actions";
import { Button } from "@/_components/ui/Button";
import { Icon } from "@/_components/ui/Icon";
import { AttachDialog } from "@/_components/files/AttachDialog";
import { LIMITES } from "@/lib/validation";
import { normalizeHandle } from "@/lib/mentions";
import s from "@/_styles/chat/Chat.module.css";
import f from "@/_styles/files/Files.module.css";

type Target = { channelId?: string; conversationId?: string };
type Person = { id: string; name: string; handle: string };

const hoursText = (h: number) => (h === 24 ? "24 horas" : h === 168 ? "7 dias" : h % 24 === 0 ? `${h / 24} dias` : `${h} horas`);

/** Caixa de mensagem. Enter envia, Shift+Enter quebra a linha. Clipe, arrastar ou colar anexa arquivos. */
export function Composer({ workspaceId, target, parentId, placeholder, compact, fileHours = 24, where, people = [] }: {
  workspaceId: string; target: Target; parentId?: string; placeholder: string; compact?: boolean; fileHours?: number; where?: string; people?: Person[];
}) {
  // @menções: lista de pessoas enquanto digita "@nome"
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [pick, setPick] = useState(0);
  const matches = mention
    ? people.filter((p) => p.handle.includes(mention.q) || normalizeHandle(p.name).includes(mention.q)).slice(0, 6)
    : [];
  const scanMention = () => {
    const el = area.current;
    if (!el || !people.length) return setMention(null);
    const caret = el.selectionStart ?? 0;
    const m = /(^|[\s(])@([a-z0-9._-]{0,30})$/i.exec(el.value.slice(0, caret));
    if (!m) return setMention(null);
    setMention({ q: normalizeHandle(m[2]!) || "", start: caret - m[2]!.length - 1 });
    setPick(0);
  };
  const insertMention = (p: Person) => {
    const el = area.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? el.value.length;
    const text = `${el.value.slice(0, mention.start)}@${p.handle} ${el.value.slice(caret)}`;
    el.value = text;
    const pos = mention.start + p.handle.length + 2;
    el.setSelectionRange(pos, pos);
    el.focus();
    setMention(null);
    grow();
  };
  const form = useRef<HTMLFormElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  const [attach, setAttach] = useState<{ files: File[]; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dest = target.channelId ? `c:${target.channelId}` : `dm:${target.conversationId}`;

  const grow = () => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const base = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("channelId", target.channelId ?? "");
    fd.set("conversationId", target.conversationId ?? "");
    fd.set("parentId", parentId ?? "");
    return fd;
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

  const openAttach = (files: File[] = []) => setAttach({ files, text: area.current?.value ?? "" });

  return (
    <form
      ref={form}
      action={action}
      className={compact ? s.threadComposer : s.composer}
      onDragEnter={(e) => e.dataTransfer.types.includes("Files") && setDragging(true)}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        openAttach([...e.dataTransfer.files]);
      }}
      style={{ position: "relative" }}
    >
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
          onInput={() => {
            grow();
            scanMention();
          }}
          onClick={scanMention}
          onBlur={() => window.setTimeout(() => setMention(null), 120)}
          onPaste={(e) => {
            const files = [...e.clipboardData.files];
            if (files.length) {
              e.preventDefault();
              openAttach(files);
            }
          }}
          onKeyDown={(e) => {
            if (mention && matches.length) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setPick((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(matches[pick] ?? matches[0]!);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMention(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }}
          aria-label={placeholder}
          aria-autocomplete="list"
        />
        {mention && matches.length > 0 && (
          <ul className={s.mentionList} role="listbox" aria-label="Mencionar alguém">
            {matches.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === pick}>
                <button type="button" className={i === pick ? s.mentionOn : ""} onMouseDown={(e) => { e.preventDefault(); insertMention(p); }}>
                  <b>{p.name}</b> <span>@{p.handle}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={s.attachBtn} onClick={() => openAttach()} aria-label="Anexar arquivo" title="Anexar arquivo ou foto"><Icon name="clip" size={18} /></button>
        <Button>{sending ? "Enviando…" : <><Icon name="right" size={14} /> Enviar</>}</Button>
      </div>
      {!compact && <p className={s.hint}>Enter envia · Shift + Enter quebra a linha · @ menciona alguém · arraste ou cole arquivos</p>}
      {dragging && <div className={f.dragHint}><Icon name="clip" size={18} /> Solte para anexar</div>}
      {attach && (
        <AttachDialog
          workspaceId={workspaceId}
          dest={dest}
          where={where}
          initial={attach.files}
          initialText={attach.text}
          note={`Arquivos do chat ficam ${hoursText(fileHours)}. Para guardar, anexe a uma tarefa.`}
          onClose={() => setAttach(null)}
          onSend={async (tickets, text) => {
            const fd = base();
            fd.set("content", text.trim());
            tickets.forEach((t) => fd.append("files", t));
            await sendMessage(fd);
            form.current?.reset();
            grow();
          }}
        />
      )}
    </form>
  );
}
