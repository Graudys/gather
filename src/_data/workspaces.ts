import "server-only";
import { createClient } from "@/_lib/supabase/server";
import { requireMember, requireReadyUser } from "@/_lib/auth/dal";
import type { ChannelSummary, MessageView, WorkspaceSummary, WorkspaceView } from "@/types/domain";

// Leitura com a sessão da pessoa: o RLS só devolve o que é dela.

export async function listMyWorkspaces(): Promise<WorkspaceSummary[]> {
  await requireReadyUser("/app");
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, kind)")
    .order("joined_at");
  return (data ?? []).map((r) => {
    const w = r.workspaces as unknown as { id: string; name: string; kind: WorkspaceSummary["kind"] };
    return { id: w.id, name: w.name, kind: w.kind, role: r.role as WorkspaceSummary["role"] };
  });
}

export async function getWorkspaceView(workspaceId: string, channelId?: string): Promise<WorkspaceView> {
  const { workspace, role } = await requireMember(workspaceId);
  const supabase = await createClient();

  const [{ data: channels }, { data: settings }, { data: cfg }] = await Promise.all([
    supabase.from("channels").select("id, name, visibility").eq("workspace_id", workspaceId).order("name"),
    supabase.from("workspace_settings").select("message_retention_months, file_retention_hours, calls_enabled").eq("workspace_id", workspaceId).single(),
    supabase.from("platform_config").select("calls_for_all_workspaces").single(),
  ]);
  const list = (channels ?? []) as ChannelSummary[];
  const current = list.find((c) => c.id === channelId) ?? list[0] ?? null;

  let messages: MessageView[] = [];
  if (current) {
    const { data } = await supabase
      .from("messages")
      .select("id, content, created_at, deleted_at, sender:profiles(display_name)")
      .eq("channel_id", current.id)
      .is("parent_message_id", null)
      .order("created_at", { ascending: false })
      .limit(50);
    messages = (data ?? []).map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.created_at,
      deleted: Boolean(m.deleted_at),
      senderName: (m.sender as unknown as { display_name: string } | null)?.display_name ?? null,
    }));
  }

  return {
    workspace: { id: workspace.id, name: workspace.name, kind: workspace.kind as WorkspaceView["workspace"]["kind"] },
    role,
    channels: list,
    current,
    messages,
    retention: { messageMonths: settings?.message_retention_months ?? 3, fileHours: settings?.file_retention_hours ?? 24 },
    callsEnabled: Boolean(settings?.calls_enabled || cfg?.calls_for_all_workspaces),
  };
}
