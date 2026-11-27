// Tipos do domínio usados entre _data, _components e app.
// Os tipos completos do banco vêm do Prisma (src/generated/prisma).

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type WorkspaceKind = "PERSONAL" | "TEAM";

export type WorkspaceSummary = { id: string; name: string; kind: WorkspaceKind; role: WorkspaceRole };

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

export type AdminKpis = { pessoas: number; workspaces: number; pendentes: number; erros: number };


// ── Chat ──────────────────────────────────────────────────────────────

export type ChatTarget = { kind: "channel"; id: string } | { kind: "dm"; id: string };

export type SidebarChannel = { id: string; name: string; visibility: "PUBLIC" | "PRIVATE"; icon: string | null; canManage: boolean; unread: number };
export type SidebarConversation = { id: string; title: string; initials: string; kind: "DIRECT" | "GROUP"; icon: string | null; unread: number };

export type WorkspaceShell = {
  workspace: { id: string; name: string; kind: WorkspaceKind };
  role: WorkspaceRole;
  me: { id: string; name: string };
  workspaces: { id: string; name: string; kind: WorkspaceKind }[];
  channels: SidebarChannel[];
  conversations: SidebarConversation[];
  retention: { messageMonths: number; fileHours: number };
};

export type ReactionView = { emoji: string; count: number; mine: boolean };

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  sender: { id: string; name: string } | null;
  replyCount: number;
  reactions: ReactionView[];
  files: FileView[];
  note: { id: string; title: string; preview: string } | null; // anotação enviada (cartão)
  pinned: boolean; // fixada no topo do canal
  canPin: boolean; // quem gerencia o canal, só mensagem principal
  canEdit: boolean;
  canDelete: boolean;
};

/** Arquivo anexado (mensagem ou tarefa). Abre por /api/arquivos/[id]. */
export type FileView = { id: string; name: string; mime: string; size: number; expired: boolean };

export type ChatView = {
  target: ChatTarget;
  title: string;
  description: string | null;
  visibility?: "PUBLIC" | "PRIVATE";
  icon: string | null;
  canEditIcon: boolean; // canal: quem gerencia; grupo: qualquer membro; conversa direta: ninguém
  members: { id: string; name: string; handle: string }[]; // handle = @apelido para menções
  canManage: boolean; // renomear/apagar canal, adicionar pessoas no privado
  messages: ChatMessage[]; // mais antigas primeiro
  pinned: ChatMessage[]; // fixadas no topo (canal), mais recentes primeiro
  hasMore: boolean;
  cutoff: string; // mensagens antes disso já foram apagadas pela retenção
  thread: { parent: ChatMessage; replies: ChatMessage[] } | null;
};

export type MemberRow = { id: string; name: string; email: string; role: WorkspaceRole; joinedAt: string; isMe: boolean };

// ── Projetos e tarefas ────────────────────────────────────────────────

export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type Person = { id: string; name: string };
export type LabelView = { id: string; name: string; color: string };

export type TeamRow = { id: string; name: string; description: string | null; visibility: "WORKSPACE" | "PRIVATE"; members: Person[]; projects: number; isMember: boolean };

export type ProjectCard = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  team: { id: string; name: string };
  dueDate: string | null;
  members: Person[];
  openTasks: number;
  doneTasks: number;
};

export type TaskCard = {
  id: string;
  title: string;
  description: string | null;
  statusId: string;
  position: string;
  priority: Priority;
  dueAt: string | null;
  completed: boolean;
  assignees: Person[];
  labels: LabelView[];
  comments: number;
};

export type BoardView = {
  project: { id: string; name: string; description: string | null; status: ProjectStatus; isFixed: boolean; startDate: string | null; dueDate: string | null; team: { id: string; name: string }; channelId: string | null };
  canManage: boolean;
  canSeeInsights: boolean; // painel de desempenho: só dono e admin do workspace
  statuses: { id: string; name: string; isCompleted: boolean }[];
  tasks: TaskCard[];
  people: Person[]; // quem pode ser responsável
  labels: LabelView[];
};

export type TaskDetail = TaskCard & {
  createdBy: Person | null;
  createdAt: string;
  canDelete: boolean;
  files: (FileView & { mine: boolean })[];
  commentList: { id: string; author: Person | null; content: string; createdAt: string; mine: boolean }[];
  activity: { text: string; at: string }[];
};

export type MyTask = { id: string; title: string; priority: Priority; dueAt: string | null; project: { id: string; name: string }; status: string };

// ── Agenda e reuniões ─────────────────────────────────────────────────

export type EventResponse = "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

export type CalendarItem =
  | { kind: "event"; id: string; title: string; startsAt: string; endsAt: string; hasMeeting: boolean; meetingId: string | null; myResponse: EventResponse | null }
  | { kind: "task"; id: string; title: string; dueAt: string; projectId: string; projectName: string };

export type EventDetail = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  visibility: "PRIVATE" | "TEAM" | "WORKSPACE";
  reminderMin: number | null;
  createdBy: Person | null;
  participants: (Person & { response: EventResponse })[];
  meetingId: string | null;
  project: { id: string; name: string } | null;
  canEdit: boolean;
  myResponse: EventResponse | null;
};

export type MeetingStatus = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

export type MeetingRow = {
  id: string;
  title: string;
  status: MeetingStatus;
  startsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  project: { id: string; name: string } | null;
  people: Person[];
  hasNotes: boolean;
};

export type MeetingUsage = { used: number; quota: number; left: number; renewsOn: string; enabled: boolean };

export type MeetingView = {
  id: string;
  title: string;
  status: MeetingStatus;
  startsAt: string | null;
  startedAt: string | null;
  hardEndAt: string | null;
  endedAt: string | null;
  maxParticipants: number;
  maxDurationMin: number;
  project: { id: string; name: string } | null;
  canEnd: boolean;
  inRoom: Person[]; // quem está na sala agora (pelo nosso registro)
  attendance: (Person & { minutes: number })[];
  notes: { content: string; decisions: { text: string; by: string }[]; updatedAt: string | null };
  tasks: { id: string; title: string; projectId: string; priority: Priority; assignees: Person[] }[];
  usage: MeetingUsage;
  configured: boolean; // LiveKit configurado no servidor
};
