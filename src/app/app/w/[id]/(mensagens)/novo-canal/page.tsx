import { Icon } from "@/_components/ui/Icon";
import { CHAT_ICONS } from "@/lib/chat-icons";
import c from "@/_styles/chat/Chat.module.css";
import Link from "next/link";
import type { Metadata } from "next";
import { createChannel } from "@/_data/chat.actions";
import { getWorkspaceShell } from "@/_data/chat";
import { Field } from "@/_components/ui/Field";
import { Button } from "@/_components/ui/Button";
import { Alert } from "@/_components/ui/Alert";
import p from "@/_styles/chat/Panel.module.css";

export const metadata: Metadata = { title: "Novo canal" };

const ERROS: Record<string, string> = {
  nome: "Use letras ou números no nome.",
  existe: "Já existe um canal com esse nome.",
};

export default async function NovoCanal({ params, searchParams }: PageProps<"/app/w/[id]/novo-canal">) {
  const { id } = await params;
  const { erro } = (await searchParams) as { erro?: string };
  const shell = await getWorkspaceShell(id);
  const personal = shell.workspace.kind === "PERSONAL";
  return (
    <div className={p.page}>
      <div className={p.narrow}>
        <h1 className={p.title}>Novo canal</h1>
      </div>
      <form action={createChannel} className={`${p.card} ${p.narrow}`}>
        <input type="hidden" name="workspaceId" value={id} />
        {erro && <Alert>{ERROS[erro] ?? "Confira os dados."}</Alert>}
        <Field label="Nome" name="name" required maxLength={60} placeholder="ex.: produto" autoFocus autoComplete="off" />
        <p className={p.note}>Fica em minúsculas, sem espaços nem acentos: “Lançamento v1” vira #lancamento-v1.</p>
        <label className={p.label}>
          Descrição (opcional)
          <textarea name="description" maxLength={200} className={p.textarea} placeholder="Sobre o que se fala aqui" />
        </label>
        <fieldset className={c.iconField}>
          <legend className={p.label}>Ícone (opcional)</legend>
          <div className={c.iconRadios}>
            <label title="Sem ícone (#)"><input type="radio" name="icon" value="" defaultChecked /><span><Icon name="hash" size={16} /></span></label>
            {CHAT_ICONS.map((e) => (
              <label key={e}><input type="radio" name="icon" value={e} /><span>{e}</span></label>
            ))}
          </div>
        </fieldset>
        {personal ? (
          <>
            <input type="hidden" name="visibility" value="PRIVATE" />
            <p className={p.note}>No espaço pessoal, todo canal é só seu.</p>
          </>
        ) : (
          <div className={p.options} role="radiogroup" aria-label="Quem vê">
            <label className={p.option}>
              <input type="radio" name="visibility" value="PUBLIC" defaultChecked />
              <span><div className={p.optTitle}><Icon name="hash" size={13} /> Público</div><div className={p.optText}>Qualquer pessoa do workspace entra</div></span>
            </label>
            <label className={p.option}>
              <input type="radio" name="visibility" value="PRIVATE" />
              <span><div className={p.optTitle}><Icon name="lock" size={13} /> Privado</div><div className={p.optText}>Só quem for adicionado</div></span>
            </label>
          </div>
        )}
        <div className={p.actions}>
          <Link href={`/app/w/${id}`}><Button type="button" variant="ghost">Cancelar</Button></Link>
          <Button>Criar canal</Button>
        </div>
      </form>
    </div>
  );
}
