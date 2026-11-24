import { AuthCard, AuthNote } from "@/_components/auth/AuthCard";
import { t } from "@/_i18n";

export default function ConfiraEmail() {
  return (
    <AuthCard title={t.auth.confiraEmail.titulo} subtitle={t.auth.confiraEmail.sub}>
      <AuthNote>{t.auth.confiraEmail.nota}</AuthNote>
    </AuthCard>
  );
}
