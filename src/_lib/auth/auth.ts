import "server-only";
import { betterAuth, APIError } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/_lib/db/prisma";

/**
 * Better Auth, só com e-mail e senha.
 *
 * - Não existe cadastro: `disableSignUp`. Contas nascem em Admin › Pessoas
 *   (src/_data/people.actions.ts) com uma senha temporária.
 * - Nenhuma rota HTTP do Better Auth é exposta (não há /api/auth). Tudo roda
 *   por Server Actions chamando `auth.api.*`; o plugin nextCookies grava os
 *   cookies. Menos superfície: não há endpoint de cadastro, reset por e-mail etc.
 * - Sessão em cookie HttpOnly, SameSite=Lax, Secure em produção.
 */
export const auth = betterAuth({
  appName: "Gather",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  telemetry: { enabled: false },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    maxPasswordLength: 72,
    // Sem e-mail na versão pessoal: quem esquece a senha pede ao admin.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
  },

  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
      timezone: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: true, input: false },
      tempPasswordExpiresAt: { type: "date", required: false, input: false },
      ageConfirmedAt: { type: "date", required: false, input: false },
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 dias
    updateAge: 60 * 60 * 24, // renova uma vez por dia de uso
    // Cache curto em cookie assinado: evita ler a sessão no banco a cada página.
    // Desativar acesso ou encerrar sessões vale em até 1 minuto.
    cookieCache: { enabled: true, maxAge: 60 },
  },

  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "gather",
  },

  databaseHooks: {
    session: {
      create: {
        // Senha temporária vencida não entra: o admin gera outra.
        before: async (session) => {
          const u = await db.user.findUnique({
            where: { id: session.userId },
            select: { mustChangePassword: true, tempPasswordExpiresAt: true },
          });
          if (u?.mustChangePassword && u.tempPasswordExpiresAt && u.tempPasswordExpiresAt < new Date()) {
            throw new APIError("FORBIDDEN", { message: "TEMP_PASSWORD_EXPIRED" });
          }
        },
      },
    },
  },

  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      bannedUserMessage: "ACCESS_DISABLED",
    }),
    nextCookies(), // precisa ser o último
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
