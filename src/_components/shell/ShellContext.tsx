"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Detalhe da trilha no topo (ex.: nome do projeto) e gaveta do celular. */
type Ctx = { crumb: string | null; setCrumb: (c: string | null) => void; drawer: boolean; setDrawer: (o: boolean) => void; newWs: boolean; setNewWs: (o: boolean) => void };
const ShellCtx = createContext<Ctx>({ crumb: null, setCrumb: () => {}, drawer: false, setDrawer: () => {}, newWs: false, setNewWs: () => {} });

export function ShellProvider({ children }: { children: ReactNode }) {
  const [crumb, setCrumb] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [newWs, setNewWs] = useState(false);
  return <ShellCtx.Provider value={{ crumb, setCrumb, drawer, setDrawer, newWs, setNewWs }}>{children}</ShellCtx.Provider>;
}

export const useShell = () => useContext(ShellCtx);

/** Coloque numa página para mostrar o nome dela no fim da trilha (Workspace / Projetos / <nome>). */
export function PageCrumb({ label }: { label: string }) {
  const { setCrumb } = useShell();
  useEffect(() => {
    setCrumb(label);
    return () => setCrumb(null);
  }, [label, setCrumb]);
  return null;
}

/** Guarda o último workspace aberto (para /app abrir direto nele). Não é dado sensível. */
export function RememberWorkspace({ id }: { id: string }) {
  useEffect(() => {
    document.cookie = `gather.ws=${id}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  }, [id]);
  return null;
}

/** Botão que abre a janela "Criar workspace" (vale em qualquer tela do app). */
export function NewWorkspaceButton({ className, children }: { className?: string; children: ReactNode }) {
  const { setNewWs } = useShell();
  return <button type="button" className={className} onClick={() => setNewWs(true)}>{children}</button>;
}
