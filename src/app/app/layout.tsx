import Link from "next/link";
import { Logo } from "@/components/ui";
import { requireReadyUser } from "@/lib/auth/dal";
import { isPlatformAdminRow } from "@/lib/auth/dal";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireReadyUser("/app");
  const admin = await isPlatformAdminRow(user.id);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-white/10 px-6 py-3">
        <Link href="/app"><Logo /></Link>
        <span className="flex-1" />
        {admin && <Link href="/admin" className="rounded-md bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-300">ADMIN</Link>}
        <span className="text-sm text-neutral-400">{user.displayName}</span>
        <form action={signOut}><button className="text-sm text-neutral-400 hover:text-white">Sair</button></form>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
