/**
 * As 27 unidades federativas do Brasil (26 estados + DF).
 * Dado geográfico, não fiscal: não depende de validação por contador.
 */
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type UF = (typeof UFS)[number];

export function isUF(value: unknown): value is UF {
  return typeof value === 'string' && (UFS as readonly string[]).includes(value);
}
