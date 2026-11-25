import { getWorkspaceShell } from "@/_data/chat";
import { ChatColumn } from "@/_components/chat/ChatColumn";
import { ChatSplit } from "@/_components/chat/ChatSplit";

// Mensagens: coluna de canais/conversas fica fixa; só a conversa troca.
export default async function MensagensLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shell = await getWorkspaceShell(id);
  return <ChatSplit column={<ChatColumn shell={shell} />}>{children}</ChatSplit>;
}
