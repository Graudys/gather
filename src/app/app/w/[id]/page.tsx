import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/dal";
import { Button } from "@/components/ui";
import { sendMessage, requestMeetings } from "../../actions";

export default async function WorkspacePage({ params, searchParams }: PageProps<"/app/w/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { workspace } = await requireMember(id);
  const { canal } = (await searchParams) as { canal?: string };
  const supabase = await createClient();

  const [{ data: channels }, { data: settings }, { data: cfg }] = await Promise.all([
    supabase.from("channels").select("id, name, visibility").eq("workspace_id", id).order("name"),
    supabase.from("workspace_settings").select("message_retention_months, file_retention_hours, calls_enabled").eq("workspace_id", id).single(),
    supabase.from("platform_config").select("calls_for_all_workspaces").single(),
  ]);
  const current = channels?.find((c) => c.id === canal) ?? channels?.[0];
  const { data: messages } = current
    ? await supabase
        .from("messages")
        .select("id, content, created_at, deleted_at, sender:profiles(display_name)")
        .eq("channel_id", current.id)
        .is("parent_message_id", null)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const callsOn = Boolean(settings?.calls_enabled || cfg?.calls_for_all_workspaces);

  return (
    <div className="grid min-h-[calc(100vh-57px)] grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-1 border-r border-white/10 p-4">
        <b className="mb-3">{workspace.name}</b>
        {channels?.map((c) => (
          <a key={c.id} href={`?canal=${c.id}`} className={`rounded-md px-2 py-1.5 text-sm ${c.id === current?.id ? "bg-white/10" : "text-neutral-400 hover:text-white"}`}>
            {c.visibility === "PRIVATE" ? "🔒 " : "# "}{c.name}
          </a>
        ))}
        <div className="mt-auto rounded-lg border border-white/10 p-3 text-xs text-neutral-400">
          Mensagens somem após {settings?.message_retention_months} meses. Arquivos do chat: {settings?.file_retention_hours === 24 ? "24 horas" : "7 dias"}.
        </div>
        {workspace.kind === "TEAM" && !callsOn && (
          <form action={requestMeetings} className="mt-2">
            <input type="hidden" name="workspaceId" value={id} />
            <Button variant="ghost" className="w-full text-sm">Reuniões em breve · Quero</Button>
          </form>
        )}
      </aside>
      <section className="flex flex-col">
        <ol className="flex flex-1 flex-col-reverse gap-3 overflow-y-auto p-6">
          {messages?.map((m) => (
            <li key={m.id} className="text-sm">
              <b>{(m.sender as unknown as { display_name: string } | null)?.display_name ?? "Pessoa removida"}</b>{" "}
              <span className="text-xs text-neutral-500">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
              {/* Texto renderizado pelo React: HTML do usuário nunca vira HTML. */}
              <p className="whitespace-pre-wrap text-neutral-200">{m.deleted_at ? <i className="text-neutral-500">mensagem apagada</i> : m.content}</p>
            </li>
          ))}
        </ol>
        {current && (
          <form action={sendMessage} className="flex gap-2 border-t border-white/10 p-4">
            <input type="hidden" name="workspaceId" value={id} />
            <input type="hidden" name="channelId" value={current.id} />
            <input name="content" required maxLength={4000} placeholder={`Mensagem em #${current.name}`}
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none focus:border-[#5b8cff]" />
            <Button>Enviar</Button>
          </form>
        )}
      </section>
    </div>
  );
}
