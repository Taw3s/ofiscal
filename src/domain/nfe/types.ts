import type { UF } from '../uf';

/**
 * Dados extraídos de uma NF-e (modelo 55, leiaute 4.00).
 *
 * PRIVACIDADE: este tipo, de propósito, NÃO tem CNPJ, CPF, IE, nome, endereço,
 * telefone nem e-mail de emitente ou destinatário. Do emitente só vêm UF, CRT
 * e CNAE; do destinatário, só UF e indIEDest. A chave de acesso sai com o
 * CNPJ/CPF do emitente mascarado (veja `mascararChave`).
 */
export interface NotaFiscal {
  /** Chave de acesso com as posições 7 a 20 (CNPJ/CPF do emitente) trocadas por "*". */
  chave: string;
  numero: number;
  /** Data e hora de emissão exatamente como no XML (dhEmi), ex.: 2026-03-10T10:15:00-03:00. */
  emissao: string;
  /** finNFe: 1 normal, 2 complementar, 3 ajuste, 4 devolução. */
  finalidade: 1 | 2 | 3 | 4;
  naturezaOperacao: string;
  /** 1 interna, 2 interestadual, 3 com exterior. */
  idDest: 1 | 2 | 3;
  /** 0 normal, 1 consumidor final. */
  indFinal: 0 | 1;
  emitente: {
    uf: UF;
    /** 1 Simples Nacional, 2 SN excesso de sublimite, 3 regime normal, 4 MEI. */
    crt: 1 | 2 | 3 | 4;
    cnae?: string;
  };
  destinatario: {
    /** "EX" quando o destinatário é do exterior. */
    uf: UF | 'EX';
    /** 1 contribuinte, 2 isento de IE, 9 não contribuinte. */
    indIEDest: 1 | 2 | 9;
  };
  itens: ItemNotaFiscal[];
}

export interface ItemNotaFiscal {
  numeroItem: number;
  codigoProduto: string;
  descricao: string;
  ncm: string;
  /** CEST como vem no XML: 7 dígitos, sem pontos (ex.: 1200300 = 12.003.00). */
  cest?: string;
  cfop: string;
  /** Origem da mercadoria (campo `orig` do grupo de ICMS), 0 a 8. */
  origem: number;
  icms: IcmsItem;
  pis: PisCofinsItem;
  cofins: PisCofinsItem;
  ipi?: IpiItem;
  ibscbs?: IbsCbsItem;
}

interface IcmsValores {
  /** Nome da tag do grupo no XML, ex.: "ICMS00", "ICMS40", "ICMSSN101". */
  grupo: string;
  modBC?: number;
  vBC?: number;
  pICMS?: number;
  vICMS?: number;
  pCredSN?: number;
  vCredICMSSN?: number;
}

/** Regime normal traz `cst`; Simples Nacional traz `csosn`. Nunca os dois. */
export type IcmsItem =
  | (IcmsValores & { regime: 'normal'; cst: string })
  | (IcmsValores & { regime: 'simples'; csosn: string });

export interface PisCofinsItem {
  grupo: 'Aliq' | 'Qtde' | 'NT' | 'Outr';
  cst: string;
  vBC?: number;
  /** Alíquota em percentual (pPIS / pCOFINS). */
  aliquota?: number;
  valor?: number;
  /** Tributação por quantidade: quantidade vendida (qBCProd). */
  quantidadeBC?: number;
  /** Tributação por quantidade: alíquota em reais por unidade (vAliqProd). */
  aliquotaPorUnidade?: number;
}

export interface IpiItem {
  cst: string;
  vBC?: number;
  aliquota?: number;
  valor?: number;
}

/** Grupo IBSCBS da reforma tributária (presente em notas a partir de 2026). */
export interface IbsCbsItem {
  cst: string;
  cClassTrib: string;
  vBC?: number;
  pIBSUF?: number;
  pCBS?: number;
  vIBS?: number;
  vCBS?: number;
}

export type ResultadoLeituraNFe =
  | { ok: true; nota: NotaFiscal }
  | { ok: false; erros: string[] };
