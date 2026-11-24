"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/_lib/supabase/browser";
import { Button } from "@/_components/ui/Button";
import { Field } from "@/_components/ui/Field";
import { t } from "@/_i18n";
import s from "@/_styles/admin/Mfa.module.css";

export function MfaForm() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (totp) return setFactorId(totp.id);
      // Primeira vez: cadastra o app autenticador.
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `admin-${Date.now()}` });
      if (error || !enrolled) return setMsg(t.admin.mfa.falhaCadastro);
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) return setMsg(t.admin.mfa.invalido);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={verify} className={s.form}>
      {qr && (
        <>
          <p className={s.text}>{t.admin.mfa.escaneie}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR vem como data URL do Supabase */}
          <img src={qr} alt="QR code do segundo fator" className={s.qr} />
        </>
      )}
      <Field label={t.admin.mfa.codigo} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
        autoComplete="one-time-code" pattern="[0-9]{6}" required className={s.code} />
      {msg && <p role="alert" className={s.error}>{msg}</p>}
      <Button>{t.admin.mfa.confirmar}</Button>
    </form>
  );
}
