"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function MfaForm() {
  const supabase = createClient();
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (totp) return setFactorId(totp.id);
      // Primeira vez: cadastra o app autenticador.
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `admin-${Date.now()}` });
      if (error || !enrolled) return setMsg("Não foi possível iniciar o cadastro do segundo fator.");
      setFactorId(enrolled.id);
      setQr(enrolled.totp.qr_code);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) return setMsg("Código inválido. Confira o horário do celular e tente de novo.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4">
      {qr && (
        <>
          <p className="text-sm text-neutral-300">Escaneie com o Google Authenticator, 1Password ou similar:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code do segundo fator" className="mx-auto size-48 rounded-lg bg-white p-2" />
        </>
      )}
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-neutral-300">Código de 6 dígitos</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 tracking-[.3em] outline-none focus:border-[#5b8cff]" />
      </label>
      {msg && <p role="alert" className="text-sm text-red-300">{msg}</p>}
      <button className="rounded-lg bg-gradient-to-br from-[#3d63e0] to-[#7c5cf0] px-4 py-2.5 font-medium">Confirmar</button>
    </form>
  );
}
