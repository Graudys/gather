import { redirect } from "next/navigation";

// "Novo projeto" agora é uma janela na lista de projetos.
export default async function NovoProjeto({ params }: PageProps<"/app/w/[id]/projetos/novo">) {
  const { id } = await params;
  redirect(`/app/w/${id}/projetos?novo=1`);
}
