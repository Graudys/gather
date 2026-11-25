import { PageCrumb } from "@/_components/shell/ShellContext";
import { notFound } from "next/navigation";
import { ChatPane } from "@/_components/chat/ChatPane";
import { getChatView, getWorkspaceShell } from "@/_data/chat";
import { id as Id } from "@/lib/validation";

export default async function ConversationPage({ params, searchParams }: PageProps<"/app/w/[id]/dm/[conversationId]">) {
  const { id, conversationId } = await params;
  if (!Id.safeParse(conversationId).success) notFound();
  const sp = (await searchParams) as { thread?: string; limite?: string };
  const thread = sp.thread && Id.safeParse(sp.thread).success ? sp.thread : undefined;
  const limit = clampLimit(sp.limite);
  const [view, shell] = await Promise.all([getChatView(id, { kind: "dm", id: conversationId }, { threadId: thread, limit }), getWorkspaceShell(id)]);
  return <><PageCrumb label={view.title} /><ChatPane view={view} workspaceId={id} base={`/app/w/${id}/dm/${conversationId}`} limit={limit} months={shell.retention.messageMonths} /></>;
}

function clampLimit(v?: string) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n / 50) * 50, 50), 500) : 50;
}
