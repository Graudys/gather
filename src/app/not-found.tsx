import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">Não encontramos esta página</h1>
      <p className="text-neutral-400">Ela não existe ou você não tem acesso.</p>
      <Link href="/app" className="underline">Voltar ao início</Link>
    </main>
  );
}
