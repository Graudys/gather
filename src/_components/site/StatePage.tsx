import type { ReactNode } from "react";
import { Orbi, type OrbiMood } from "@/_components/help/Orbi";
import s from "@/_styles/site/Site.module.css";

/**
 * Tela de estado (mockup "Erro404"): símbolo, código grande, título, texto e ações.
 * `mood` troca o símbolo pelo Orbi (erro inesperado, manutenção).
 */
export function StatePage({ code, title, text, mood, inShell, children }: { code?: string; title: string; text: string; mood?: OrbiMood; inShell?: boolean; children?: ReactNode }) {
  const Tag = inShell ? "div" : "main";
  return (
    <Tag className={`${s.state} ${inShell ? s.stateInShell : ""}`}>
      {mood ? (
        <Orbi mood={mood} size={84} />
      ) : (
        <svg width="48" height="48" viewBox="0 0 100 100" aria-hidden="true" className={s.stateLogo}>
          <defs>
            <linearGradient id="st-logo" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="90" y2="90">
              <stop offset="0" stopColor="#5b8cff" />
              <stop offset="1" stopColor="#b08cff" />
            </linearGradient>
          </defs>
          <path d="M79.5 44.8 A30 30 0 1 1 55.2 20.5" fill="none" stroke="url(#st-logo)" strokeWidth="11" strokeLinecap="round" />
          <circle cx="72.6" cy="27.4" r="8.5" fill="url(#st-logo)" />
        </svg>
      )}
      {code && <div className={s.stateCode}>{code}</div>}
      <h1 className={s.stateTitle}>{title}</h1>
      <p className={s.stateText}>{text}</p>
      {children && <div className={s.stateActions}>{children}</div>}
    </Tag>
  );
}
