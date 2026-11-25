"use client";
import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "@/_components/ui/Icon";
import s from "@/_styles/ui/Modal.module.css";

/** Mesma janela do <Modal>, controlada por estado (para formulários com useActionState). */
export function ClientModal({ title, sub, icon, width = 520, onClose, children }: { title: string; sub?: ReactNode; icon?: IconName; width?: number; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={s.ov}>
      <button className={s.scrim} onClick={onClose} aria-label="Fechar" tabIndex={-1} style={{ border: 0 }} />
      <div className={s.dlg} role="dialog" aria-modal="true" aria-labelledby="cdlg-title" style={{ width }}>
        <div className={s.dh}>
          {icon && <span className={s.badge}><Icon name={icon} size={18} /></span>}
          <div className={s.grow}>
            <h2 id="cdlg-title">{title}</h2>
            {sub && <p className={s.sub}>{sub}</p>}
          </div>
          <button type="button" className={s.ic} onClick={onClose} aria-label="Fechar"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
