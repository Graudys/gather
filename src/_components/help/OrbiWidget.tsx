"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { OrbiChat } from "@/_components/help/OrbiChat";
import { Orbi } from "@/_components/help/Orbi";
import { Icon } from "@/_components/ui/Icon";
import s from "@/_styles/help/Orbi.module.css";

/** Abre o Orbi de qualquer lugar: window.dispatchEvent(new CustomEvent("orbi:open", { detail: "pergunta" })). */
export function openOrbi(question?: string) {
  window.dispatchEvent(new CustomEvent("orbi:open", { detail: question }));
}

/** Botão flutuante do Orbi em todo o app (some na sala de reunião). */
export function OrbiWidget({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<string | undefined>();
  const [key, setKey] = useState(0);
  const path = usePathname();
  useEffect(() => {
    const onOpen = (e: Event) => {
      setInitial((e as CustomEvent<string | undefined>).detail);
      setKey((k) => k + 1);
      setOpen(true);
    };
    window.addEventListener("orbi:open", onOpen);
    return () => window.removeEventListener("orbi:open", onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (path.includes("/reuniao/")) return null;
  // Na conversa (celular) o botão cobriria o "Enviar": lá o Orbi fica no menu.
  const inChat = /\/(c|dm)\//.test(path);
  return (
    <>
      {open && <div className={`${s.wrap} ${inChat ? s.wrapChat : ""}`}><OrbiChat key={key} name={name} initial={initial} onClose={() => setOpen(false)} /></div>}
      <button className={`${s.fab} ${inChat ? s.fabChat : ""} ${inChat && !open ? s.fabHideSm : ""}`} onClick={() => { setInitial(undefined); setOpen((o) => !o); }} aria-expanded={open} aria-label={open ? "Fechar Orbi" : "Abrir Orbi, a ajuda do Gather"}>
        {open ? <Icon name="x" size={22} /> : <Orbi size={46} title="Orbi" />}
      </button>
    </>
  );
}

/** Botão que abre o Orbi (Central de ajuda, artigo). */
export function AskOrbiButton({ className, question, children }: { className?: string; question?: string; children: React.ReactNode }) {
  return <button type="button" className={className} onClick={() => openOrbi(question)}>{children}</button>;
}
