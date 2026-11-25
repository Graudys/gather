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

export function Avatar({ id, name, small }: { id: string; name: string; small?: boolean }) {
  return (
    <span className={`${s.avatar} ${small ? s.avatarSm : ""}`} style={{ background: colorFor(id) }} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
