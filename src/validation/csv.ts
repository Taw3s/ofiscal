import type { RegistroValidacao } from './types';
import { VEREDICTO_LABEL } from './types';

/**
 * Separador ";" porque o Excel em português usa vírgula como separador decimal
 * e abre arquivos com ";" direto em colunas.
 */
export const CSV_SEPARADOR = ';';

/**
 * Escapa um campo de CSV (RFC 4180): se tiver separador, aspas ou quebra de
 * linha, vai entre aspas e cada aspa interna vira duas ("").
 *
 * Também neutraliza "injeção de fórmula": um texto que começa com = + - @ é
 * interpretado como fórmula pelo Excel. Nesses casos prefixamos com apóstrofo.
 */
export function escaparCampoCsv(valor: string): string {
  let v = valor;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[";\r\n,]/.test(v)) v = `"${v.replaceAll('"', '""')}"`;
  return v;
}

function campos(obj: RegistroValidacao['entrada']): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v ?? ''}`)
    .join(', ');
}

export const CSV_CABECALHO = [
  'data',
  'versao_regras',
  'validado_por',
  'tipo',
  'entrada',
  'saida',
  'veredito',
  'valor_esperado',
  'comentario',
] as const;

/** Gera o CSV (sem BOM). Linhas separadas por CRLF, como pede a RFC 4180. */
export function registrosParaCsv(registros: readonly RegistroValidacao[]): string {
  const linhas = [CSV_CABECALHO.join(CSV_SEPARADOR)];
  for (const r of registros) {
    linhas.push(
      [
        r.data,
        r.versaoRegras,
        r.validadoPor,
        r.tipo,
        campos(r.entrada),
        campos(r.saida),
        VEREDICTO_LABEL[r.veredito],
        r.valorEsperado ?? '',
        r.comentario ?? '',
      ]
        .map(escaparCampoCsv)
        .join(CSV_SEPARADOR),
    );
  }
  return linhas.join('\r\n') + '\r\n';
}
