import Link from "next/link";
import { Logo } from "@/_components/ui/Logo";
import { t } from "@/_i18n";
import s from "@/_styles/site/Site.module.css";

export function Hero() {
  return (
    <main className={s.hero}>
      <Logo size={32} />
      <h1 className={s.title}>{t.site.titulo}</h1>
      <p className={s.lead}>{t.site.descricao}</p>
      <div className={s.actions}>
        <Link href="/cadastro" className={s.cta}>{t.site.comeceGratis}</Link>
        <Link href="/entrar" className={s.ctaGhost}>{t.site.entrar}</Link>
      </div>
      <p className={s.foot}>
        {t.site.rodape} · <Link href="/termos">{t.comum.termos}</Link> · <Link href="/privacidade">{t.comum.privacidade}</Link>
      </p>
    </main>
  );
}
