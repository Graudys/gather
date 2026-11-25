import s from "@/_styles/ui/Brand.module.css";

/**
 * Logo animado (mesma animação do mockup "Animação do logo"):
 * o arco se desenha e a bolinha orbita até o lugar (1 s), depois o nome entra.
 * Com "reduzir movimento" no sistema, aparece parado.
 */
export function LogoAnimated({ size = 56 }: { size?: number }) {
  return (
    <span className={s.brand} style={{ fontSize: size * 0.82 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="g-anim" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="90" y2="90">
            <stop offset="0" stopColor="#5b8cff" />
            <stop offset="1" stopColor="#b08cff" />
          </linearGradient>
        </defs>
        <path className={s.arc} d="M79.5 44.8 A30 30 0 1 1 55.2 20.5" stroke="url(#g-anim)" strokeWidth="11" strokeLinecap="round" />
        <circle className={s.dot} cx="72.6" cy="27.4" r="8.5" fill="url(#g-anim)" />
      </svg>
      <span className={s.word}>gather</span>
    </span>
  );
}

/** Carregador: o arco do logo girando (24 ou 48 px). */
export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span className={s.spinnerWrap} role="status" aria-live="polite">
      <svg className={s.spinner} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path d="M79.5 44.8 A30 30 0 1 1 55.2 20.5" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
        <circle cx="72.6" cy="27.4" r="9" fill="currentColor" />
      </svg>
      {label ? <span>{label}</span> : <span className={s.sr}>Carregando</span>}
    </span>
  );
}
