"use client";
import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "@/_components/notes/MarkdownView";
import { saveNote, uploadNoteImage } from "@/_data/notes.actions";
import { NOTE_LIMITS } from "@/lib/notes";
import { Icon, type IconName } from "@/_components/ui/Icon";
import s from "@/_styles/app/Notes.module.css";

type Status = "salvo" | "editando" | "salvando" | "erro";
type Mode = "write" | "split" | "preview";
type ToolId = "h1" | "h2" | "bold" | "italic" | "strike" | "code" | "link" | "list" | "olist" | "checklist" | "quote" | "table" | "hr";
const TOOLS: { id: ToolId; icon: IconName; label: string; key?: string }[] = [
  { id: "h1", icon: "h1", label: "Título" },
  { id: "h2", icon: "h2", label: "Subtítulo" },
  { id: "bold", icon: "bold", label: "Negrito", key: "Ctrl+B" },
  { id: "italic", icon: "italic", label: "Itálico", key: "Ctrl+I" },
  { id: "strike", icon: "strike", label: "Riscado" },
  { id: "code", icon: "code", label: "Código", key: "Ctrl+E" },
  { id: "link", icon: "link", label: "Link", key: "Ctrl+K" },
  { id: "list", icon: "list", label: "Lista" },
  { id: "olist", icon: "olist", label: "Lista numerada" },
  { id: "checklist", icon: "checklist", label: "Lista de tarefas" },
  { id: "quote", icon: "quote", label: "Citação" },
  { id: "table", icon: "table", label: "Tabela" },
  { id: "hr", icon: "hr", label: "Divisória" },
];

const UPLOAD_ERR: Record<string, string> = {
  tamanho: "Foto grande demais.",
  tipo: "Use JPG, PNG ou WebP.",
  limite: `Limite de ${NOTE_LIMITS.imagesPerNote} fotos por nota.`,
  storage: "Armazenamento de arquivos não configurado.",
  muitas: "Muitos envios seguidos. Espere um pouco.",
};

/** Reduz a foto (lado maior até 1600 px) e regrava em WebP: tira os dados da câmera e diminui o tamanho. */
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, NOTE_LIMITS.imageSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    let b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.82));
    if (!b || b.type !== "image/webp") b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return b;
  } catch {
    return null;
  }
}

/**
 * Editor da nota em Markdown: barra de formatação, atalhos (Ctrl+B, Ctrl+I, Ctrl+K),
 * listas que continuam no Enter, fotos coladas ou arrastadas, e prévia ao lado.
 * Salva sozinho 800 ms depois de parar de digitar.
 * A prévia não aceita HTML cru, e só mostra fotos das próprias notas.
 */
