import { photoVersion } from "@/lib/images";
export { photoVersion };
import s from "@/_styles/chat/Chat.module.css";

const COLORS = ["#2f6fe0", "#14866d", "#c2414e", "#8a4fd8", "#b7791f", "#2b8a9e", "#c0428a", "#4b6b2f"];

export function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

/** Cor estável por pessoa (mesma cor em qualquer tela). */
export function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}


/**
 * Bolinha com as iniciais; por cima, a foto (se a pessoa tiver).
 * Sem foto, a rota devolve um pixel transparente e as iniciais aparecem.
 */
export function Avatar({ id, name, small, v, size }: { id: string; name: string; small?: boolean; v?: string; size?: number }) {
  return (
    <span
      className={`${s.avatar} ${small ? s.avatarSm : ""}`}
      style={{ background: colorFor(id), ...(size ? { width: size, height: size, fontSize: Math.round(size / 2.6) } : {}) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={s.avatarImg} src={`/api/avatar/u/${id}${v ? `?v=${v}` : ""}`} alt="" loading="lazy" decoding="async" />
    </span>
  );
}
