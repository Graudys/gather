import { vi } from "vitest";

/**
 * Sessão falsa: os testes trocam quem está "logado" com setSessionUser.
 * O resto (Prisma, regras de acesso em _data e dal.ts) é o código real,
 * rodando contra o banco de teste.
 */
export const session: { user: Record<string, unknown> | null; id: string | null } = { user: null, id: null };

export function setSessionUser(u: { id: string; email?: string; name?: string; role?: string } | null) {
  session.user = u
    ? { email: `${u.id}@t.test`, name: "Teste", role: "user", banned: false, mustChangePassword: false, ageConfirmedAt: new Date(), termsAcceptedAt: new Date(), ...u }
    : null;
}

/** Id da sessão do aparelho "logado" (precisa existir na tabela sessions para inscrições de push). */
export function setSessionId(id: string | null) {
  session.id = id;
}

export class Redirect extends Error {
  constructor(public to: string) { super(`REDIRECT ${to}`); }
}
export class NotFound extends Error {
  constructor() { super("NOT_FOUND"); }
}

vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
// after(): roda na hora (nos testes não há resposta para esperar).
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Redirect(to); },
  notFound: () => { throw new NotFound(); },
}));
vi.mock("@/_lib/auth/auth", () => ({
  auth: { api: { getSession: async () => (session.user ? { user: session.user, session: { id: session.id } } : null) } },
}));
