import "server-only";
import { db } from "@/_lib/db/prisma";
import type { AccessEvent, ErrorSource as Source } from "@/generated/prisma/enums";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi;
const TOKEN = /\b(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_(secret|publishable)_\w+|re_\w{10,}|Bearer\s+\S+)/g;
const DIGITS = /\b\d{4,}\b/g;

/** Tira e-mail, token e números longos do texto do erro antes de guardar. */
export function scrub(text: string): string {
  return text.replace(TOKEN, "[token]").replace(EMAIL, "[email]");
}

/** Mesma "impressão digital" para erros iguais: tira IDs e números variáveis. */
export function fingerprint(source: Source, message: string, location: string): string {
  const norm = `${source}|${message.replace(UUID, ":id").replace(DIGITS, ":n").slice(0, 200)}|${location.replace(UUID, ":id")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${source.toLowerCase()}-${(h >>> 0).toString(16)}`;
}

/**
 * Grava o erro agrupado em error_events (+ contagem por hora para o gráfico).
 * Sem e-mail: o aviso aparece em Admin › Erros. Nunca lança.
 */
export async function reportError(input: {
  source: Source;
  message: string;
  location: string;
  stack?: string | null;
  userId?: string | null;
  workspaceId?: string | null;
  browser?: string | null;
}) {
  try {
    const message = scrub(input.message).slice(0, 500);
    const location = scrub(input.location).replace(UUID, "[id]").slice(0, 300);
    const fp = fingerprint(input.source, message, location);
    const release = process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev";
    const stack = input.stack ? scrub(input.stack).slice(0, 8000) : null;
    const hour = new Date();
    hour.setMinutes(0, 0, 0);

    // Dois erros iguais ao mesmo tempo: o segundo "create" bate no unique e tenta de novo como update.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await save();
        break;
      } catch (e) {
        if (attempt === 1 || (e as { code?: string }).code !== "P2002") throw e;
      }
    }

    async function save() {
    await db.$transaction(async (tx) => {
      const prev = await tx.errorEvent.findUnique({ where: { fingerprint: fp }, select: { id: true, status: true, sampleUserIds: true, sampleWorkspaceIds: true, browsers: true } });
      const users = new Set(prev?.sampleUserIds ?? []);
      if (input.userId && users.size < 20) users.add(input.userId);
      const wss = new Set(prev?.sampleWorkspaceIds ?? []);
      if (input.workspaceId && wss.size < 20) wss.add(input.workspaceId);
      const browsers = { ...((prev?.browsers as Record<string, number> | null) ?? {}) };
      if (input.browser) browsers[input.browser] = (browsers[input.browser] ?? 0) + 1;

      const ev = prev
        ? await tx.errorEvent.update({
            where: { id: prev.id },
            data: {
              count: { increment: 1 },
              lastSeenAt: new Date(),
              release,
              stack: stack ?? undefined,
              sampleUserIds: [...users],
              sampleWorkspaceIds: [...wss],
              usersAffected: users.size,
              browsers,
              // Voltou depois de resolvido: marca como regressão.
              ...(prev.status === "RESOLVED" ? { status: "REGRESSED", resolvedAt: null, resolvedById: null } : {}),
            },
          })
        : await tx.errorEvent.create({
            data: { fingerprint: fp, source: input.source, message, location, stack, release, sampleUserIds: [...users], sampleWorkspaceIds: [...wss], usersAffected: users.size, browsers },
          });
      await tx.errorHourlyCount.upsert({
        where: { errorId_hour: { errorId: ev.id, hour } },
        create: { errorId: ev.id, hour, count: 1 },
        update: { count: { increment: 1 } },
      });
    });
    }
  } catch (e) {
    console.error("[observability] falha ao registrar erro", e);
  }
}

/** Registro de acesso (Marco Civil): entrada, saída, troca de senha, ações do admin na conta. */
export async function logAccess(userId: string | null, event: AccessEvent, method: string | null, ip: string, ua: string) {
  try {
    await db.accessLog.create({ data: { userId, event, method, ip, userAgent: ua } });
  } catch (e) {
    console.error("[observability] falha ao registrar acesso", e);
  }
}
