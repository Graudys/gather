// Artigos iniciais da central de ajuda (versão pessoal do Gather).
// Usados pelo seed e pelo botão "Carregar artigos iniciais" em Admin › Ajuda.
// Sem "server-only": o seed (fora do Next) também importa.

export const STARTER_CATEGORIES = [
  { slug: "primeiros-passos", name: "Primeiros passos", icon: "spark", position: 0 },
  { slug: "chat", name: "Chat", icon: "chat", position: 1 },
  { slug: "projetos", name: "Projetos e tarefas", icon: "board", position: 2 },
  { slug: "agenda", name: "Agenda e reuniões", icon: "calendar", position: 3 },
  { slug: "conta", name: "Conta e acesso", icon: "user", position: 4 },
] as const;

type Starter = { category: (typeof STARTER_CATEGORIES)[number]["slug"]; slug: string; title: string; summary: string; keywords: string[]; actionLabel?: string; actionPath?: string; body: string };

export const STARTER_ARTICLES: Starter[] = [
  {
    category: "primeiros-passos", slug: "primeiro-acesso", title: "Como entrar pela primeira vez",
    summary: "Use o e-mail e a senha temporária que o admin te mandou. No primeiro login você cria a sua senha e confirma 18+ e os termos.",
    keywords: ["primeiro acesso", "senha temporária", "entrar", "login", "cadastro", "criar conta"],
    body: `# Como entrar pela primeira vez

O Gather é fechado: **não existe cadastro**. Quem cria os acessos é o admin.

1. Abra o endereço que o admin te mandou.
2. Entre com o seu e-mail e a **senha temporária**.
3. Crie a sua senha (pelo menos 10 caracteres, diferente da temporária).
4. Confirme que tem 18 anos ou mais e aceite os termos.

A senha temporária vence em 7 dias. Se venceu, peça uma nova ao admin.`,
  },
  {
    category: "conta", slug: "esqueci-a-senha", title: "Esqueci minha senha",
    summary: "Como o Gather não manda e-mail, peça ao admin uma senha temporária nova. Ele nunca vê a sua senha.",
    keywords: ["esqueci", "esqueci a senha", "recuperar senha", "redefinir", "não consigo entrar", "bloqueado"],
    body: `# Esqueci minha senha

O Gather não manda e-mail, então quem resolve é o admin:

- Peça uma **senha temporária nova** (por mensagem, WhatsApp, onde preferir).
- Entre com ela e crie a sua senha de novo.

Por segurança, o admin **nunca vê** a sua senha. Ele só gera outra temporária, e quem estava logado com a antiga sai.`,
  },
  {
    category: "conta", slug: "trocar-senha", title: "Trocar minha senha",
    summary: "Clique no seu nome no topo, vá em Perfil e use Trocar senha. Os outros aparelhos saem da conta.",
    keywords: ["trocar senha", "mudar senha", "alterar senha", "perfil", "sair de todos"],
    actionLabel: "Abrir perfil", actionPath: "/app/perfil",
    body: `# Trocar minha senha

1. Clique no **seu nome**, no topo da tela.
2. Em **Trocar senha**, digite a atual e a nova duas vezes.

Ao trocar, os outros aparelhos saem da conta. No mesmo lugar tem **Sair de todos os aparelhos**.`,
  },
  {
    category: "chat", slug: "criar-canal", title: "Criar um canal",
    summary: "No workspace, clique no + ao lado de Canais. Canal público todo mundo vê; privado só quem for adicionado.",
    keywords: ["canal", "criar canal", "novo canal", "canal privado", "canal público"],
    body: `# Criar um canal

1. Abra o workspace.
2. Na barra lateral, clique no **+** ao lado de **Canais**.
3. Dê um nome e escolha **Público** (todo o workspace entra) ou **Privado** (só quem for adicionado).

Em um canal privado, abra o ícone de pessoas no topo para **adicionar alguém**.`,
  },
  {
    category: "chat", slug: "mensagens-somem", title: "Por que as mensagens somem?",
    summary: "Cada workspace tem um prazo: as mensagens somem depois de 1 a 12 meses e os arquivos do chat em 24 horas ou 7 dias.",
    keywords: ["mensagens somem", "sumiu", "apagou", "retenção", "prazo", "histórico", "arquivo expirado"],
    body: `# Por que as mensagens somem?

Cada workspace escolhe um **prazo** em Configurações:

- **Mensagens**: somem depois de 1, 2, 3, 6 ou 12 meses.
- **Arquivos do chat**: somem em 24 horas ou 7 dias.

Toda noite, o que passou do prazo é apagado. Tarefas, projetos, agenda e notas de reunião **não expiram**.`,
  },
  {
    category: "chat", slug: "conversa-direta", title: "Mandar mensagem direta ou em grupo",
    summary: "Clique no + ao lado de Conversas diretas e escolha uma pessoa (direta) ou várias (grupo de até 8).",
    keywords: ["mensagem direta", "conversa direta", "dm", "privado", "grupo", "falar com"],
    body: `# Mandar mensagem direta ou em grupo

1. Na barra lateral, clique no **+** ao lado de **Conversas diretas**.
2. Escolha uma pessoa para conversa direta, ou várias para um grupo.

Se a conversa com essas pessoas já existe, o Gather abre a mesma.`,
  },
  {
    category: "projetos", slug: "quadro-de-tarefas", title: "Criar projeto e usar o quadro",
    summary: "Em Projetos, clique em Novo projeto. No quadro, crie tarefas no fim de cada coluna e arraste os cartões entre colunas.",
    keywords: ["projeto", "quadro", "tarefa", "kanban", "coluna", "arrastar", "criar tarefa"],
    body: `# Criar projeto e usar o quadro

1. Vá em **Projetos › Novo projeto**.
2. Escolha nome, prazo, membros e as colunas do quadro.

No quadro:

- Escreva no campo **+ Adicionar tarefa** de uma coluna e aperte Enter.
- **Arraste** os cartões entre colunas. A última coluna conta como concluída.
- Clique num cartão para abrir os detalhes: responsáveis, prazo, etiquetas e comentários.`,
  },
  {
    category: "agenda", slug: "marcar-reuniao", title: "Marcar uma reunião",
    summary: "No Calendário, crie um evento e deixe marcado “Criar sala de reunião”. Na hora, abra o evento e clique em Entrar.",
    keywords: ["reunião", "marcar reunião", "agendar", "chamada", "call", "áudio", "evento"],
    body: `# Marcar uma reunião

1. Abra **Calendário › Novo evento**.
2. Escolha dia, horário e participantes.
3. Deixe marcado **Criar sala de reunião por áudio**.

Na hora, abra o evento e clique em **Entrar na reunião**. Para algo rápido, use **Reuniões › Iniciar reunião agora**.

As reuniões são só por áudio e **não são gravadas**.`,
  },
  {
    category: "agenda", slug: "minutos-de-reuniao", title: "Como funcionam os minutos de reunião",
    summary: "Cada workspace tem um saldo de minutos por mês. Cada pessoa conta: 4 pessoas por 30 minutos usam 120 minutos.",
    keywords: ["minutos", "saldo", "cota", "limite", "acabou", "reunião bloqueada", "tempo de reunião"],
    body: `# Como funcionam os minutos de reunião

- Cada workspace tem um **saldo de minutos por mês**, que renova no dia 1.
- **Cada pessoa conta**: 4 pessoas por 30 minutos usam 120 minutos.
- Cada reunião tem limite de pessoas e de tempo (60 minutos, por padrão).

Se o saldo acabar, novas reuniões ficam bloqueadas até a renovação. O resto do Gather continua normal.`,
  },
  {
    category: "conta", slug: "adicionar-pessoa", title: "Adicionar alguém ao workspace",
    summary: "Dono ou admin do workspace vai em Configurações e adiciona pelo e-mail. A pessoa precisa já ter acesso ao Gather.",
    keywords: ["adicionar pessoa", "convidar", "convite", "membro", "chamar pessoa", "entrar no workspace"],
    body: `# Adicionar alguém ao workspace

1. Abra o workspace e vá em **Configurações**.
2. Em **Membros**, digite o e-mail e clique em **Adicionar**.

A pessoa precisa **já ter acesso ao Gather**. Se não tiver, peça ao admin do Gather para criar o acesso primeiro (em Admin › Pessoas).`,
  },
];
