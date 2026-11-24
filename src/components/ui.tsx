import type { ReactNode } from "react";

// Peças simples de interface, no visual escuro dos mockups.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[.03] p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
        <div className="mt-6 flex flex-col gap-4">{children}</div>
      </div>
    </main>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="90" y2="90">
            <stop offset="0" stopColor="#5b8cff" />
            <stop offset="1" stopColor="#b08cff" />
          </linearGradient>
        </defs>
        <path d="M79.5 44.8 A30 30 0 1 1 55.2 20.5" fill="none" stroke="url(#g)" strokeWidth="11" strokeLinecap="round" />
        <circle cx="72.6" cy="27.4" r="8.5" fill="url(#g)" />
      </svg>
      gather
    </span>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-neutral-300">{label}</span>
      <input {...props} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-[#5b8cff]" />
    </label>
  );
}

export function Check({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm text-neutral-300">
      <input type="checkbox" name={name} required className="mt-0.5 size-4 accent-[#5b8cff]" />
      <span>{children}</span>
    </label>
  );
}

export function Button({ children, variant = "primary", ...props }: { variant?: "primary" | "ghost" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const style = variant === "primary"
    ? "bg-gradient-to-br from-[#3d63e0] to-[#7c5cf0] text-white"
    : "border border-white/15 bg-transparent text-neutral-100";
  return <button {...props} className={`rounded-lg px-4 py-2.5 font-medium ${style} ${props.className ?? ""}`}>{children}</button>;
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "ok" }) {
  const c = tone === "error" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return <p role="alert" className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{children}</p>;
}
