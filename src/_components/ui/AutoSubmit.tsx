"use client";
import { useEffect, useRef } from "react";

/**
 * Filtros sem botão: o formulário em volta envia sozinho quando um <select>
 * muda, e o campo de texto envia depois de uma pausa na digitação.
 */
export function AutoSubmit({ delay = 400 }: { delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const send = () => form.requestSubmit();
    const onChange = (e: Event) => {
      if ((e.target as HTMLElement).tagName === "SELECT") send();
    };
    const onInput = (e: Event) => {
      if ((e.target as HTMLElement).tagName !== "INPUT") return;
      clearTimeout(t);
      t = setTimeout(send, delay);
    };
    form.addEventListener("change", onChange);
    form.addEventListener("input", onInput);
    return () => {
      clearTimeout(t);
      form.removeEventListener("change", onChange);
      form.removeEventListener("input", onInput);
    };
  }, [delay]);
  return <span ref={ref} hidden />;
}
