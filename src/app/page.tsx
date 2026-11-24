import Link from "next/link";
import { Logo } from "@/components/ui";

// Página inicial simples. A landing completa (com o Orbi) vem dos mockups.
export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-8 p-8">
      <Logo />
      <h1 className="text-5xl font-semibold tracking-tight">Chat, tarefas, agenda e reuniões. Num lugar só.</h1>
      <p className="max-w-xl text-lg text-neutral-400">
        Para equipes pequenas. Mensagens com prazo, arquivos do chat que somem em 24 horas ou 7 dias, e reuniões por áudio liberadas aos poucos.
      </p>
      <div className="flex gap-3">
        <Link href="/cadastro" className="rounded-lg bg-gradient-to-br from-[#3d63e0] to-[#7c5cf0] px-5 py-3 font-medium">Comece grátis</Link>
        <Link href="/entrar" className="rounded-lg border border-white/15 px-5 py-3">Entrar</Link>
      </div>
      <p className="text-xs text-neutral-500">Só para maiores de 18 anos · <Link href="/termos" className="underline">Termos</Link> · <Link href="/privacidade" className="underline">Privacidade</Link></p>
    </main>
  );
}
