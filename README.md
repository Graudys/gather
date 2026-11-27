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

## O que já funciona

- Login fechado, primeiro acesso, Admin › Pessoas, Erros e acessos
- **Chat**: canais públicos e privados, conversas diretas e em grupo, threads,
  reações, editar e apagar, não lidas, atualização automática a cada 4 s
- **Projetos e tarefas**: equipes (públicas ou privadas), projetos com colunas
  próprias, quadro com arrastar e soltar, lista, painel da tarefa (status, prioridade,
  prazo, responsáveis, etiquetas, comentários, atividade) e Minhas tarefas
- **Calendário**: semana e mês, eventos do workspace ou só para convidados,
  respostas (vou/talvez/não vou), prazos das suas tarefas, sala de reunião no evento
- **Reuniões por áudio (LiveKit)**: iniciar agora, teste do microfone antes de entrar,
  limite de pessoas e de tempo, minutos por mês, notas, decisões e tarefas criadas
  na reunião, resumo depois que acaba. Nada é gravado.
- **Notificações** (sino): mensagens diretas, threads, tarefas, comentários,
  convites, lembretes de evento e quando te adicionam num workspace
- **Busca** no workspace: mensagens, tarefas, projetos, eventos e pessoas
  (só o que você pode ver)
- **Central de ajuda e Orbi**: artigos em markdown, Orbi responde pelos artigos,
  "Mandar para o admin"; Admin › Central de ajuda com editor e 10 artigos iniciais
- **Admin do Gather**: visão geral (pessoas ativas, mensagens, reuniões, uso do
  banco e do LiveKit, rotinas), workspaces (reuniões, minutos, prazos, adicionar,
  papéis, transferir dono, suspender), configurações (recursos, manutenção,
  prazos permitidos, limites e teto do LiveKit), registro de ações com CSV e
  registros de acesso só com motivo (IP cortado). Toda ação pede motivo.
- **Configurações do workspace**: adicionar pessoas (que já têm acesso ao Gather),
  papéis, prazos de mensagens e arquivos, apagar workspace
- **Limpeza diária** (`/api/cron/diario`, Vercel Cron às 03:00): mensagens fora do
  prazo, registros velhos, sessões vencidas. Precisa de `CRON_SECRET` na Vercel.

## LiveKit (reuniões)

1. `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` no `.env.local` e na Vercel.
2. Depois do deploy, em LiveKit Cloud › Settings › Webhooks, adicione
   `https://SEU-APP.vercel.app/api/livekit/webhook` (deixa a contagem de minutos
   certa mesmo se alguém fechar o navegador).

## Notas, prazos e ícones

- **Notas** (só no espaço pessoal): cadernos como canais de anotação; "Minha vida" é fixo.
  Prazo de 1, 2, 3 ou 5 anos desde a última edição. 30 dias antes chega o aviso; nada é
  apagado sem a pessoa digitar APAGAR. Baixar em Markdown: `/api/notas/exportar`.
- **Prazos de tarefas**: cartões mostram "Atrasada" e "Vence hoje/amanhã"; avisos no sino e no aparelho
  (rotina diária e quando a pessoa abre o app).
- **Ícones** de canais e grupos: lista fechada de emojis em `src/lib/chat-icons.ts`.
- Depois de atualizar: `npx prisma migrate dev --name melhorias`.

## Lembretes na hora certa (pg_cron do Supabase)

A Vercel grátis só roda rotina uma vez por dia. Para lembrete de evento sair no minuto certo,
o Supabase chama `/api/cron/minuto` a cada minuto (com o mesmo `CRON_SECRET`).

1. Supabase › Database › Extensions: ligue `pg_cron` e `pg_net`.
2. Supabase › Vault (Integrations › Vault): **Add new secret**, nome `gather_cron_secret`,
   valor = o mesmo `CRON_SECRET` da Vercel. (Pela tela, não pelo SQL: assim o segredo não fica no histórico.)
3. SQL Editor (troque a URL pelo endereço do seu app):

```sql
select cron.schedule('gather-lembretes', '* * * * *', $$
  select net.http_get(
    url := 'https://SEU-APP.vercel.app/api/cron/minuto',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'gather_cron_secret'))
  );
$$);
```

Para conferir: `select * from cron.job_run_details order by start_time desc limit 5;`
Para parar: `select cron.unschedule('gather-lembretes');`

## App instalável e notificações (PWA)

1. `npx prisma migrate dev --name push` (cria a tabela `push_subscriptions`).
2. `npx web-push generate-vapid-keys` e coloque no `.env.local` e na Vercel:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (só servidor) e `VAPID_SUBJECT`.
3. Perfil › Neste aparelho: instalar o app e ligar as notificações.

- O service worker (`public/sw.js`) só guarda a página `/offline`, ícones e estáticos do Next. Nada de páginas do app, API ou arquivos.
- A notificação mostra só o tipo do aviso ("nova mensagem direta"), nunca o texto, e só abre links `/app`.
- A inscrição fica presa à sessão: sair, sair de todos, trocar a senha ou suspender a conta desliga o aparelho na hora.
- O servidor só envia para serviços de push conhecidos (Google, Apple, Mozilla, Microsoft).
- No iPhone, notificação só com o app instalado na tela de início (iOS 16.4+).
- Em `npm run dev` o PWA fica desligado; para testar, `NEXT_PUBLIC_PWA_DEV=1`.

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
