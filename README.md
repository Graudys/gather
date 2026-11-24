# Gather — versão pessoal

Chat, reuniões, projetos e tarefas para mim e meu time. Fechado: só entra quem
o admin cria em **Admin › Pessoas**, com uma senha temporária que a pessoa troca
no primeiro acesso (junto com 18+ e os termos). Sem cadastro, sem Google, sem e-mail.

- **Next.js 16** (App Router, Server Actions, `proxy.ts`), CSS Modules
- **Prisma ORM 7** (`prisma-client` + `@prisma/adapter-pg`) no Postgres do Supabase
- **Better Auth** (e-mail e senha + plugin admin), sessão em cookie HttpOnly
- PWA: instala no PC (Chrome/Edge) e no celular

A raiz `/` abre direto o login. As landings (normal e Orbi) ficam só no mockup.

## Rodar pela primeira vez

```bash
npm i                      # também roda prisma generate
cp .env.example .env.local # preencha DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL
npx prisma migrate dev --name init   # cria as tabelas no Supabase
npm run db:seed            # cria o seu admin e mostra a senha temporária no terminal
npm run dev                # http://localhost:3000 → entre com a senha temporária
```

Depois de entrar, vá em **Admin › Pessoas › Criar acesso** para cada pessoa do
time. A senha aparece uma vez só, com uma mensagem pronta para mandar.

## Pastas

```
src/
  app/            rotas (entrar, primeiro-acesso, app, admin, api)
  _components/    ui, auth, app, admin, site
  _styles/        CSS Modules agrupados por área (ui, auth, app, admin, site)
  _data/          leitura (*.ts) e Server Actions (*.actions.ts); TODA função confere acesso
  _lib/           auth (Better Auth + dal.ts), db (Prisma), server (limites, segurança, registros)
  _i18n/          textos em pt-BR
  lib/ types/     validação, formatos e tipos compartilhados
  generated/      Prisma Client (gerado, fora do git)
prisma/           schema.prisma, migrations, seed.ts
tests/            Vitest contra um banco de teste
```

## Segurança, em resumo

- **Sem RLS**: a barreira é o código. `src/_lib/auth/dal.ts` (`requireUser`,
  `requireReadyUser`, `requireMember`, `requireAdmin`) é chamado em toda página,
  leitura e Server Action. `tests/access.test.ts` prova o isolamento.
- **Sem rota HTTP do Better Auth**: não existe `/api/auth`; tudo roda por Server
  Actions. Cadastro desligado (`disableSignUp`).
- Senhas com scrypt; senha temporária de 16 caracteres, vence em 7 dias, nunca
  vai para URL, log ou banco em texto. Senha nova é checada no Have I Been Pwned.
- Limite de tentativas no banco (`rate_limits`): login, troca de senha, ações do admin.
- Desativar acesso derruba todas as sessões na hora (sem cache de sessão em cookie).
- CSP com nonce por requisição, HSTS, `frame-ancestors 'none'`.
- Registros de acesso (6 meses) e erros agrupados (30 dias) em Admin › Erros e acessos.
- LGPD desligada (`LGPD_ENABLED=false`); termos e 18+ continuam no primeiro acesso.

## Scripts

| | |
|---|---|
| `npm run dev` | servidor local |
| `npm test` | testes (precisa de `TEST_DATABASE_URL` num banco de teste, nunca o de produção) |
| `npm run typecheck` / `npm run lint` | conferências |
| `npm run db:migrate` | nova migration depois de mudar o schema |
| `npm run db:deploy` | aplica migrations (produção) |
| `npm run db:studio` | ver o banco |
