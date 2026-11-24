/** Data e hora no formato brasileiro, no fuso de São Paulo. */
export function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

/** Só a data (dd/mm/aaaa), no fuso de São Paulo. */
export function data(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });
}
