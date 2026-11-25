import { notFound } from "next/navigation";
import { AppShell } from "@/_components/shell/AppShell";
import { id as Id } from "@/lib/validation";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/w/[id]">) {
  const { id } = await params;
  if (!Id.safeParse(id).success) notFound();
  return <AppShell workspaceId={id}>{children}</AppShell>;
}
