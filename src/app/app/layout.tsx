import { requireReadyUser } from "@/_lib/auth/dal";
import { CloseDetailsOnOutside } from "@/_components/ui/CloseDetailsOnOutside";
import { OrbiWidget } from "@/_components/help/OrbiWidget";
import { LiveRefresh } from "@/_components/chat/LiveRefresh";

// Tudo em /app exige login e primeiro acesso feito. A casca (barra lateral e
// topo) fica nos layouts de baixo: /app/w/[id] e (conta).
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await requireReadyUser("/app");
  return (
    <>
      <CloseDetailsOnOutside />
      <OrbiWidget name={user.name} />
      <LiveRefresh />
      {children}
    </>
  );
}
