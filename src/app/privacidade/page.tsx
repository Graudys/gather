import type { Metadata } from "next";
import { LegalPage } from "@/_components/site/LegalPage";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function Page() {
  return (
    <LegalPage title="Política de privacidade" updated="24/11/2026">
      <p>Esta política explica, em poucas linhas, o que o Gather guarda sobre você nesta versão pessoal.</p>
      <h2>O que guardamos</h2>
      <ul>
        <li>Nome, e-mail e a sua senha em forma de hash (ninguém, nem o admin, consegue ver a senha).</li>
        <li>O que você cria: mensagens, tarefas, eventos e arquivos, dentro dos workspaces de que participa.</li>
        <li>Registros de acesso (data, IP e navegador resumido) por 6 meses, como pede o Marco Civil da Internet.</li>
        <li>Registros de erro do app por 30 dias, sem texto de mensagem, e-mail ou senha.</li>
      </ul>
      <h2>Por quanto tempo</h2>
      <p>Mensagens somem depois do prazo escolhido em cada workspace (de 1 a 12 meses). Arquivos do chat somem em 24 horas ou 7 dias. Arquivos salvos em tarefas ficam até alguém apagar.</p>
      <h2>Quem vê</h2>
      <p>Só as pessoas dos workspaces de que você participa. O admin cuida dos acessos e vê números gerais, registros de acesso e erros, mas não lê suas mensagens pelo painel.</p>
      <h2>Onde ficam</h2>
      <p>Banco de dados e arquivos no Supabase; o app roda na Vercel; reuniões por áudio passam pelo LiveKit e não são gravadas. Não vendemos nem compartilhamos dados para publicidade.</p>
      <h2>Seus pedidos</h2>
      <p>Para corrigir dados, pedir uma cópia ou excluir sua conta, fale com o admin pelo Gather.</p>
    </LegalPage>
  );
}
