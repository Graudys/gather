import { AuthCard, AuthNote } from "@/_components/auth/AuthCard";
import { t } from "@/_i18n";

export default function ContaBloqueada() {
  return (
    <AuthCard title={t.auth.bloqueada.titulo} subtitle={t.auth.bloqueada.sub}>
      <AuthNote>{t.auth.bloqueada.texto}</AuthNote>
    </AuthCard>
  );
}
