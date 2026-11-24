import Link from "next/link";
import { StatePage } from "@/_components/site/StatePage";
import { t } from "@/_i18n";

export default function NotFound() {
  return (
    <StatePage title={t.site.naoEncontradoTitulo} text={t.site.naoEncontradoTexto}>
      <Link href="/app">{t.site.voltarInicio}</Link>
    </StatePage>
  );
}
