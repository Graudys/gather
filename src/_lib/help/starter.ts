// Artigos iniciais da central de ajuda (versão pessoal do Gather).
// Usados pelo seed e pelo botão "Carregar artigos iniciais" em Admin › Ajuda.
// Sem "server-only": o seed (fora do Next) também importa.

export const STARTER_CATEGORIES = [
  { slug: "primeiros-passos", name: "Primeiros passos", icon: "spark", position: 0 },
  { slug: "chat", name: "Chat", icon: "chat", position: 1 },
  { slug: "projetos", name: "Projetos e tarefas", icon: "board", position: 2 },
  { slug: "agenda", name: "Agenda e reuniões", icon: "calendar", position: 3 },
  { slug: "conta", name: "Conta e acesso", icon: "user", position: 4 },
  { slug: "notas", name: "Notas e espaço pessoal", icon: "notebook", position: 5 },
  { slug: "app", name: "App e notificações", icon: "bell", position: 6 },
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
  // —— Novidades da v1 ——
  {
    category: "app", slug: "instalar-app", title: "Instalar o Gather como app",
    summary: "Em Perfil › Aparelhos, clique em Instalar. O Gather abre em janela própria e recebe avisos mesmo fechado.",
    keywords: ["instalar", "app", "aplicativo", "baixar app", "pwa", "tela inicial", "celular", "desinstalar"],
    actionLabel: "Abrir perfil", actionPath: "/app/perfil",
    body: `# Instalar o Gather como app

1. Clique no **seu nome** e abra **Perfil**.
2. Em **Neste aparelho**, clique em **Instalar**.

- **Chrome ou Edge**: também dá pelo ícone de instalar na barra de endereço.
- **iPhone (Safari)**: toque em Compartilhar › **Adicionar à Tela de Início**.

O app abre em janela própria e funciona mesmo sem internet para ver o que já foi aberto.

**Desinstalar**: no Windows, clique com o botão direito no ícone do Gather no menu Iniciar › Desinstalar. No Chrome, abra o app, menu ⋮ › Desinstalar.`,
  },
  {
    category: "app", slug: "notificacoes-no-aparelho", title: "Receber notificações no aparelho",
    summary: "Em Perfil › Neste aparelho, clique em Ligar e aceite o pedido do navegador. Os avisos chegam mesmo com o Gather fechado.",
    keywords: ["notificação", "push", "aviso", "ligar notificações", "notificação windows", "não chega notificação", "desligar"],
    actionLabel: "Abrir perfil", actionPath: "/app/perfil",
    body: `# Receber notificações no aparelho

1. Abra **Perfil** e vá em **Neste aparelho**.
2. Em **Notificações no aparelho**, clique em **Ligar** e aceite o pedido do navegador.

Cada aparelho liga separado. Para parar, clique em **Desligar**.

Não chegou nada? Confira se o navegador ou o Windows não bloqueou as notificações do site.`,
  },
  {
    category: "app", slug: "sino-de-notificacoes", title: "O sino de notificações",
    summary: "O sino mostra menções, tarefas, prazos e reuniões. Clique num aviso para abrir; use Limpar lidas para esvaziar a lista.",
    keywords: ["sino", "notificações", "avisos", "limpar lidas", "marcar como lida", "não lida"],
    actionLabel: "Abrir notificações", actionPath: "/app/notificacoes",
    body: `# O sino de notificações

Clique no **sino** para ver os avisos: @menções, mensagens de canal, tarefas, prazos e reuniões.

- Clicar num aviso abre o lugar dele e marca como lido.
- **Limpar lidas** tira da lista o que você já viu.

Para escolher o que chega, veja "Escolher quais avisos recebo".`,
  },
  {
    category: "app", slug: "escolher-avisos", title: "Escolher quais avisos recebo",
    summary: "Em Perfil › Notificações, marque o que quer receber: menções, mensagens nos canais, tarefas e reuniões.",
    keywords: ["preferências", "escolher avisos", "parar notificação", "muita notificação", "silenciar", "canais"],
    actionLabel: "Abrir perfil", actionPath: "/app/perfil",
    body: `# Escolher quais avisos recebo

Em **Perfil › Notificações**, marque ou desmarque:

- **Menções e respostas**: mensagens diretas, @menções e respostas.
- **Mensagens nos canais**: um aviso por canal, juntando as mensagens.
- **Tarefas**: quando te colocam numa tarefa, comentam, ela muda de coluna, é concluída ou o prazo chega.
- **Reuniões e eventos**: convites, lembretes e quando a reunião começa.

Depois clique em **Salvar alterações**.`,
  },
  {
    category: "chat", slug: "mencionar-alguem", title: "Mencionar alguém com @",
    summary: "Digite @ na mensagem e escolha a pessoa na lista. Ela recebe um aviso no sino e no aparelho.",
    keywords: ["marcar alguém", "marcar pessoa na mensagem", "menção", "mencionar", "@", "arroba", "marcar pessoa", "chamar atenção"],
    body: `# Mencionar alguém com @

1. Na mensagem, digite **@**.
2. Comece o nome e escolha a pessoa na lista.

A pessoa recebe um aviso no sino e, se ligou, no aparelho. Só dá para mencionar quem pode ver o canal.`,
  },
  {
    category: "chat", slug: "editar-apagar-mensagem", title: "Editar ou apagar uma mensagem",
    summary: "Passe o mouse na sua mensagem e use o lápis para editar ou a lixeira para apagar.",
    keywords: ["editar mensagem", "apagar mensagem", "corrigir", "excluir mensagem", "errei"],
    body: `# Editar ou apagar uma mensagem

Passe o mouse sobre a **sua** mensagem. Na barrinha que aparece:

- **Lápis**: edita o texto. A mensagem fica marcada como editada.
- **Lixeira**: apaga. Se ela tinha uma nota enviada ou estava fixada, o cartão e o alfinete saem junto.`,
  },
  {
    category: "chat", slug: "fixar-mensagem", title: "Fixar mensagem no topo do canal",
    summary: "Passe o mouse na mensagem e clique no alfinete. Fixadas aparecem em “N fixadas” no topo e não somem pelo prazo.",
    keywords: ["fixar", "fixada", "alfinete", "pin", "destacar", "guardar mensagem", "não sumir", "documentação"],
    body: `# Fixar mensagem no topo do canal

1. Passe o mouse sobre a mensagem e clique no **alfinete**.
2. No topo do canal aparece **N fixadas**: clique para ver a lista.

- Mensagem fixada **não some pelo prazo** do workspace, nem as respostas dela.
- Até **30** fixadas por canal. Não dá para fixar resposta de thread nem mensagem direta.
- Quem fixa: dono ou admin do workspace e quem gerencia o canal.
- Para desafixar, clique no alfinete de novo ou use o botão na lista.

Dica: um canal só para documentação, com as notas enviadas fixadas, vira uma biblioteca da equipe.`,
  },
  {
    category: "chat", slug: "icone-do-canal", title: "Mudar o ícone e as configurações do canal",
    summary: "Passe o mouse no canal na barra lateral e clique nos três pontinhos (⋯). Ali você troca o emoji e abre as configurações.",
    keywords: ["mudar ícone", "trocar ícone", "ícone", "ícone do canal", "emoji", "três pontinhos", "configurações do canal", "cadeado", "canal privado", "bolinha"],
    body: `# Mudar o ícone e as configurações do canal

1. Passe o mouse sobre o canal na barra lateral.
2. Clique nos **três pontinhos (⋯)**.
3. Escolha um **emoji** ou abra as **configurações do canal**.

Na lista, **#** é canal público e o **cadeado** é privado. Grupos também podem ter emoji.`,
  },
  {
    category: "chat", slug: "ordem-dos-canais", title: "Mudar a ordem dos canais",
    summary: "Dono ou admin arrasta o canal na barra lateral para cima ou para baixo. A ordem fica igual para todo mundo.",
    keywords: ["ordem dos canais", "arrastar canal", "reorganizar", "mover canal", "organizar canais"],
    body: `# Mudar a ordem dos canais

Dono ou admin do workspace **arrasta** o canal na barra lateral até o lugar que quiser. Pelo teclado: Alt + seta para cima ou para baixo.

A nova ordem vale **para todo mundo** do workspace.`,
  },
  {
    category: "projetos", slug: "minhas-tarefas", title: "Minhas tarefas, prazos e atrasadas",
    summary: "Em Tarefas você vê tudo que está com você em todos os projetos, em lista ou quadro: Atrasadas, Hoje, Esta semana, Depois e Sem prazo.",
    keywords: ["minhas tarefas", "atrasada", "vence hoje", "prazo", "vencida", "tarefas atrasadas", "quadro", "lista"],
    body: `# Minhas tarefas, prazos e atrasadas

Abra **Tarefas** na barra lateral. Aparece tudo que está atribuído a você e ainda não foi concluído.

- Veja em **Lista** ou **Quadro** (Atrasadas, Hoje, Esta semana, Depois, Sem prazo).
- Filtre por **projeto** e **prioridade**.
- Marque a caixinha para concluir.

Nos cartões, **Vence hoje** e **Atrasada** aparecem em destaque, e o Gather manda um aviso quando o prazo chega.`,
  },
  {
    category: "notas", slug: "minha-rotina", title: "O projeto Minha rotina",
    summary: "No seu espaço pessoal existe o projeto fixo Minha rotina, para tarefas suas do dia a dia. Ele não pode ser apagado.",
    keywords: ["minha rotina", "espaço pessoal", "projeto pessoal", "tarefas pessoais", "workspace pessoal"],
    body: `# O projeto Minha rotina

Todo espaço pessoal já vem com o projeto **Minha rotina**, para organizar o seu dia a dia com quadro, prazos e lembretes.

Ele é fixo: não pode ser arquivado nem apagado.`,
  },
  {
    category: "notas", slug: "notas-e-cadernos", title: "Notas e cadernos",
    summary: "No espaço pessoal, abra Notas. Organize em cadernos; o caderno Anotações é fixo. Clique em Nova nota para começar.",
    keywords: ["notas", "anotações", "caderno", "onenote", "nova nota", "criar caderno", "bloco de notas"],
    body: `# Notas e cadernos

As notas ficam no seu **espaço pessoal**, na aba **Notas**. Só você vê.

- **Criar caderno**: separe por assunto, com nome e ícone.
- **Anotações** é o caderno fixo: sempre existe e não pode ser apagado.
- **Nova nota** cria uma página no caderno aberto. Salva sozinha.`,
  },
  {
    category: "notas", slug: "editor-de-notas", title: "Formatar notas e colocar fotos",
    summary: "O editor usa Markdown: barra de formatação, atalhos como Ctrl+B e Ctrl+K, e modos Escrever, Lado a lado e Prévia. Cole ou arraste fotos.",
    keywords: ["colocar foto", "foto na nota", "imagem na nota", "markdown", "formatar", "negrito", "lista", "foto na nota", "imagem", "colar imagem", "prévia", "atalhos"],
    body: `# Formatar notas e colocar fotos

O editor usa **Markdown**:

- **Barra de formatação**: títulos, negrito, listas, código, links e mais.
- **Atalhos**: Ctrl+B negrito, Ctrl+I itálico, Ctrl+E código, Ctrl+K link.
- Listas continuam sozinhas ao apertar Enter.
- **Modos**: Escrever, Lado a lado (texto e prévia juntos) e Prévia.

**Fotos**: cole (Ctrl+V), arraste para a nota ou use o botão de foto. Ficam guardadas de forma privada.`,
  },
  {
    category: "notas", slug: "baixar-notas", title: "Baixar notas em .md",
    summary: "Na aba Notas, use Baixar (.md) para as notas ou para o caderno inteiro. O arquivo abre em qualquer editor de texto, Obsidian ou Notion.",
    keywords: ["exportar nota", "exportar notas", "baixar notas", "baixar minhas notas", "baixar", "exportar", "download nota", "md", "backup", "salvar no computador"],
    body: `# Baixar notas em .md

- As notas abertas: **Baixar estas notas (.md)**.
- Um caderno inteiro: **Baixar este caderno (.md)**.

O arquivo .md abre em qualquer editor de texto e pode ser importado no Obsidian ou no Notion.`,
  },
  {
    category: "notas", slug: "prazo-das-notas", title: "Por quanto tempo as notas ficam guardadas",
    summary: "Você escolhe de 1 a 5 anos. 30 dias antes de vencer o Gather avisa, e nada é apagado sem você digitar APAGAR.",
    keywords: ["notas vão sumir", "nota some", "sumir", "prazo das notas", "notas somem", "vencer", "vencida", "retenção notas", "apagar nota", "guardar mais"],
    body: `# Por quanto tempo as notas ficam guardadas

Em **Configurações › Retenção e privacidade** do espaço pessoal, escolha de **1 a 5 anos**.

- **30 dias antes** de uma nota vencer, chega um aviso.
- Em **Ver e decidir**, para cada nota: baixar em .md, manter por mais tempo ou apagar.
- O Gather **nunca apaga sozinho**. Para apagar é preciso digitar **APAGAR**.`,
  },
  {
    category: "notas", slug: "enviar-nota", title: "Enviar uma nota para alguém ou para um canal",
    summary: "Na nota, clique em Enviar e escolha a pessoa ou o canal. Vai um cartão só para leitura, sem criar cópia.",
    keywords: ["mando nota", "nota pro canal", "enviar nota", "compartilhar nota", "mandar nota", "documentação", "cartão", "nota no canal"],
    body: `# Enviar uma nota para alguém ou para um canal

1. Abra a nota e clique em **Enviar**.
2. Escolha **Enviar para a pessoa** ou **Enviar para o canal** e, se quiser, escreva uma mensagem.

Chega um **cartão** com a nota como estava naquela hora. Quem recebe **só lê**, não edita.

- Editar a nota depois **não muda** o cartão: para mandar a versão nova, envie de novo.
- Apagar a nota original **não apaga** o cartão.
- Apagar a mensagem tira o cartão.
- Dica: fixe o cartão no canal para ele não sumir pelo prazo.`,
  },
  {
    category: "conta", slug: "foto-e-icone", title: "Foto de perfil e ícone do workspace",
    summary: "Troque sua foto em Perfil e o ícone do workspace em Configurações › Geral (letra, emoji ou foto). Dá para recortar a foto antes de salvar.",
    keywords: ["foto", "foto de perfil", "avatar", "trocar foto", "ícone do workspace", "logo", "recortar"],
    actionLabel: "Abrir perfil", actionPath: "/app/perfil",
    body: `# Foto de perfil e ícone do workspace

**Sua foto**: em **Perfil**, clique na foto, escolha a imagem e ajuste o recorte.

**Ícone do workspace** (dono ou admin): em **Configurações › Geral**, escolha **letra**, **emoji** ou **foto**. A foto também tem recorte.

Aceita JPG, PNG e WebP.`,
  },
  {
    category: "agenda", slug: "lembrete-de-evento", title: "Lembretes de eventos e reuniões",
    summary: "O Gather avisa antes do evento começar e quando a reunião abre, no sino e no aparelho se as notificações estiverem ligadas.",
    keywords: ["lembrete", "aviso de evento", "reunião começou", "alarme", "esqueci reunião"],
    body: `# Lembretes de eventos e reuniões

- Na antecedência escolhida no evento (por exemplo, 15 min antes), chega um **lembrete** no sino.
- Quando a reunião começa, quem foi convidado recebe **Reunião começou** com o atalho para entrar.

Para receber mesmo com o Gather fechado, ligue as **notificações no aparelho** em Perfil.`,
  },
  {
    category: "projetos", slug: "desempenho-do-projeto", title: "Painel de desempenho do projeto",
    summary: "Dono e admin do workspace abrem a aba Desempenho no projeto: % concluído, entregas no prazo, atrasadas, ritmo e previsão de término.",
    keywords: ["desempenho", "dashboard", "painel", "relatório", "produtividade", "previsão", "ritmo", "métricas", "csv"],
    body: `# Painel de desempenho do projeto

Só **dono e admin do workspace** veem. No projeto, clique em **Desempenho** (ao lado de Quadro e Lista).

- **Números**: % concluído, entregues no prazo, atrasadas agora e tempo médio de cada tarefa.
- **Progresso x escopo**: o que foi concluído e o total de tarefas por semana, com a previsão até o prazo.
- **Criadas x concluídas**: se entra mais tarefa do que sai, o projeto não anda.
- **Por pessoa**, **onde estão as tarefas** e **precisa de atenção** (atrasadas e paradas há mais de 5 dias).

**Baixar CSV** gera uma planilha com uma linha por tarefa.`,
  },
];
