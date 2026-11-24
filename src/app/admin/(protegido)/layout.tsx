import Link from "next/link";
import { Logo } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth/dal";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

// Toda página daqui exige: estar em platform_admins + sessão com MFA (aal2).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="grid min-h-screen grid-cols-[230px_1fr]">
      <nav className="flex flex-col gap-1 border-r border-white/10 p-4 text-sm">
        <div className="mb-4 flex items-center gap-2"><Logo /><span className="rounded bg-amber-400/15 px-1.5 text-[11px] font-semibold text-amber-300">ADMIN</span></div>
        <Link className="rounded-md px-2 py-1.5 hover:bg-white/5" href="/admin">Visão geral</Link>
        <Link className="rounded-md px-2 py-1.5 hover:bg-white/5" href="/admin/erros">Erros e acessos</Link>
        <Link className="mt-auto rounded-md px-2 py-1.5 text-neutral-400 hover:bg-white/5" href="/app">Voltar ao app</Link>
      </nav>
      <main className="p-8">{children}</main>
    </div>
  );
}
