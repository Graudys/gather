"use client";
import { useEffect } from "react";

/** Fecha qualquer <details> aberto (menus e seletores) ao clicar fora dele ou apertar Esc. */
export function CloseDetailsOnOutside() {
  useEffect(() => {
    const close = (keep?: EventTarget | null) => {
      document.querySelectorAll("details[open]").forEach((d) => {
        if (!(keep instanceof Node) || !d.contains(keep)) d.removeAttribute("open");
      });
    };
    const onDown = (e: PointerEvent) => close(e.target);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
