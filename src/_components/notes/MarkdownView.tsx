"use client";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { NOTE_IMAGE_RE } from "@/lib/notes";
import s from "@/_styles/app/Notes.module.css";

/**
 * Markdown das notas, só leitura. Sem HTML cru; fotos só das próprias notas
 * (ou da anotação compartilhada); links abrem em outra aba.
 */
export function MarkdownView({ content, empty = "A prévia aparece aqui." }: { content: string; empty?: string }) {
  if (!content.trim()) return <p className={s.previewEmpty}>{empty}</p>;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      urlTransform={(url, key) => (key === "src" ? (NOTE_IMAGE_RE.test(url) ? url : "") : defaultUrlTransform(url))}
      components={{
        // eslint-disable-next-line @next/next/no-img-element
        img: ({ src, alt }) => (typeof src === "string" && src ? <img src={src} alt={alt ?? ""} loading="lazy" /> : <span className={s.blocked}>{alt || "foto"}</span>),
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
