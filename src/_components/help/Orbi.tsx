import { useId } from "react";

export type OrbiMood = "feliz" | "pensando" | "procurando" | "comemorando";

const D = "#141433";

/** Orbi, a mascote do Gather: a bolinha do símbolo virando personagem (mesmo desenho do mockup). */
export function Orbi({ mood = "feliz", size = 40, title }: { mood?: OrbiMood; size?: number; title?: string }) {
  const g = `orbi-${useId().replace(/:/g, "")}`;
  const eyes = (dx = 0, dy = 0) => (
    <>
      <ellipse cx="49" cy="60" rx="6.5" ry="7.5" fill="#fff" />
      <ellipse cx="71" cy="60" rx="6.5" ry="7.5" fill="#fff" />
      <circle cx={49 + dx} cy={61 + dy} r="3.6" fill={D} />
      <circle cx={71 + dx} cy={61 + dy} r="3.6" fill={D} />
      <circle cx={50.2 + dx} cy={59.6 + dy} r="1.1" fill="#fff" />
      <circle cx={72.2 + dx} cy={59.6 + dy} r="1.1" fill="#fff" />
    </>
  );
  const star = (x: number, y: number, s: number) => (
    <path key={`${x}-${y}`} d={`M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.3}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.3}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.3}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.3}Z`} fill="#ffd38a" />
  );

  let face: React.ReactNode;
  let extra: React.ReactNode = null;
  if (mood === "pensando") {
    face = <>{eyes(2, -3)}<path d="M55 75 L65 74" fill="none" stroke={D} strokeWidth="2.6" strokeLinecap="round" /></>;
    extra = <><circle cx="95" cy="30" r="3" fill="#b08cff" opacity=".8" /><circle cx="103" cy="21" r="4" fill="#b08cff" opacity=".8" /><circle cx="112" cy="11" r="5" fill="#b08cff" opacity=".8" /></>;
  } else if (mood === "procurando") {
    face = <>{eyes(-3, 0)}<circle cx="60" cy="75" r="3.2" fill={D} /></>;
    extra = <><circle cx="22" cy="80" r="9" fill="none" stroke="#eef0f7" strokeWidth="3" /><path d="M15 87 L8 94" stroke="#eef0f7" strokeWidth="4" strokeLinecap="round" /></>;
  } else if (mood === "comemorando") {
    face = <><path d="M43 60 Q49 55 55 60" fill="none" stroke={D} strokeWidth="2.6" strokeLinecap="round" /><path d="M65 60 Q71 55 77 60" fill="none" stroke={D} strokeWidth="2.6" strokeLinecap="round" /><path d="M51 71 Q60 84 69 71 Z" fill={D} /><path d="M55 76 Q60 80 65 76" fill="#ff8fb3" /></>;
    extra = <>{star(20, 30, 7)}{star(102, 26, 9)}{star(108, 92, 6)}</>;
  } else {
    face = <>{eyes()}<path d="M53 73 Q60 79 67 73" fill="none" stroke={D} strokeWidth="2.6" strokeLinecap="round" /></>;
    extra = <><circle cx="99" cy="50" r="7" fill={`url(#${g})`} /><path d="M106 38 Q111 42 110 48" fill="none" stroke="#b08cff" strokeWidth="2" strokeLinecap="round" opacity=".7" /></>;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={title ?? `Orbi, ${mood}`} style={{ flex: "none", overflow: "visible" }}>
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="20" y1="20" x2="100" y2="104">
          <stop offset="0" stopColor="#5b8cff" />
          <stop offset="1" stopColor="#b08cff" />
        </linearGradient>
      </defs>
      <path d="M104 74 A46 46 0 1 1 82 22" fill="none" stroke={`url(#${g})`} strokeWidth="7" strokeLinecap="round" opacity=".45" />
      <circle cx="60" cy="62" r="34" fill={`url(#${g})`} />
      <ellipse cx="47" cy="45" rx="11" ry="6.5" fill="#fff" opacity=".28" transform="rotate(-25 47 45)" />
      <circle cx="40" cy="73" r="5" fill="#ff8fb3" opacity=".35" />
      <circle cx="80" cy="73" r="5" fill="#ff8fb3" opacity=".35" />
      {face}
      {extra}
    </svg>
  );
}
