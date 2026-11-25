"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Esc fecha a janela aberta (volta para `href`). */
export function EscapeTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector("details[open]")) return; // primeiro fecha menus abertos
      router.replace(href, { scroll: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
