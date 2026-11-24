import Link from "next/link";
import { Check } from "@/_components/ui/Field";
import { t } from "@/_i18n";
import s from "@/_styles/auth/Auth.module.css";

/** As duas caixas obrigatórias: 18+ e aceite dos documentos. */
export function TermsCheck() {
  return (
    <>
      <Check name="age">{t.auth.cadastro.idade}</Check>
      <Check name="terms">
        {t.auth.cadastro.aceito} <Link className={s.inlineLink} href="/termos">{t.comum.termos}</Link> e a{" "}
        <Link className={s.inlineLink} href="/privacidade">{t.comum.privacidade}</Link>.
      </Check>
    </>
  );
}
