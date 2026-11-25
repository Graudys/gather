import { AppShell } from "@/_components/shell/AppShell";

// Perfil, notificações, ajuda e criar workspace: usam a casca do último workspace aberto.
export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return <AppShell workspaceId={null}>{children}</AppShell>;
}
