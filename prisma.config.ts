import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Lê .env.local (o mesmo do Next) e, se existir, .env.
config({ path: [".env.local", ".env"], quiet: true });

// O Prisma CLI (migrate, studio) usa a conexão direta (sem pgbouncer).
// O app usa DATABASE_URL (pooler) em src/_lib/db/prisma.ts.
// `prisma generate` não precisa de banco: por isso a URL pode faltar no npm i e na Vercel.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});