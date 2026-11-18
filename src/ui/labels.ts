/**
 * Rótulos dos códigos do leiaute da NF-e usados na tela. São enumerações do
 * leiaute (significado do campo), não regras fiscais.
 */
export const ID_DEST_LABEL: Record<number, string> = { 1: 'interna', 2: 'interestadual', 3: 'com exterior' };
export const IND_FINAL_LABEL: Record<number, string> = { 0: 'não', 1: 'sim (consumidor final)' };
export const FINALIDADE_LABEL: Record<number, string> = { 1: 'normal', 2: 'complementar', 3: 'ajuste', 4: 'devolução' };
export const CRT_LABEL: Record<number, string> = {
  1: 'Simples Nacional',
  2: 'Simples Nacional, excesso de sublimite',
  3: 'Regime normal',
  4: 'MEI',
};
export const IND_IE_DEST_LABEL: Record<number, string> = { 1: 'contribuinte', 2: 'isento de IE', 9: 'não contribuinte' };

export function rotulo(mapa: Record<number, string>, codigo: number): string {
  const t = mapa[codigo];
  return t ? `${codigo} – ${t}` : String(codigo);
}

/** Número no formato brasileiro, sem arredondar além do que veio no XML. */
export function numeroBR(n: number | undefined, sufixo = ''): string {
  if (n === undefined) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 }) + sufixo;
}
