import type { RegistroValidacao, Veredicto } from './types';

export interface NovoRegistro {
  validadoPor: string;
  tipo: string;
  entrada: RegistroValidacao['entrada'];
  saida: RegistroValidacao['saida'];
  veredito: Veredicto;
  valorEsperado?: string;
  comentario?: string;
}

export interface Contexto {
  versaoRegras: string;
  agora: Date;
  gerarId: () => string;
}

/**
 * Monta um registro de validação conferindo os campos obrigatórios.
 * Para "divergente", valor esperado e comentário (com a base legal) são exigidos.
 */
export function criarRegistro(
  novo: NovoRegistro,
  ctx: Contexto,
): { ok: true; registro: RegistroValidacao } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  const validadoPor = novo.validadoPor.trim();
  const valorEsperado = novo.valorEsperado?.trim() ?? '';
  const comentario = novo.comentario?.trim() ?? '';

  if (!validadoPor) erros.push('Informe o nome de quem está validando.');
  if (novo.veredito === 'divergente') {
    if (!valorEsperado) erros.push('Para marcar como divergente, informe o valor esperado.');
    if (!comentario) erros.push('Para marcar como divergente, explique no comentário a base legal.');
  }
  if (erros.length) return { ok: false, erros };

  return {
    ok: true,
    registro: {
      id: ctx.gerarId(),
      data: ctx.agora.toISOString(),
      versaoRegras: ctx.versaoRegras,
      validadoPor,
      tipo: novo.tipo,
      entrada: novo.entrada,
      saida: novo.saida,
      veredito: novo.veredito,
      ...(valorEsperado ? { valorEsperado } : {}),
      ...(comentario ? { comentario } : {}),
    },
  };
}

export interface Resumo {
  total: number;
  confere: number;
  divergente: number;
  /** Fração de 0 a 1; `null` quando não há registros. */
  taxaAcerto: number | null;
}

export function resumir(registros: readonly RegistroValidacao[]): Resumo {
  const confere = registros.filter((r) => r.veredito === 'confere').length;
  const total = registros.length;
  return { total, confere, divergente: total - confere, taxaAcerto: total ? confere / total : null };
}
