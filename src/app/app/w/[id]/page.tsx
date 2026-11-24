import { notFound } from "next/navigation";
import { ChannelSidebar } from "@/_components/app/ChannelSidebar";
import { MessageList } from "@/_components/app/MessageList";
import { Composer } from "@/_components/app/Composer";
import { getWorkspaceView } from "@/_data/workspaces";
import { id as Id } from "@/lib/validation";
import s from "@/_styles/app/Workspace.module.css";

export default async function WorkspacePage({ params, searchParams }: PageProps<"/app/w/[id]">) {
  const { id } = await params;
  if (!Id.safeParse(id).success) notFound();
  const { canal } = (await searchParams) as { canal?: string };
  const view = await getWorkspaceView(id, canal);
  return (
    <div className={s.layout}>
      <ChannelSidebar view={view} />
      <section className={s.main}>
        <MessageList messages={view.messages} />
        {view.current && <Composer workspaceId={id} channelId={view.current.id} channelName={view.current.name} />}
      </section>
    </div>
  );
}
