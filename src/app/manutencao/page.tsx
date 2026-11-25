import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/_lib/db/prisma";
import { StatePage } from "@/_components/site/StatePage";
import s from "@/_styles/site/Site.module.css";

export const metadata: Metadata = { title: "Em manutenção" };

export default async function Manutencao() {
  const cfg = await db.platformConfig.findUnique({ where: { id: 1 }, select: { maintenanceMode: true, maintenanceMessage: true } });
  return (
    <StatePage mood="procurando" title="O Gather está em manutenção" text={cfg?.maintenanceMessage || "Voltamos em instantes. Nada do que você fez foi perdido."}>
      <Link href="/app" className={s.stateBtn}>{cfg?.maintenanceMode ? "Tentar de novo" : "Voltar ao app"}</Link>
    </StatePage>
  );
}
