// Tipos do domínio usados entre _data, _components e app.
// Os tipos completos do banco saem de `npm run db:types` em database.types.ts.

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type WorkspaceKind = "PERSONAL" | "TEAM";

export type WorkspaceSummary = { id: string; name: string; kind: WorkspaceKind; role: WorkspaceRole };

export type ChannelSummary = { id: string; name: string; visibility: "PUBLIC" | "PRIVATE" };

export type MessageView = {
  id: string;
  content: string;
  createdAt: string;
  deleted: boolean;
  senderName: string | null;
};

export type WorkspaceView = {
  workspace: { id: string; name: string; kind: WorkspaceKind };
  role: WorkspaceRole;
  channels: ChannelSummary[];
  current: ChannelSummary | null;
  messages: MessageView[];
  retention: { messageMonths: number; fileHours: number };
  callsEnabled: boolean;
};

export type ErrorStatus = "NEW" | "OPEN" | "RESOLVED" | "IGNORED" | "REGRESSED";

export type ErrorRow = {
  id: string;
  status: ErrorStatus;
  source: string;
  message: string;
  location: string;
  count: number;
  usersAffected: number;
  lastSeenAt: string;
  release: string | null;
};

export type AdminKpis = { pessoas: number; workspaces: number; chamados: number; erros: number };