export function NoteEditor({ workspaceId, note }: { workspaceId: string; note: { id: string; title: string; content: string; updatedAt: string } }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [status, setStatus] = useState<Status>("salvo");
  const [at, setAt] = useState(note.updatedAt);
  const [mode, setMode] = useState<Mode>("write");
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef({ title, content });
  const dirty = useRef(false);
  const uploads = useRef(0);
  const seq = useRef(0);

  // Tela larga: começa com a prévia ao lado.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(min-width: 1200px)").matches) setMode("split");
  }, []);

  const flush = async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setStatus("salvando");
    const r = await saveNote({ workspaceId, noteId: note.id, ...latest.current }).catch(() => ({ ok: false as const }));
    if (r.ok && "updatedAt" in r && r.updatedAt) {
      setAt(r.updatedAt);
      setStatus(dirty.current ? "editando" : "salvo");
    } else {
      dirty.current = true;
      setStatus("erro");
    }
  };

  const change = (t: string, c: string) => {
    latest.current = { title: t, content: c };
    dirty.current = true;
    setStatus("editando");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 800);
  };
  const setBody = (c: string, selStart?: number, selEnd?: number) => {
    setContent(c);
    change(latest.current.title, c);
    if (selStart !== undefined) {
      requestAnimationFrame(() => {
        const el = area.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(selStart, selEnd ?? selStart);
      });
    }
  };

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush();
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current || uploads.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onLeave);
      if (timer.current) window.clearTimeout(timer.current);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // ── Formatação ──────────────────────────────────────────────
  const sel = () => {
    const el = area.current!;
    return { el, a: el.selectionStart, b: el.selectionEnd, v: el.value };
  };
  /** Envolve a seleção (ou um texto de exemplo) com marcas: **negrito**, _itálico_… */
  const wrap = (before: string, after = before, sample = "texto") => {
    const { a, b, v } = sel();
    const picked = v.slice(a, b) || sample;
    const out = v.slice(0, a) + before + picked + after + v.slice(b);
    setBody(out, a + before.length, a + before.length + picked.length);
  };
  /** Coloca (ou tira) um prefixo no começo de cada linha selecionada: "# ", "- ", "> "… */
  const prefix = (p: string | ((i: number) => string)) => {
    const { a, b, v } = sel();
    const start = v.lastIndexOf("\n", a - 1) + 1;
    const endIdx = v.indexOf("\n", b);
    const end = endIdx === -1 ? v.length : endIdx;
    const lines = v.slice(start, end).split("\n");
    const first = typeof p === "string" ? p : p(0);
    const all = lines.every((l, i) => l.startsWith(typeof p === "string" ? p : p(i)));
    const next = lines.map((l, i) => {
      const mark = typeof p === "string" ? p : p(i);
      if (all) return l.slice(mark.length);
      return mark + l.replace(/^(#{1,6} |[-*+] \[[ xX]\] |[-*+] |\d+\. |> )/, "");
    });
    const block = next.join("\n");
    setBody(v.slice(0, start) + block + v.slice(end), all ? Math.max(start, a - first.length) : a + first.length, start + block.length);
  };
  const insert = (text: string) => {
    const { a, b, v } = sel();
    const needNl = a > 0 && v[a - 1] !== "\n" ? "\n" : "";
    const out = v.slice(0, a) + needNl + text + v.slice(b);
    const pos = a + needNl.length + text.length;
    setBody(out, pos);
  };
  const link = () => {
    const { a, b, v } = sel();
    const label = v.slice(a, b) || "texto do link";
    const out = `${v.slice(0, a)}[${label}](https://)${v.slice(b)}`;
    const urlStart = a + label.length + 3;
    setBody(out, urlStart, urlStart + 8);
  };

  const runTool = (id: ToolId) => {
    switch (id) {
      case "h1": return prefix("# ");
      case "h2": return prefix("## ");
      case "bold": return wrap("**");
      case "italic": return wrap("_");
      case "strike": return wrap("~~");
      case "code": return wrap("`");
      case "link": return link();
      case "list": return prefix("- ");
      case "olist": return prefix((i) => `${i + 1}. `);
      case "checklist": return prefix("- [ ] ");
      case "quote": return prefix("> ");
      case "table": return insert("| Coluna | Coluna |\n| --- | --- |\n| | |\n");
      case "hr": return insert("\n---\n");
    }
  };

  // ── Fotos ───────────────────────────────────────────────────
  const fileInput = useRef<HTMLInputElement>(null);
  async function addImages(files: File[]) {
    const imgs = files.filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.type));
    if (!imgs.length) return;
    setNotice(null);
    for (const f of imgs) {
      const token = `![Enviando ${f.name.replace(/[[\]()]/g, "")}…](enviando-${++seq.current})`;
      insert(`${token}\n`);
      uploads.current++;
      const blob = await shrink(f);
      let replacement = "";
      if (blob) {
        const fd = new FormData();
        fd.set("workspaceId", workspaceId);
        fd.set("noteId", note.id);
        fd.set("image", blob, "foto");
        const r = await uploadNoteImage(fd).catch(() => ({ ok: false as const, error: "erro" }));
        if (r.ok) replacement = `![${f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[[\]()]/g, "")}](${r.url})`;
        else setNotice(UPLOAD_ERR[r.error] ?? "Não deu para enviar a foto.");
      } else setNotice("Não deu para ler a foto.");
      uploads.current--;
      const cur = latest.current.content;
      setBody(cur.replace(`${token}\n`, replacement ? `${replacement}\n` : "").replace(token, replacement));
    }
  }

  // ── Teclado ─────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") return e.preventDefault(), wrap("**");
      if (k === "i") return e.preventDefault(), wrap("_");
      if (k === "k") return e.preventDefault(), link();
      if (k === "e") return e.preventDefault(), wrap("`");
    }
    const { a, b, v } = sel();
    if (e.key === "Enter" && !e.shiftKey && !mod && a === b) {
      // Lista continua no Enter; Enter numa linha vazia da lista termina a lista.
      const start = v.lastIndexOf("\n", a - 1) + 1;
      const line = v.slice(start, a);
      const m = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )(.*)$/.exec(line);
      if (!m) return;
      e.preventDefault();
      if (!m[4]!.trim()) return setBody(v.slice(0, start) + v.slice(a), start);
      const mark = m[3] ? `${Number(m[3]) + 1}. ` : m[2]!.replace(/\[[xX]\]/, "[ ]");
      const ins = `\n${m[1]}${mark}`;
      return setBody(v.slice(0, a) + ins + v.slice(b), a + ins.length);
    }
    if (e.key === "Tab") {
      // Tab/Shift+Tab: entra e sai do nível da lista (não sai do campo).
      e.preventDefault();
      const start = v.lastIndexOf("\n", a - 1) + 1;
      if (e.shiftKey) {
        const cut = v.slice(start, start + 2) === "  " ? 2 : 0;
        return setBody(v.slice(0, start) + v.slice(start + cut), Math.max(start, a - cut), Math.max(start, b - cut));
      }
      return setBody(`${v.slice(0, start)}  ${v.slice(start)}`, a + 2, b + 2);
    }
  }

  const when = new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className={s.editor}>
      <input
        className={s.noteTitle}
        value={title}
        maxLength={NOTE_LIMITS.title}
        placeholder="Título"
        aria-label="Título da nota"
        onChange={(e) => {
          setTitle(e.target.value);
          change(e.target.value, content);
        }}
      />
      <p className={s.saveState} role="status" aria-live="polite">
        {status === "salvo" && `Salvo · editada em ${when}`}
        {status === "editando" && "Editando…"}
        {status === "salvando" && "Salvando…"}
        {status === "erro" && "Não deu para salvar. Vou tentar de novo quando você digitar."}
        {" · "}{words} {words === 1 ? "palavra" : "palavras"}
      </p>

      <div className={s.toolbar} role="toolbar" aria-label="Formatação">
        {mode !== "preview" && (
          <>
            {TOOLS.map((t) => (
              <button key={t.label} type="button" className={s.tb} onMouseDown={(e) => e.preventDefault()} onClick={() => runTool(t.id)} title={t.key ? `${t.label} (${t.key})` : t.label} aria-label={t.label}>
                <Icon name={t.icon} size={16} />
              </button>
            ))}
            <button type="button" className={s.tb} onClick={() => fileInput.current?.click()} title="Foto (ou cole/arraste na nota)" aria-label="Inserir foto">
              <Icon name="image" size={16} />
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { void addImages([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </>
        )}
        <span style={{ flex: 1 }} />
        <div className={s.modes} role="radiogroup" aria-label="Modo">
          {([["write", "write", "Escrever"], ["split", "split", "Lado a lado"], ["preview", "eye", "Ver"]] as const).map(([m, ic, label]) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={`${s.modeBtn} ${mode === m ? s.modeOn : ""} ${m === "split" ? s.splitOnly : ""}`} onClick={() => setMode(m)} title={label}>
              <Icon name={ic} size={15} /> <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      {notice && <p className={s.notice} role="alert">{notice}</p>}

      <div className={`${s.panes} ${mode === "split" ? s.panesSplit : ""}`}>
        {mode !== "preview" && (
          <div
            className={`${s.writeWrap} ${dragging ? s.dropping : ""}`}
            onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault();
              setDragging(false);
              void addImages([...e.dataTransfer.files]);
            }}
          >
            <textarea
              ref={area}
              className={s.noteBody}
              value={content}
              maxLength={NOTE_LIMITS.content}
              placeholder={"Escreva aqui.\n\n# Título  ·  **negrito**  ·  - lista  ·  - [ ] tarefa\nCole ou arraste fotos direto na nota."}
              aria-label="Texto da nota (Markdown)"
              spellCheck
              onKeyDown={onKeyDown}
              onPaste={(e) => {
                const files = [...e.clipboardData.files];
                if (files.some((f) => f.type.startsWith("image/"))) {
                  e.preventDefault();
                  void addImages(files);
                }
              }}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        )}
        {mode !== "write" && (
          <article className={s.preview} aria-label="Prévia">
            <MarkdownView content={content} />
          </article>
        )}
      </div>
    </div>
  );
}
