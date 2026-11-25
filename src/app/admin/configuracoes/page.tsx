import type { Metadata } from "next";
import { AdminTitle } from "@/_components/admin/AdminNav";
import { getConfigAdmin } from "@/_data/admin-config";
import { saveConfig } from "@/_data/admin-config.actions";
import { Alert } from "@/_components/ui/Alert";
import { Button } from "@/_components/ui/Button";
import s from "@/_styles/admin/AdminPages.module.css";

export const metadata: Metadata = { title: "Configurações" };

const MONTHS = [1, 2, 3, 6, 12];
const HOURS = [24, 168, 720];
const hourLabel = (h: number) => (h === 24 ? "24 horas" : `${h / 24} dias`);

function Toggle({ name, title, text, checked }: { name: string; title: string; text: string; checked: boolean }) {
  return (
    <label className={s.toggle}><input type="checkbox" name={name} defaultChecked={checked} /><span><div className={s.toggleTitle}>{title}</div><div className={s.muted}>{text}</div></span></label>
  );
}

function Num({ name, label, value, min, max, unit }: { name: string; label: string; value: number; min: number; max: number; unit: string }) {
  return (
    <label className={s.label}>{label}<span className={s.inline}><input name={name} type="number" min={min} max={max} defaultValue={value} required className={`${s.input} ${s.grow}`} /><span className={s.faint}>{unit}</span></span></label>
  );
}

export default async function Configuracoes({ searchParams }: PageProps<"/admin/configuracoes">) {
  const { ok, erro, ajustados } = (await searchParams) as { ok?: string; erro?: string; ajustados?: string };
  const { cfg, usage } = await getConfigAdmin();
  const using = (m?: number, h?: number) => usage.filter((u) => (m ? u.messageRetentionMonths === m : u.fileRetentionHours === h)).reduce((a, u) => a + u._count, 0);
  return (
    <>
      <AdminTitle title="Configurações" sub="Liga e desliga partes do Gather e define prazos e limites, sem publicar código novo." />
      {ok && <Alert tone="ok">Salvo e registrado.{Number(ajustados) > 0 ? ` ${ajustados} workspace(s) usavam uma opção desligada e passaram para a maior opção ligada.` : ""}</Alert>}
      {erro && <Alert>{erro === "padrao" ? "O padrão precisa ser uma das opções marcadas." : erro === "reason" ? "Diga o motivo da mudança." : "Confira os campos."}</Alert>}
      <form action={saveConfig} className={s.grid}>
        <div className={s.col}>
          <section className={s.card}>
            <b className={s.cardTitle}>Recursos</b>
            <Toggle name="callsForAllWorkspaces" title="Reuniões em todos os workspaces" text="Ligado: todo workspace tem reuniões por áudio. Desligado: só os que você ligar em Workspaces." checked={cfg.callsForAllWorkspaces} />
            <Toggle name="botEnabled" title="Orbi" text="O assistente da central de ajuda. Desligado, a central continua com os artigos." checked={cfg.botEnabled} />
            <Toggle name="lgpdEnabled" title="Recursos de LGPD" text="Meus dados, pedido de cópia e versões de consentimento. Desligado na versão pessoal; termos e 18+ continuam no primeiro acesso." checked={cfg.lgpdEnabled} />
            <Toggle name="maintenanceMode" title="Modo manutenção" text="Mostra um aviso e bloqueia o app para todos, menos para os admins." checked={cfg.maintenanceMode} />
            <input name="maintenanceMessage" defaultValue={cfg.maintenanceMessage ?? ""} maxLength={300} className={s.input} placeholder="Mensagem da manutenção (opcional)" />
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Prazos que os workspaces podem escolher</b>
            <span className={s.muted}>Mensagens</span>
            <div className={s.checks}>
              {MONTHS.map((m) => <label key={m} className={s.check}><input type="checkbox" name="months" value={m} defaultChecked={cfg.messageRetentionOptions.includes(m)} />{m} {m === 1 ? "mês" : "meses"} <span className={s.faint}>· {using(m)} em uso</span></label>)}
            </div>
            <label className={s.label}>Padrão para workspace novo
              <select name="defaultMessageMonths" defaultValue={cfg.defaultMessageMonths} className={s.select}>{MONTHS.map((m) => <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"}</option>)}</select>
            </label>
            <span className={s.muted}>Fotos e arquivos do chat</span>
            <div className={s.checks}>
              {HOURS.map((h) => <label key={h} className={s.check}><input type="checkbox" name="hours" value={h} defaultChecked={cfg.fileRetentionOptions.includes(h)} />{hourLabel(h)} <span className={s.faint}>· {using(undefined, h)} em uso</span></label>)}
            </div>
            <label className={s.label}>Padrão para workspace novo
              <select name="defaultFileHours" defaultValue={cfg.defaultFileHours} className={s.select}>{HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>
            </label>
            <p className={s.faint}>Quem usa uma opção que você desligar passa para a maior opção ainda ligada, e a próxima limpeza apaga o que passou do novo prazo.</p>
          </section>
        </div>
        <div className={s.col}>
          <section className={s.card}>
            <b className={s.cardTitle}>Limites de reunião</b>
            <Num name="callMinutesPerWorkspace" label="Minutos por workspace" value={cfg.callMinutesPerWorkspace} min={0} max={100000} unit="por mês" />
            <Num name="callMaxParticipants" label="Pessoas por reunião" value={cfg.callMaxParticipants} min={2} max={50} unit="pessoas" />
            <Num name="callMaxDurationMin" label="Duração máxima" value={cfg.callMaxDurationMin} min={5} max={240} unit="minutos" />
            <Num name="livekitMonthlyMinutes" label="Teto geral do LiveKit no mês" value={cfg.livekitMonthlyMinutes} min={0} max={1000000} unit="minutos" />
            <p className={s.faint}>Somando todos os workspaces. Passou do teto, ninguém começa reunião nova até o mês virar.</p>
          </section>
          <section className={s.card}>
            <b className={s.cardTitle}>Contas</b>
            <Num name="maxOwnedTeamWorkspaces" label="Workspaces de equipe por dono" value={cfg.maxOwnedTeamWorkspaces} min={0} max={50} unit="por pessoa" />
            <Num name="tempPasswordHours" label="Senha temporária vale por" value={cfg.tempPasswordHours} min={1} max={720} unit="horas" />
          </section>
          <section className={s.card}>
            <label className={s.label}>Motivo da mudança (fica no registro de ações)
              <textarea name="reason" required minLength={3} maxLength={300} className={s.area} placeholder="Ex.: liberar reuniões para o time de design" />
            </label>
            <Button>Salvar configurações</Button>
          </section>
        </div>
      </form>
    </>
  );
}
