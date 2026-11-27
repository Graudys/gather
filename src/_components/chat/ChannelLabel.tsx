import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/chat/Chat.module.css";

// Peças só de exibição (sem "use client"): servem em páginas do servidor e do navegador.

/** Emoji solto (grupos). */
export function ChatGlyph({ icon, size = 16 }: { icon: string | null; size?: number }) {
  if (!icon) return null;
  return <span className={s.glyph} style={{ fontSize: size }} aria-hidden="true">{icon}</span>;
}

/**
 * Sinal de canal: # (público) ou cadeado (privado), sempre visível, com uma
 * marquinha verde (público) ou vermelha (privado). O texto diz o mesmo para leitores de tela.
 */
export function ChannelMark({ isPrivate, size = 16 }: { isPrivate?: boolean; size?: number }) {
  return (
    <span className={s.chMark} title={isPrivate ? "Canal privado" : "Canal público"} role="img" aria-label={isPrivate ? "Canal privado" : "Canal público"}>
      <Icon name={isPrivate ? "lock" : "hash"} size={size} />
      <i className={`${s.chDot} ${isPrivate ? s.chPriv : s.chPub}`} aria-hidden="true" />
    </span>
  );
}

/** Nome do canal como na lista: "# 🌐 · chat" (emoji e ponto só se tiver ícone). */
export function ChannelName({ icon, name }: { icon: string | null; name: string }) {
  return (
    <>
      {icon && <span className={s.chEmoji} aria-hidden="true">{icon}<span className={s.chSep}>{"\u00a0·\u00a0"}</span></span>}
      <span>{name}</span>
    </>
  );
}

