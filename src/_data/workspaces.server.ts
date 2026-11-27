import "server-only";
import { DEFAULT_NOTEBOOK, ROUTINE_PROJECT } from "@/lib/notes";
import { db } from "@/_lib/db/prisma";

/** slug curto e único: nome-normalizado + 6 caracteres aleatórios. */
export function makeSlug(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "ws";
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 6);
  return `${base}-${rand}`;
}

/** Defaults de prazo vindos de Admin › Configurações. */
async function retentionDefaults() {
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { defaultMessageMonths: true, defaultFileHours: true } });
  return { messageRetentionMonths: cfg?.defaultMessageMonths ?? 3, fileRetentionHours: cfg?.defaultFileHours ?? 24 };
}

/**
 * Espaço pessoal (um por pessoa), criado junto com o acesso.
 * Não é uma Server Action: só é chamado por código do servidor que já conferiu o acesso.
 */
export async function ensurePersonalWorkspace(userId: string, name: string) {
  const existing = await db.workspace.findFirst({ where: { kind: "PERSONAL", createdById: userId }, select: { id: true } });
  if (existing) return existing.id;
  const ret = await retentionDefaults();
  const ws = await db.workspace.create({
    data: {
      name: `Espaço de ${name.split(" ")[0]}`,
      slug: makeSlug(name),
      kind: "PERSONAL",
      createdById: userId,
      members: { create: { userId, role: "OWNER" } },
      settings: { create: ret },
      // Caderno fixo "Anotações" (Notas). Não pode ser apagado.
      notebooks: { create: { name: DEFAULT_NOTEBOOK, isDefault: true, createdById: userId } },
    },
    select: { id: true },
  });
  await ensureRoutineProject(ws.id, userId);
  return ws.id;
}

/** Workspace de equipe com o canal #geral. Confere o limite por dono dentro da transação. */
export async function createTeamWorkspaceFor(userId: string, name: string) {
  const ret = await retentionDefaults();
  return db.$transaction(async (tx) => {
    // Trava por pessoa: dois cliques rápidos não passam do limite.
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`ws-owner:${userId}`}))`;
    const cfg = await tx.platformConfig.findUnique({ where: { id: 1 }, select: { maxOwnedTeamWorkspaces: true } });
    const max = cfg?.maxOwnedTeamWorkspaces ?? 3;
    const owned = await tx.workspaceMember.count({ where: { userId, role: "OWNER", workspace: { kind: "TEAM" } } });
    if (owned >= max) return { ok: false as const, error: "limite" as const };
    const ws = await tx.workspace.create({
      data: {
        name,
        slug: makeSlug(name),
        kind: "TEAM",
        createdById: userId,
        members: { create: { userId, role: "OWNER" } },
        settings: { create: ret },
        channels: { create: { name: "geral", kind: "CUSTOM", visibility: "PUBLIC", createdById: userId } },
      },
      select: { id: true },
    });
    return { ok: true as const, id: ws.id };
  });
}

/**
 * Projeto fixo "Minha rotina" do espaço pessoal: quadro só seu, que não pode
 * ser apagado nem arquivado. Criado no primeiro acesso (ou na próxima visita,
 * para espaços antigos). Fica na equipe escondida "Geral".
 * Não é uma Server Action: só é chamado por código do servidor que já conferiu o acesso.
 */
export async function ensureRoutineProject(workspaceId: string, userId: string) {
  const found = await db.project.findFirst({ where: { isFixed: true, team: { workspaceId } }, select: { id: true, name: true } });
  if (found) return found;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`routine:${workspaceId}`}))`;
    const again = await tx.project.findFirst({ where: { isFixed: true, team: { workspaceId } }, select: { id: true, name: true } });
    if (again) return again;
    const team =
      (await tx.team.findFirst({ where: { workspaceId, slug: "geral" }, select: { id: true } })) ??
      (await tx.team.create({ data: { workspaceId, name: "Geral", slug: "geral", visibility: "WORKSPACE", createdById: userId }, select: { id: true } }));
    const cols = ["A fazer", "Fazendo", "Feito"];
    return tx.project.create({
      data: {
        teamId: team.id, name: ROUTINE_PROJECT, slug: "minha-rotina", isFixed: true, createdById: userId,
        description: "Seu quadro pessoal para o dia a dia.",
        members: { create: { userId, role: "PROJECT_ADMIN" } },
        taskStatuses: { create: cols.map((n, i) => ({ name: n, position: i, isCompleted: i === cols.length - 1 })) },
      },
      select: { id: true, name: true },
    });
  });
}
