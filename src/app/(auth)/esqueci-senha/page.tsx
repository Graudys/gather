import type { Metadata } from "next";
import { AuthCard, Field, Button, Alert } from "@/components/ui";
import { Captcha } from "@/components/Captcha";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default async function EsqueciSenha({ searchParams }: PageProps<"/esqueci-senha">) {
  const { enviado } = (await searchParams) as { enviado?: string };
  return (
    <AuthCard title="Esqueci a senha" subtitle="Mandamos um link para criar uma nova.">
      {enviado ? (
        <Alert tone="ok">Se o e-mail tiver conta, o link chega em instantes. Ele vale por 1 hora.</Alert>
      ) : (
        <form action={requestPasswordReset} className="flex flex-col gap-4">
          <Field label="E-mail" name="email" type="email" autoComplete="email" required maxLength={254} />
          <Captcha />
          <Button>Enviar link</Button>
        </form>
      )}
    </AuthCard>
  );
}
