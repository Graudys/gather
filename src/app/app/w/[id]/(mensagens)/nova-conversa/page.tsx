import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { startConversation } from "@/_data/chat.actions";
import { getWorkspaceShell, listWorkspacePeople } from "@/_data/chat";
import { Button } from "@/_components/ui/Button";
import { Avatar } from "@/_components/chat/Avatar";
import p from "@/_styles/chat/Panel.module.css";

export const metadata: Metadata = { title: "Nova conversa" };

export default async function NovaConversa({ params }: PageProps<"/app/w/[id]/nova-conversa">) {
  const { id } = await params;
  const shell = await getWorkspaceShell(id);
  if (shell.workspace.kind === "PERSONAL") redirect(`/app/w/${id}`);
  const people = (await listWorkspacePeople(id)).filter((x) => !x.isMe);
  return (
    <div className={p.page}>
      <div className={p.narrow}>
        <h1 className={p.title}>Nova conversa</h1>
      </div>
      <form action={startConversation} className={`${p.card} ${p.narrow}`}>
        <input type="hidden" name="workspaceId" value={id} />
        {people.length === 0 ? (
          <p className={p.note}>Ainda não tem mais ninguém neste workspace. Donos e admins adicionam pessoas em Configurações.</p>
        ) : (
          <>
            <p className={p.note}>Escolha uma pessoa para conversa direta, ou várias para um grupo (até 8).</p>
            <div className={p.people}>
              {people.map((x) => (
                <label key={x.id} className={p.person}>
                  <input type="checkbox" name="userIds" value={x.id} />
                  <Avatar id={x.id} name={x.name} small />
                  <span>
                    <div className={p.personName}>{x.name}</div>
                    <div className={p.personMail}>{x.email}</div>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
        <div className={p.actions}>
          <Link href={`/app/w/${id}`}><Button type="button" variant="ghost">Cancelar</Button></Link>
          {people.length > 0 && <Button>Iniciar conversa</Button>}
        </div>
      </form>
    </div>
  );
}
