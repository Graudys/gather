import type { Metadata } from "next";
import { LegalPage } from "@/_components/site/LegalPage";

export const metadata: Metadata = { title: "Termos de uso" };

// Texto curto para a versão pessoal (projeto de teste, só convidados).
export default function Page() {
  return (
    <LegalPage title="Termos de uso" updated="24/11/2026">
      <p>O Gather é um projeto pessoal em teste, usado só por pessoas convidadas pelo admin. Ao entrar, você concorda com estes termos.</p>
      <h2>Quem pode usar</h2>
      <ul>
        <li>Só pessoas com 18 anos ou mais.</li>
        <li>Só quem recebeu um acesso do admin. O acesso é pessoal: não compartilhe sua senha.</li>
      </ul>
      <h2>Uso esperado</h2>
      <ul>
        <li>Não publique conteúdo ilegal, ofensivo ou dados pessoais de outras pessoas sem permissão.</li>
        <li>Não tente acessar workspaces, mensagens ou contas que não são suas.</li>
        <li>O admin pode desativar um acesso que descumpra estes termos.</li>
      </ul>
      <h2>Sem garantia</h2>
      <p>Por ser um projeto em teste, o Gather pode ficar fora do ar, mudar ou ter dados apagados. Mensagens e arquivos do chat somem sozinhos depois do prazo de cada workspace. Não use o Gather como único lugar para guardar algo importante.</p>
      <h2>Contato</h2>
      <p>Dúvidas ou pedidos: fale com o admin pelo próprio Gather.</p>
    </LegalPage>
  );
}
