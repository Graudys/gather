import Link from "next/link";
import { Check } from "@/_components/ui/Field";
import { t } from "@/_i18n";
import s from "@/_styles/auth/Auth.module.css";

/** As duas caixas obrigatórias do primeiro acesso: 18+ e aceite dos documentos. */
export function TermsCheck() {
  return (
    <>
      <Check name="age">{t.auth.primeiro.idade}</Check>
      <Check name="terms">
        {t.auth.primeiro.aceito} <Link className={s.inlineLink} href="/termos" target="_blank">{t.comum.termos}</Link> {t.auth.primeiro.e}{" "}
        <Link className={s.inlineLink} href="/privacidade" target="_blank">{t.comum.privacidade}</Link>.
      </Check>
    </>
  );
}
