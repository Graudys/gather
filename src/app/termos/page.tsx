import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termos de uso" };

// TODO: texto final revisado (ver a especificação, seção Privacidade e LGPD).
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Termos de uso</h1>
      <p className="mt-4 text-neutral-400">Em breve.</p>
    </main>
  );
}
