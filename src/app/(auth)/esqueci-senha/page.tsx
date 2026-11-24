import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard, AuthLinks, AuthNote } from "@/_components/auth/AuthCard";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: "Esqueci a senha" };

// Sem e-mail na versão pessoal: só explica como pedir uma senha nova ao admin.
export default function EsqueciSenha() {
  return (
    <AuthCard title={t.auth.esqueci.titulo} subtitle={t.auth.esqueci.sub}>
      <AuthNote>{t.auth.esqueci.nota}</AuthNote>
      <AuthLinks>
        <Link href="/entrar">{t.auth.esqueci.voltar}</Link>
      </AuthLinks>
    </AuthCard>
  );
}
