import { Fragment, type ReactNode } from "react";
import s from "@/_styles/help/Help.module.css";

/**
 * Markdown simples e seguro para os artigos. Nunca gera HTML cru:
 * tudo vira elemento do React. Suporta # títulos, listas (- e 1.),
 * **negrito**, `código` e [links](/caminho ou https://).
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${keyBase}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className={s.code}>{t.slice(1, -1)}</code>);
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!;
      const safe = (href!.startsWith("/") && !href!.startsWith("//")) || href!.startsWith("https://");
      out.push(safe ? <a key={k} href={href} className={s.link} {...(href!.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{label}</a> : label);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  let n = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const key = `b${n++}`;
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const content = inline(h[2]!, key);
      blocks.push(level === 1 ? <h2 key={key} className={s.h1}>{content}</h2> : level === 2 ? <h3 key={key} className={s.h2}>{content}</h3> : <h4 key={key} className={s.h3}>{content}</h4>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i]!)) {
        items.push(<li key={`${key}-${items.length}`}>{inline(lines[i]!.replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ""), `${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key} className={s.list}>{items}</ol> : <ul key={key} className={s.list}>{items}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push(<p key={key} className={s.p}>{para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${key}-${j}`)}</Fragment>)}</p>);
  }
  return <div className={s.md}>{blocks}</div>;
}
