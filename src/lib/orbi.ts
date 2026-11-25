/**
 * Orbi: responde só com os artigos da central de ajuda (sem IA).
 * Pontua cada artigo pelas palavras da pergunta: palavras-chave valem mais,
 * depois o título, depois o resumo. Abaixo de um mínimo, diz que não sabe.
 */
const STOP = new Set("a o as os de da do das dos e em no na nos nas um uma uns umas para pra por com sem que como onde quando qual quais eu me meu minha voce vc se ao aos é ser ter tem isso esse essa este esta ou mais muito pode posso consigo fazer faço".split(" "));

export function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokens(text: string) {
  // "senhas" e "senha" contam igual: tira o "s" final de palavras maiores.
  return normalize(text).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w));
}

export type OrbiArticle = { id: string; title: string; summary: string; keywords: string[] };

export function bestArticle<T extends OrbiArticle>(question: string, articles: T[]): { article: T; score: number } | null {
  const q = tokens(question);
  if (!q.length) return null;
  const qn = ` ${normalize(question)} `;
  let best: { article: T; score: number } | null = null;
  for (const a of articles) {
    let score = 0;
    for (const k of a.keywords) {
      const kn = normalize(k);
      if (kn && qn.includes(` ${kn} `)) score += 4;
      else if (kn && tokens(k).some((t) => q.includes(t))) score += 2;
    }
    const title = new Set(tokens(a.title));
    const summary = new Set(tokens(a.summary));
    for (const t of q) {
      if (title.has(t)) score += 2;
      else if (summary.has(t)) score += 1;
    }
    if (!best || score > best.score) best = { article: a, score };
  }
  return best && best.score >= 3 ? best : null;
}
