import "server-only";
import { z } from "zod";

// Segredos: só existem no servidor. Este arquivo quebra o build se for
// importado por um componente do navegador ("server-only").
const serverSchema = z.object({
  DATABASE_URL: z.string().startsWith("postgres"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET precisa de 32+ caracteres"),
  BETTER_AUTH_URL: z.url(),
  ADMIN_EMAIL: z.email().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  LGPD_ENABLED: z.enum(["true", "false"]).default("false"),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    LGPD_ENABLED: process.env.LGPD_ENABLED || undefined,
  });
  return cached;
}
