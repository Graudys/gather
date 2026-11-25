import type { Metadata } from "next";
import { Opening } from "@/_components/ui/Opening";

export const metadata: Metadata = { title: "Abrindo" };

// Depois de entrar: mostra a abertura com o logo animado e já vai para o app.
export default async function Abrindo({ searchParams }: PageProps<"/abrindo">) {
  const { next } = (await searchParams) as { next?: string };
  const safe = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/app";
  return <Opening next={safe} />;
}
