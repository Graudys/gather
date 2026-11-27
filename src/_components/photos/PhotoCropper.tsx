"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/_components/ui/Button";
import { Icon } from "@/_components/ui/Icon";
import { PHOTO_SIZE } from "@/lib/images";
import s from "@/_styles/ui/Photo.module.css";

type Result = { ok: true } | { ok: false; error: string };
const V = 280; // tamanho da área de recorte na tela
const ERR: Record<string, string> = {
  tamanho: "A foto ficou grande demais. Tente outra imagem.",
  tipo: "Use uma foto JPG, PNG ou WebP.",
  storage: "O armazenamento de arquivos não está configurado.",
  muitas: "Muitas trocas seguidas. Espere um pouco.",
  dados: "Não deu para ler a foto.",
};

/**
 * Escolher foto e recortar (perfil ou workspace). Arrasta para enquadrar,
 * zoom no controle; sai um quadrado 256×256 em WebP (ou JPEG), sem os
 * dados extras da foto original (local, câmera).
 */
export function PhotoCropper({ label, round, save, extra, remove }: {
  label: string; round?: boolean; save: (fd: FormData) => Promise<Result>; extra?: Record<string, string>;
  remove?: () => Promise<Result>; // mostra "Remover foto" quando já tem uma
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const base = img ? Math.max(V / img.naturalWidth, V / img.naturalHeight) : 1;
  const scale = base * zoom;
  const dw = img ? img.naturalWidth * scale : V;
  const dh = img ? img.naturalHeight * scale : V;
  const clamp = (x: number, y: number, w = dw, h = dh) => ({ x: Math.min(0, Math.max(V - w, x)), y: Math.min(0, Math.max(V - h, y)) });

  function pick(f: File | undefined) {
    setMsg(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setMsg(ERR.tipo!);
    if (f.size > 15 * 1024 * 1024) return setMsg("Foto acima de 15 MB.");
    const url = URL.createObjectURL(f);
    const el = new Image();
    el.onload = () => {
      const b = Math.max(V / el.naturalWidth, V / el.naturalHeight);
      setImg(el);
      setZoom(1);
      setPos({ x: (V - el.naturalWidth * b) / 2, y: (V - el.naturalHeight * b) / 2 });
    };
    el.onerror = () => setMsg(ERR.dados!);
    el.src = url;
    setSrc(url);
  }

  function changeZoom(z: number) {
    if (!img) return;
    // Mantém o centro da área no mesmo ponto da foto.
    const cx = (V / 2 - pos.x) / scale, cy = (V / 2 - pos.y) / scale;
    const ns = base * z;
    setZoom(z);
    setPos(clamp(V / 2 - cx * ns, V / 2 - cy * ns, img.naturalWidth * ns, img.naturalHeight * ns));
  }

  async function confirm() {
    if (!img) return;
    setBusy(true);
    setMsg(null);
    try {
      const c = document.createElement("canvas");
      c.width = c.height = PHOTO_SIZE;
      const g = c.getContext("2d")!;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, -pos.x / scale, -pos.y / scale, V / scale, V / scale, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      let blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.86));
      if (!blob || blob.type !== "image/webp") blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.88));
      if (!blob) throw new Error("canvas");
      const fd = new FormData();
      fd.set("photo", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");
      for (const [k, v] of Object.entries(extra ?? {})) fd.set(k, v);
      const r = await save(fd);
      if (!r.ok) return setMsg(ERR[r.error] ?? "Não deu para salvar a foto.");
      setSrc(null);
      setImg(null);
      router.refresh();
    } catch {
      setMsg("Não deu para preparar a foto neste navegador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      <span className={s.btns}>
        <Button type="button" variant="ghost" onClick={() => input.current?.click()}><Icon name="image" size={14} /> {label}</Button>
        {remove && (
          <Button type="button" variant="link" disabled={busy} onClick={async () => { setBusy(true); await remove(); setBusy(false); router.refresh(); }}>Remover foto</Button>
        )}
      </span>
      {msg && !img && <p className={s.err} role="alert">{msg}</p>}
      {img && src && createPortal(
        <div className={s.ov} role="dialog" aria-modal="true" aria-label="Recortar foto">
          <div className={s.dlg}>
            <h2>Ajustar foto</h2>
            <p className={s.sub}>Arraste para enquadrar e use o controle para aproximar.</p>
            <div
              className={`${s.stage} ${round ? s.round : ""}`}
              style={{ width: V, height: V }}
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; }}
              onPointerMove={(e) => { const d = drag.current; if (d) setPos(clamp(d.px + e.clientX - d.x, d.py + e.clientY - d.y)); }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" draggable={false} style={{ width: dw, height: dh, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
            </div>
            <label className={s.zoom}>
              <Icon name="search" size={14} />
              <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} aria-label="Zoom" />
            </label>
            {msg && <p className={s.err} role="alert">{msg}</p>}
            <div className={s.actions}>
              <Button type="button" variant="ghost" onClick={() => { setImg(null); setSrc(null); }}>Cancelar</Button>
              <Button type="button" disabled={busy} onClick={confirm}>{busy ? "Salvando…" : "Usar esta foto"}</Button>
            </div>
          </div>
        </div>,
        // Fora do card: assim a janela fica por cima da tela toda (o card cortava).
        document.body,
      )}
    </>
  );
}
