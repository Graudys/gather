"use client";
import { useEffect, useRef, useState } from "react";
import { ClientModal } from "@/_components/ui/ClientModal";
import { Icon } from "@/_components/ui/Icon";
import { uploadFile } from "@/_components/files/upload";
import { fileProblem, formatBytes, isImage, MAX_FILES_PER_MESSAGE } from "@/lib/files";
import m from "@/_styles/ui/Modal.module.css";
import s from "@/_styles/files/Files.module.css";

type Item = { key: string; file: File; progress: number; ticket?: string; error?: string; preview?: string };

/**
 * Janela "Anexar arquivos" (mockup "Ov_Anexo"): arrastar ou escolher, barra de
 * progresso por arquivo, mensagem opcional e o aviso do prazo.
 */
export function AttachDialog({ workspaceId, dest, where, note, initial, initialText, onClose, onSend, sendLabel = "Enviar" }: {
  workspaceId: string;
  dest: string;
  where?: string;
  note?: string;
  initial: File[];
  initialText?: string;
  onClose: () => void;
  onSend: (tickets: string[], text: string) => Promise<void>;
  sendLabel?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState(initialText ?? "");
  const [over, setOver] = useState(false);
  const [sending, setSending] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const added = useRef(false);

  const add = (files: File[]) => {
    const fresh: Item[] = files.slice(0, MAX_FILES_PER_MESSAGE).map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      file,
      progress: 0,
      error: fileProblem(file.name, file.size) ?? undefined,
      preview: isImage(file.type) ? URL.createObjectURL(file) : undefined,
    }));
    setItems((cur) => [...cur, ...fresh].slice(0, MAX_FILES_PER_MESSAGE));
    for (const it of fresh) {
      if (it.error) continue;
      uploadFile(workspaceId, dest, it.file, (p) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, progress: p } : x))))
        .then(({ ticket }) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, ticket, progress: 1 } : x))))
        .catch((e: Error) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, error: e.message } : x))));
    }
  };

  useEffect(() => {
    if (added.current || !initial.length) return;
    added.current = true;
    const t = setTimeout(() => add(initial), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), [items]);

  const ready = items.filter((i) => i.ticket);
  const busy = items.some((i) => !i.ticket && !i.error);

  return (
    <ClientModal title="Anexar arquivos" sub={where} onClose={onClose} width={560}>
      <div
        className={`${s.drop} ${over ? s.dropOver : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]); }}
        onClick={() => pick.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pick.current?.click()}
      >
        <Icon name="clip" size={22} />
        <div>Arraste arquivos aqui ou <b className={s.pickLink}>escolha no {typeof navigator !== "undefined" && /Mobi/i.test(navigator.userAgent) ? "celular" : "computador"}</b></div>
        <small>Até 50 MB por arquivo · até {MAX_FILES_PER_MESSAGE} por vez</small>
        <input ref={pick} type="file" multiple hidden onChange={(e) => { add([...(e.currentTarget.files ?? [])]); e.currentTarget.value = ""; }} />
      </div>

      {items.length > 0 && (
        <div className={s.queue}>
          {items.map((it) => (
            <div key={it.key} className={s.qRow}>
              {it.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:)
                <img src={it.preview} alt="" className={s.qThumb} />
              ) : <span className={s.badge}><Icon name="clip" size={15} /></span>}
              <div className={s.qMain}>
                <div className={s.qTop}><span className={s.qName}>{it.file.name}</span><small>{formatBytes(it.file.size)}</small></div>
                {it.error ? <small className={s.qErr}>{it.error}</small> : <div className={s.prog}><i style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>}
              </div>
              {it.ticket ? <span className={s.ok}><Icon name="check" size={16} /></span> : !it.error ? <small className={s.pct}>{Math.round(it.progress * 100)}%</small> : null}
              <button type="button" className={m.ic} onClick={() => setItems((cur) => cur.filter((x) => x.key !== it.key))} aria-label={`Remover ${it.file.name}`}><Icon name="x" size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <label className={m.f} style={{ marginTop: 14 }}>
        Mensagem (opcional)
        <input className={m.in} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={4000} placeholder="Escreva algo sobre os arquivos" />
      </label>
      {note && <div className={m.note}><Icon name="info" size={15} /><span>{note}</span></div>}
      <div className={m.df}>
        <button type="button" className={m.btn2} onClick={onClose}>Cancelar</button>
        <button
          type="button"
          className={m.btn}
          disabled={!ready.length || busy || sending}
          style={!ready.length || busy || sending ? { opacity: .5, cursor: "default" } : undefined}
          onClick={async () => {
            setSending(true);
            try {
              await onSend(ready.map((r) => r.ticket!), text);
              onClose();
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? "Enviando…" : busy ? "Enviando arquivos…" : `${sendLabel} ${ready.length} ${ready.length === 1 ? "arquivo" : "arquivos"}`}
        </button>
      </div>
    </ClientModal>
  );
}
