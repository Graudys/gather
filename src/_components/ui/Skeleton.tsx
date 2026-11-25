import s from "@/_styles/ui/Skeleton.module.css";

/** Blocos cinza no formato do conteúdo que vai chegar (mockup "Cartão carregando"). */
export function Bone({ w = "100%", h = 12, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <span className={s.bone} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

/** Chat carregando: cabeçalho, mensagens e a caixa de texto. */
export function ChatSkeleton() {
  const rows = [[60, 80, 220], [70, 160, 120], [50, 200, 0], [64, 120, 180], [58, 90, 0]];
  return (
    <div className={s.chat} aria-busy="true" aria-label="Carregando mensagens">
      <div className={s.head}><Bone w={110} h={16} /><Bone w={180} h={22} r={7} style={{ marginLeft: "auto" }} /></div>
      <div className={s.msgs}>
        {rows.map(([a, b, c], i) => (
          <div key={i} className={s.msg}>
            <Bone w={36} h={36} r={18} />
            <div className={s.lines}><Bone w={a} h={11} /><Bone w={b * 1.6} h={11} />{c > 0 && <Bone w={c} h={11} />}</div>
          </div>
        ))}
      </div>
      <div className={s.composer}><Bone h={46} r={12} /></div>
    </div>
  );
}

/** Quadro carregando: colunas com cartões. */
export function BoardSkeleton() {
  return (
    <div className={s.page} aria-busy="true" aria-label="Carregando">
      <Bone w={220} h={22} /><Bone w={320} h={12} />
      <div className={s.cols}>
        {[3, 2, 1, 2].map((n, i) => (
          <div key={i} className={s.col}>
            <Bone w={90} h={12} />
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className={s.card}><Bone w={50} h={14} r={5} /><Bone w="85%" h={12} /><Bone w="60%" h={10} /></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Página genérica carregando: título e linhas/cartões. */
export function PageSkeleton({ cards = false }: { cards?: boolean }) {
  return (
    <div className={s.page} aria-busy="true" aria-label="Carregando">
      <Bone w={200} h={24} />
      <Bone w={340} h={12} />
      {cards ? (
        <div className={s.grid}>{Array.from({ length: 6 }, (_, i) => <div key={i} className={s.card}><Bone w="60%" h={14} /><Bone w="90%" h={10} /><Bone w="75%" h={10} /><Bone w="100%" h={5} /></div>)}</div>
      ) : (
        <div className={s.rows}>{Array.from({ length: 7 }, (_, i) => <div key={i} className={s.row}><Bone w={28} h={28} r={14} /><Bone w={`${40 + ((i * 17) % 40)}%`} h={12} /><Bone w={70} h={10} style={{ marginLeft: "auto" }} /></div>)}</div>
      )}
    </div>
  );
}
