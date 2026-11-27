"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WsBadge } from "@/_components/shell/WsBadge";
import { PhotoCropper } from "@/_components/photos/PhotoCropper";
import { setWorkspaceIcon, setWorkspacePhoto } from "@/_data/photos.actions";
import { CHAT_ICONS } from "@/lib/chat-icons";
import c from "@/_styles/chat/Chat.module.css";

/** Configurações › Geral: ícone do workspace (letra, emoji ou foto recortada). */
export function WorkspaceIconCard({ w }: { w: { id: string; name: string; icon: string | null; photoV: string } }) {
  const router = useRouter();
  const [cur, setCur] = useState(w);
  const [, start] = useTransition();
  const choose = (icon: string | null) => {
    setCur({ ...cur, icon, photoV: "" });
    start(async () => {
      await setWorkspaceIcon({ workspaceId: w.id, icon });
      router.refresh();
    });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <WsBadge w={cur} size={56} />
        <PhotoCropper label={w.photoV ? "Trocar foto" : "Usar uma foto"} save={setWorkspacePhoto} extra={{ workspaceId: w.id }} remove={w.photoV ? () => setWorkspaceIcon({ workspaceId: w.id, icon: null }) : undefined} />
      </div>
      <div className={c.iconRadios} role="radiogroup" aria-label="Ícone do workspace">
        <label title="Primeira letra"><input type="radio" name="wsIcon" checked={!cur.icon && !cur.photoV} onChange={() => choose(null)} /><span style={{ fontSize: 14, fontWeight: 600 }}>{w.name[0]?.toUpperCase()}</span></label>
        {CHAT_ICONS.map((e) => (
          <label key={e}><input type="radio" name="wsIcon" checked={cur.icon === e && !cur.photoV} onChange={() => choose(e)} /><span>{e}</span></label>
        ))}
      </div>
    </div>
  );
}
