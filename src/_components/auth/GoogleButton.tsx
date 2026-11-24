import { Button } from "@/_components/ui/Button";
import { signInWithGoogle } from "@/_data/auth.actions";
import { t } from "@/_i18n";

export function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next ?? ""} />
      <Button variant="ghost" block>{t.auth.google}</Button>
    </form>
  );
}
