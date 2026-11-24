# Gather

Workspace para equipes pequenas: chat, tarefas, agenda e reuniões por áudio.
Next.js 16 (App Router) na Vercel, Supabase (Auth, Postgres com RLS, Storage, Realtime, pg_cron) e LiveKit Cloud.

O passo a passo para criar e ligar os serviços (Supabase, Google, Resend, LiveKit, Vercel, Turnstile) está no
guia de configuração do projeto. Este arquivo fala do código.

## Rodar no computador

```bash
npm install
cp .env.example .env.local        # preencha com as chaves do projeto Supabase de TESTE
npx supabase start                 # opcional: Supabase local (precisa de Docker)
npm run dev                        # http://localhost:3000
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | App em modo desenvolvimento |
| `npm run build` | Build de produção (o mesmo que a Vercel roda) |
| `npm run lint` / `npm run typecheck` | ESLint e TypeScript |
| `npm run db:validate` | Confere o `prisma/schema.prisma` |
| `npm run db:sql` | Gera de novo a migração de tabelas a partir do schema |
| `npm run db:test` | Aplica todas as migrações num Postgres limpo e roda o teste de isolamento |
| `npx supabase db push` | Envia as migrações para o projeto ligado (`supabase link`) |
| `npm run db:types` | Gera os tipos TypeScript do banco |

## Onde está cada coisa

```
prisma/schema.prisma            desenho do banco (48 tabelas). O app NÃO usa Prisma Client.
supabase/migrations/
  …0100_tabelas.sql             gerado do schema (não editar à mão)
  …0200_seguranca.sql           RLS em todas as tabelas, permissões por coluna, gatilhos
  …0300_funcoes.sql             cadastro, criar workspace, convite, rate limit, logs, reuniões
  …0400_storage_rotinas.sql     buckets, tempo real, limpeza de mensagens/logs/chamados, pg_cron
  …0500_rotinas_app.sql         consultas das rotinas que mexem no Storage e no LiveKit
supabase/tests/                 teste de isolamento entre workspaces (34 verificações)
supabase/templates/             e-mails de confirmação e de nova senha (com token_hash)
src/proxy.ts                    renova a sessão, CSP com nonce, redireciona quem não entrou
src/lib/auth/dal.ts             requireUser / requireMember / requirePlatformAdmin (MFA)
src/lib/supabase/               clientes: server (sessão), browser (sessão), admin (chave secreta)
src/lib/server/                 env, rate limit, senha vazada, captcha, logs, e-mail, LiveKit
src/app/(auth)/                 entrar, cadastro (18+), esqueci/redefinir senha, boas-vindas (Google)
src/app/app/                    workspaces e chat (exemplo de leitura e escrita pelo RLS)
src/app/admin/                  admin da plataforma: MFA obrigatório, visão geral, erros
src/app/api/                    /erro (erros do navegador), /livekit/token, /livekit/webhook, /cron/[job]
src/instrumentation.ts          erros do servidor vão para error_events
.github/workflows/              CI (lint, tipos, build, teste do banco) e backup semanal criptografado
```

## Regras de segurança que o código segue

1. **O banco é a última barreira.** Toda tabela tem RLS; o navegador usa só a chave publicável.
   `npm run db:test` falha se alguma tabela ficar sem RLS ou se uma pessoa enxergar outro workspace.
2. **Chave secreta só no servidor** (`src/lib/supabase/admin.ts`, com `server-only`). Ela ignora o RLS,
   então só é usada depois de `requireMember` / `requirePlatformAdmin`.
3. **Admin da plataforma exige MFA**: a tabela `platform_admins` e a função `private.is_platform_admin()`
   só valem com `aal2`. Não existe tela para virar admin: é um `insert` manual no banco.
4. **Toda entrada passa por Zod** (Server Actions e rotas). Texto do usuário é renderizado pelo React, nunca como HTML.
5. **Arquivos**: buckets privados; upload e download só com URL assinada criada no servidor.
6. **Reuniões**: token do LiveKit de uma sala só, só microfone, curto; webhook com assinatura conferida.
7. **Logs**: acesso (6 meses) e erros (30 dias, agrupados, sem dados pessoais) no próprio Supabase.
8. **Rotinas** (`/api/cron/*`) só respondem com `Authorization: Bearer CRON_SECRET`.

## O que ainda falta construir

Esta é a base: autenticação, permissões, banco, logs e reuniões no servidor. As telas de tarefas, agenda,
sala de reunião (com `livekit-client`), suporte, central de ajuda/Orbi, convites e o restante do admin
seguem os mockups e usam as mesmas peças (`requireMember`, cliente com sessão, RLS).
