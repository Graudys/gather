import { colorFor } from "@/_components/chat/Avatar";
import s from "@/_styles/shell/Shell.module.css";

/**
 * Ícone do workspace: foto (se tiver) > emoji > primeira letra.
 * Com foto: sem fundo e sem arredondar (a foto já vem com o formato dela)
 * e 5 px maior, para aparecer melhor.
 */
export function WsBadge({ w, size = 20 }: { w: { id: string; name: string; icon: string | null; photoV: string }; size?: number }) {
  if (w.photoV) {
    const big = size + 5;
    return (
      <span className={s.sq} style={{ width: big, height: big, background: "none", borderRadius: 0, margin: "-2.5px" }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/avatar/w/${w.id}?v=${w.photoV}`} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </span>
    );
  }
  return (
    <span className={s.sq} style={{ background: w.icon ? "var(--surface-2)" : colorFor(w.id), width: size, height: size, borderRadius: Math.round(size * 0.3), fontSize: w.icon ? Math.round(size * 0.62) : Math.round(size * 0.48) }} aria-hidden="true">
      {w.icon ?? w.name[0]?.toUpperCase()}
    </span>
  );
}
