import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspaceShell } from "@/_data/chat";
import { leaveWorkspace } from "@/_data/members.actions";
import { Button } from "@/_components/ui/Button";
import p from "@/_styles/chat/Panel.module.css";

export const metadata: Metadata = { title: "Sair do workspace" };

export default async function Sair({ params }: PageProps<"/app/w/[id]/sair">) {
  const { id } = await params;
  const shell = await getWorkspaceShell(id);
  if (shell.role === "OWNER") redirect(`/app/w/${id}/configuracoes`);
  return (
    <div className={p.page}>
      <form action={leaveWorkspace} className={`${p.card} ${p.narrow}`}>
        <input type="hidden" name="workspaceId" value={id} />
        <b className={p.cardTitle}>Sair de {shell.workspace.name}?</b>
        <p className={p.note}>Você deixa de ver os canais e conversas daqui. Suas mensagens antigas continuam até o prazo do workspace. Para voltar, um admin precisa te adicionar.</p>
        <div className={p.actions}>
          <Link href={`/app/w/${id}`}><Button type="button" variant="ghost">Cancelar</Button></Link>
          <Button>Sair do workspace</Button>
        </div>
      </form>
    </div>
  );
}
