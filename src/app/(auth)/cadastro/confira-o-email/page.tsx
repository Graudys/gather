import { AuthCard } from "@/components/ui";

export default function ConfiraEmail() {
  return (
    <AuthCard title="Confira seu e-mail" subtitle="Se o endereço puder ser usado, enviamos um link de confirmação. Ele vale por 1 hora." >
      <p className="text-sm text-neutral-400">Não chegou? Veja o spam ou tente de novo em alguns minutos.</p>
    </AuthCard>
  );
}
