"use client";
import { useRef, useState } from "react";
import { normalizeHandle } from "@/lib/mentions";
import s from "@/_styles/chat/Chat.module.css";

export type MentionPerson = { id: string; name: string; handle: string };

/**
 * Campo curto (textarea de 2 linhas) com a lista de pessoas ao digitar "@".
 * Textarea em vez de input: o Chrome não mostra o histórico de digitação por cima da lista.
 * Setas escolhem, Enter ou Tab inserem, Esc fecha. Mesmo comportamento do campo do chat.
 */
export function MentionInput({ name, people, placeholder, maxLength }: { name: string; people: MentionPerson[]; placeholder?: string; maxLength?: number }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null);
  const [pick, setPick] = useState(0);
  const matches = mention
    ? people.filter((p) => p.handle.includes(mention.q) || normalizeHandle(p.name).includes(mention.q)).slice(0, 6)
    : [];

  const scan = () => {
    const el = input.current;
    if (!el || !people.length) return setMention(null);
    const caret = el.selectionStart ?? 0;
    const m = /(^|[\s(])@([a-z0-9._-]{0,30})$/i.exec(el.value.slice(0, caret));
    if (!m) return setMention(null);
    setMention({ q: normalizeHandle(m[2]!) || "", start: caret - m[2]!.length - 1 });
    setPick(0);
  };
  const insert = (p: MentionPerson) => {
    const el = input.current;
    if (!el || !mention) return;
    const caret = el.selectionStart ?? el.value.length;
    el.value = `${el.value.slice(0, mention.start)}@${p.handle} ${el.value.slice(caret)}`;
    const pos = mention.start + p.handle.length + 2;
    el.setSelectionRange(pos, pos);
    el.focus();
    setMention(null);
  };

  return (
    <span className={s.mentionWrap}>
      <textarea
        ref={input}
        name={name}
        rows={2}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        aria-autocomplete="list"
        onInput={scan}
        onClick={scan}
        onBlur={() => window.setTimeout(() => setMention(null), 120)}
        onKeyDown={(e) => {
          // Sem lista aberta, Enter envia o formulário (Shift + Enter quebra a linha)
          if (!mention || !matches.length) {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setPick((i) => (i + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insert(matches[pick] ?? matches[0]!);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setMention(null);
          }
        }}
      />
      {mention && matches.length > 0 && (
        <ul className={`${s.mentionList} ${s.mentionDown}`} role="listbox" aria-label="Mencionar alguém">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === pick}>
              <button type="button" className={i === pick ? s.mentionOn : ""} onMouseDown={(e) => { e.preventDefault(); insert(p); }}>
                <b>{p.name}</b> <span>@{p.handle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
