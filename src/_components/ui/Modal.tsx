import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/_components/ui/Icon";
import { EscapeTo } from "@/_components/ui/EscapeTo";
import s from "@/_styles/ui/Modal.module.css";

/**
 * Janela por cima da página (mockup "Ov_*"). Abre por um parâmetro na URL
 * (?nova=1), então funciona sem JavaScript e o "voltar" do navegador fecha.
 * Fecha no X, clicando fora ou com Esc.
 */
export function Modal({ title, sub, closeHref, width = 560, icon, children }: { title: string; sub?: ReactNode; closeHref: string; width?: number; icon?: IconName; children: ReactNode }) {
  return (
    <div className={s.ov}>
      <EscapeTo href={closeHref} />
      <Link className={s.scrim} href={closeHref} scroll={false} aria-label="Fechar" tabIndex={-1} />
      <div className={s.dlg} role="dialog" aria-modal="true" aria-labelledby="dlg-title" style={{ width }}>
        <div className={s.dh}>
          {icon && <span className={s.badge}><Icon name={icon} size={18} /></span>}
          <div className={s.grow}>
            <h2 id="dlg-title">{title}</h2>
            {sub && <p className={s.sub}>{sub}</p>}
          </div>
          <Link className={s.ic} href={closeHref} scroll={false} aria-label="Fechar"><Icon name="x" size={18} /></Link>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Painel lateral por cima da página (mockup "Ov_TarefaPainel"). */
export function Drawer({ closeHref, width = 540, label, children }: { closeHref: string; width?: number; label: string; children: ReactNode }) {
  return (
    <div className={s.ov}>
      <EscapeTo href={closeHref} />
      <Link className={s.scrim} href={closeHref} scroll={false} aria-label="Fechar" tabIndex={-1} />
      <aside className={s.drw} role="dialog" aria-modal="true" aria-label={label} style={{ width }}>{children}</aside>
    </div>
  );
}
