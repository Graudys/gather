import { Button } from "@/_components/ui/Button";
import { Field } from "@/_components/ui/Field";
import { createWorkspace } from "@/_data/workspaces.actions";
import { LIMITES } from "@/lib/validation";
import { t } from "@/_i18n";
import s from "@/_styles/app/Workspaces.module.css";

export function CreateWorkspaceForm() {
  return (
    <form action={createWorkspace} className={s.create}>
      <Field label={t.app.workspaces.novo} name="name" required maxLength={LIMITES.workspace} placeholder={t.app.workspaces.novoPlaceholder} />
      <Button>{t.app.workspaces.criar}</Button>
      <p className={s.hint}>{t.app.workspaces.limite}</p>
    </form>
  );
}
