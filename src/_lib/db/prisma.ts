import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Um cliente só por processo. Em dev o Next recarrega módulos; guardar no
 * globalThis evita abrir uma conexão nova a cada recarga.
 * Toda leitura e escrita passa por src/_data/*, que confere o acesso antes.
 */
const g = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  // PRISMA_LOG=1 no .env.local mostra cada consulta no terminal (para achar lentidão).
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: process.env.PRISMA_LOG ? ["query"] : [] });
}

export const db = g.prisma ?? create();
if (process.env.NODE_ENV !== "production") g.prisma = db;
