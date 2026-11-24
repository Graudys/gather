import { redirect } from "next/navigation";

// Sem landing no app: a raiz abre direto o login.
// (As landings continuam só no mockup do canvas.)
export default function Home() {
  redirect("/entrar");
}
