import { Icon, type IconName } from "@/_components/ui/Icon";
import { extOf, formatBytes, isImage } from "@/lib/files";
import type { FileView } from "@/types/domain";
import s from "@/_styles/files/Files.module.css";

const iconFor = (f: { name: string; mime: string }): IconName => (isImage(f.mime) ? "image" : /pdf|doc|txt|md|rtf|odt/.test(extOf(f.name)) ? "file" : "clip");

/** Arquivos de uma mensagem ou tarefa: fotos em miniatura, o resto em cartões. */
export function FileList({ files, task, onRemove }: { files: FileView[]; task?: boolean; onRemove?: (id: string) => React.ReactNode }) {
  if (!files.length) return null;
  const href = (f: FileView, dl?: boolean) => {
    const q = [task && "k=t", dl && "baixar=1"].filter(Boolean).join("&");
    return `/api/arquivos/${f.id}${q ? `?${q}` : ""}`;
  };
  const photos = files.filter((f) => !f.expired && isImage(f.mime));
  const others = files.filter((f) => f.expired || !isImage(f.mime));
  return (
    <div className={s.files}>
      {photos.length > 0 && (
        <div className={`${s.photos} ${photos.length === 1 ? s.single : ""}`}>
          {photos.map((f) => (
            <span key={f.id} className={s.photoWrap}>
              <a href={href(f)} target="_blank" rel="noopener" className={s.photo} title={`${f.name} · ${formatBytes(f.size)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado, servido por link assinado */}
                <img src={href(f)} alt={f.name} loading="lazy" decoding="async" />
              </a>
              {onRemove?.(f.id)}
            </span>
          ))}
        </div>
      )}
      {others.map((f) =>
        f.expired ? (
          <div key={f.id} className={`${s.file} ${s.expired}`} title="Passou do prazo de arquivos do workspace">
            <span className={s.badge}><Icon name="clock" size={16} /></span>
            <span className={s.meta}><b>Arquivo expirado</b><small>{f.name}</small></span>
          </div>
        ) : (
          <div key={f.id} className={s.file}>
            <span className={s.badge}><Icon name={iconFor(f)} size={16} /></span>
            <a className={s.meta} href={href(f)} target="_blank" rel="noopener"><b>{f.name}</b><small>{extOf(f.name).toUpperCase() || "Arquivo"} · {formatBytes(f.size)}</small></a>
            <a className={s.dl} href={href(f, true)} aria-label={`Baixar ${f.name}`} title="Baixar"><Icon name="download" size={16} /></a>
            {onRemove?.(f.id)}
          </div>
        ),
      )}
    </div>
  );
}
