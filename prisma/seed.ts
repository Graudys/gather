/**
 * npm run db:seed
 * - cria a linha de configuração (Admin › Configurações) se não existir;
 * - cria o primeiro admin (ADMIN_EMAIL) com uma senha temporária, mostrada
 *   só neste terminal. No primeiro login você troca a senha.
 * Pode rodar mais de uma vez: não duplica nada e não troca senha de quem já existe.
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { STARTER_ARTICLES, STARTER_CATEGORIES } from "../src/_lib/help/starter";

config({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }) });

function tempPassword() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  while (out.length < 16) {
    const b = crypto.getRandomValues(new Uint8Array(1))[0];
    if (b < 220) out += a[b % 55];
  }
  return out.match(/.{4}/g)!.join("-");
}

async function main() {
  const cfg = await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  console.log("✔ Configuração pronta");

  // Central de ajuda: assuntos e artigos iniciais (só os que faltam; não sobrescreve).
  const cats = new Map<string, string>();
  for (const c of STARTER_CATEGORIES) cats.set(c.slug, (await db.helpCategory.upsert({ where: { slug: c.slug }, create: { ...c }, update: {}, select: { id: true } })).id);
  for (const { category, ...a } of STARTER_ARTICLES) {
    await db.helpArticle.upsert({ where: { slug: a.slug }, create: { ...a, categoryId: cats.get(category)!, status: "PUBLISHED" }, update: {} });
  }
  console.log(`✔ Central de ajuda: ${STARTER_ARTICLES.length} artigos iniciais`);

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.log("ADMIN_EMAIL vazio: nenhum admin criado.");
    return;
  }
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    if (exists.role !== "admin") await db.user.update({ where: { id: exists.id }, data: { role: "admin" } });
    console.log(`✔ ${email} já existe (papel: admin). Senha não foi alterada.`);
    return;
  }

  const password = tempPassword();
  const name = process.env.ADMIN_NAME?.trim() || email.split("@")[0];
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name,
      email,
      role: "admin",
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + cfg.tempPasswordHours * 3600_000),
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
      workspaceMemberships: {
        create: {
          role: "OWNER",
          workspace: {
            create: {
              name: `Espaço de ${name.split(" ")[0]}`,
              slug: `pessoal-${id.slice(0, 8)}`,
              kind: "PERSONAL",
              createdById: id,
              settings: { create: { messageRetentionMonths: cfg.defaultMessageMonths, fileRetentionHours: cfg.defaultFileHours } },
            },
          },
        },
      },
    },
  });
  console.log(`\n✔ Admin criado: ${email}`);
  console.log(`  Senha temporária: ${password}`);
  console.log("  Entre em /entrar com ela. No primeiro acesso você cria a sua senha.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
