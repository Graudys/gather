"use client";
import { Icon } from "@/_components/ui/Icon";
import { useState } from "react";
import { Markdown } from "@/_components/help/Markdown";
import s from "@/_styles/admin/HelpAdmin.module.css";

/** Corpo do artigo: escrever / ver como fica. Os atalhos inserem markdown simples. */
export function ArticleBody({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [preview, setPreview] = useState(false);
  const wrap = (before: string, after = "") => {
    const el = document.getElementById("article-body") as HTMLTextAreaElement | null;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const next = text.slice(0, a) + before + text.slice(a, b) + after + text.slice(b);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, b + before.length);
    });
  };
  return (
    <div className={s.editor}>
      <div className={s.toolbar}>
        <button type="button" className={`${s.tab} ${!preview ? s.tabOn : ""}`} onClick={() => setPreview(false)}>Escrever</button>
        <button type="button" className={`${s.tab} ${preview ? s.tabOn : ""}`} onClick={() => setPreview(true)}>Ver como fica</button>
        {!preview && (
          <>
            <span className={s.sep} />
            <button type="button" className={s.tool} onClick={() => wrap("## ")} title="Título">T</button>
            <button type="button" className={s.tool} onClick={() => wrap("**", "**")} title="Negrito"><b>B</b></button>
            <button type="button" className={s.tool} onClick={() => wrap("- ")} title="Lista">•</button>
            <button type="button" className={s.tool} onClick={() => wrap("1. ")} title="Lista numerada">1.</button>
            <button type="button" className={s.tool} onClick={() => wrap("[", "](/app)")} title="Link"><Icon name="link" /></button>
          </>
        )}
      </div>
      <textarea id="article-body" name="body" value={text} onChange={(e) => setText(e.currentTarget.value)} className={s.body} maxLength={20000} hidden={preview} />
      {preview && <div className={s.preview}><Markdown text={text || "_Nada escrito ainda._"} /></div>}
    </div>
  );
}
