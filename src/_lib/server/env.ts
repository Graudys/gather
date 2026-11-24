import "server-only";
import { z } from "zod";

// Segredos: só existem no servidor. Este arquivo quebra o build se for
// importado por um componente do navegador ("server-only").
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  LIVEKIT_URL: z.string().startsWith("wss://").optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  ALERT_EMAIL: z.email().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    LIVEKIT_URL: process.env.LIVEKIT_URL || undefined,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || undefined,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    ALERT_EMAIL: process.env.ALERT_EMAIL || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || undefined,
  });
  return cached;
}
