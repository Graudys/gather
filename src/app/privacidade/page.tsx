import type { Metadata } from "next";
import { LegalPage } from "@/_components/site/LegalPage";
import { t } from "@/_i18n";

export const metadata: Metadata = { title: "Política de privacidade" };

// TODO: texto final revisado (ver a especificação, seção Privacidade e LGPD).
export default function Page() {
  return (
    <LegalPage title="Política de privacidade">
      <p>{t.comum.emBreve}</p>
    </LegalPage>
  );
}
