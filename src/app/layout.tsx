import type { Metadata } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import "@/_styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Gather", template: "%s · Gather" },
  description: "Chat, reuniões, projetos e tarefas no mesmo lugar. Versão pessoal, só para convidados.",
  robots: { index: false, follow: false },
  applicationName: "Gather",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Ler os cabeçalhos deixa toda página dinâmica: é o que permite ao Next
  // colocar o nonce da CSP (criado no proxy) nos próprios scripts.
  await headers();
  return (
    <html lang="pt-BR" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
