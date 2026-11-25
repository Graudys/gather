import "server-only";
import { db } from "@/_lib/db/prisma";

/**
 * Limpeza diária (Vercel Cron → /api/cron/diario).
 * Mensagens: janela móvel por workspace (o corte é calculado na hora, então
 * diminuir o prazo vale para o histórico). Respostas de thread vão junto.
 */
export async function runDailyCleanup(now = new Date()) {
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 } });
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

  const messages = await db.$executeRaw`
    delete from messages m
    using workspace_settings s
    where s.workspace_id = m.workspace_id
      and m.created_at < ${now}::timestamptz - make_interval(months => s.message_retention_months)`;

  const [botQuestions, accessLogs, errors, rateLimits, sessions, verifications] = await Promise.all([
    db.botQuestion.deleteMany({ where: { createdAt: { lt: days(cfg?.botQuestionRetentionDays ?? 90) } } }),
    db.accessLog.deleteMany({ where: { createdAt: { lt: days(cfg?.accessLogRetentionDays ?? 180) } } }),
    db.errorEvent.deleteMany({ where: { lastSeenAt: { lt: days(cfg?.errorRetentionDays ?? 30) } } }),
    db.rateLimit.deleteMany({ where: { windowStart: { lt: days(1) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);

  return {
    messages,
    botQuestions: botQuestions.count,
    accessLogs: accessLogs.count,
    errors: errors.count,
    rateLimits: rateLimits.count,
    sessions: sessions.count,
    verifications: verifications.count,
  };
}
