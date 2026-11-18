import { isUF } from '../uf';
import type {
  IbsCbsItem,
  IcmsItem,
  IpiItem,
  ItemNotaFiscal,
  NotaFiscal,
  PisCofinsItem,
  ResultadoLeituraNFe,
} from './types';

export const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';

/** Grupos de ICMS aceitos. No leiaute 4.00 o grupo ICMS40 cobre os CST 40, 41 e 50. */
export const GRUPOS_ICMS_SUPORTADOS = [
  'ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90',
  'ICMSSN101', 'ICMSSN102', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500', 'ICMSSN900',
] as const;

const GRUPOS_PIS_COFINS = ['Aliq', 'Qtde', 'NT', 'Outr'] as const;

/**
 * Troca as posições 7 a 20 da chave de acesso (CNPJ ou CPF do emitente) por "*".
 * Estrutura da chave: cUF(2) AAMM(4) CNPJ/CPF(14) modelo(2) série(3) número(9)
 * tpEmis(1) cNF(8) DV(1).
 */
export function mascararChave(chave: string): string {
  return chave.slice(0, 6) + '*'.repeat(14) + chave.slice(20);
}

/**
 * Lê o XML de uma NF-e autorizada (procNFe, leiaute 4.00) no próprio navegador.
 *
 * Nunca lança exceção: devolve `{ ok: true, nota }` ou `{ ok: false, erros }`,
 * com uma mensagem por problema encontrado, dizendo o elemento e o item.
 */
export function lerNFe(xml: string): ResultadoLeituraNFe {
  try {
    return lerNFeInterno(xml);
  } catch (e) {
    // Rede de segurança: um erro inesperado vira mensagem, nunca falha silenciosa.
    const detalhe = e instanceof Error ? e.message : String(e);
    return { ok: false, erros: [`Erro inesperado ao ler o XML: ${detalhe}`] };
  }
}

// ---------------------------------------------------------------------------

function lerNFeInterno(xml: string): ResultadoLeituraNFe {
  if (xml.trim() === '') return { ok: false, erros: ['O arquivo está vazio.'] };

  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, erros: ['O arquivo não é um XML válido (estrutura quebrada ou incompleta).'] };
  }

  const raiz = doc.documentElement;
  if (raiz.localName !== 'nfeProc' || raiz.namespaceURI !== NFE_NAMESPACE) {
    const sugestao =
      raiz.localName === 'NFe'
        ? ' O arquivo parece ser uma NF-e sem o protocolo de autorização; use o XML de distribuição (procNFe).'
        : '';
    return {
      ok: false,
      erros: [
        `Elemento raiz esperado: <nfeProc> no namespace ${NFE_NAMESPACE}. ` +
          `Encontrado: <${raiz.localName}>${raiz.namespaceURI ? ` (namespace ${raiz.namespaceURI})` : ' sem namespace'}.${sugestao}`,
      ],
    };
  }

  const erros: string[] = [];
  const nota = new Leitor(erros, 'Nota');

  const nfe = nota.filho(raiz, 'NFe', 'nfeProc');
  const infNFe = nfe && nota.filho(nfe, 'infNFe', 'NFe');
  if (!infNFe) return { ok: false, erros };

  const versao = infNFe.getAttribute('versao');
  if (versao !== '4.00') {
    return { ok: false, erros: [`Versão do leiaute não suportada: "${versao ?? 'ausente'}". Só a versão 4.00 é lida.`] };
  }

  const ide = nota.filho(infNFe, 'ide', 'infNFe');
  const emit = nota.filho(infNFe, 'emit', 'infNFe');
  const dest = nota.filho(infNFe, 'dest', 'infNFe');

  const modelo = ide && nota.texto(ide, 'mod', 'ide');
  if (modelo !== undefined && modelo !== '55') {
    erros.push(`Nota: modelo ${modelo} não suportado. Só a NF-e modelo 55 é lida.`);
  }

  const chave = lerChave(raiz, infNFe, erros);

  const numero = ide && nota.inteiro(ide, 'nNF', 'ide');
  const emissao = ide && nota.texto(ide, 'dhEmi', 'ide');
  const finalidade = ide && nota.codigo(ide, 'finNFe', 'ide', [1, 2, 3, 4] as const);
  const naturezaOperacao = ide && nota.texto(ide, 'natOp', 'ide');
  const idDest = ide && nota.codigo(ide, 'idDest', 'ide', [1, 2, 3] as const);
  const indFinal = ide && nota.codigo(ide, 'indFinal', 'ide', [0, 1] as const);

  const enderEmit = emit && nota.filho(emit, 'enderEmit', 'emit');
  const ufEmit = enderEmit && nota.texto(enderEmit, 'UF', 'enderEmit');
  if (ufEmit !== undefined && !isUF(ufEmit)) erros.push(`Nota: UF do emitente "${ufEmit}" não existe.`);
  const crt = emit && nota.codigo(emit, 'CRT', 'emit', [1, 2, 3, 4] as const);
  const cnae = emit && nota.textoOpcional(emit, 'CNAE');

  // UF do destinatário é opcional no leiaute, mas sem ela não dá para classificar a operação.
  const enderDest = dest && nota.filho(dest, 'enderDest', 'dest');
  const ufDest = enderDest && nota.texto(enderDest, 'UF', 'enderDest');
  if (ufDest !== undefined && ufDest !== 'EX' && !isUF(ufDest)) {
    erros.push(`Nota: UF do destinatário "${ufDest}" não existe.`);
  }
  const indIEDest = dest && nota.codigo(dest, 'indIEDest', 'dest', [1, 2, 9] as const);

  const dets = filhos(infNFe).filter((el) => el.localName === 'det');
  if (dets.length === 0) erros.push('Nota: nenhum item (<det>) encontrado em <infNFe>.');
  const itens = dets.map((det, i) => lerItem(det, i, erros));

  if (erros.length > 0) return { ok: false, erros };

  // Daqui em diante, sem erros, todos os campos obrigatórios foram lidos.
  return {
    ok: true,
    nota: {
      chave: chave!,
      numero: numero!,
      emissao: emissao!,
      finalidade: finalidade!,
      naturezaOperacao: naturezaOperacao!,
      idDest: idDest!,
      indFinal: indFinal!,
      emitente: { uf: ufEmit as NotaFiscal['emitente']['uf'], crt: crt!, ...(cnae ? { cnae } : {}) },
      destinatario: { uf: ufDest as NotaFiscal['destinatario']['uf'], indIEDest: indIEDest! },
      itens: itens as ItemNotaFiscal[],
    },
  };
}

function lerChave(raiz: Element, infNFe: Element, erros: string[]): string | undefined {
  const doId = infNFe.getAttribute('Id')?.replace(/^NFe/, '');
  const prot = filho(raiz, 'protNFe');
  const infProt = prot && filho(prot, 'infProt');
  const doProtocolo = infProt && textoDe(infProt, 'chNFe');

  if (doId && doProtocolo && doId !== doProtocolo) {
    erros.push('Nota: a chave em <infProt><chNFe> é diferente da chave no atributo Id de <infNFe>.');
    return undefined;
  }
  const chave = doProtocolo ?? doId;
  if (!chave) {
    erros.push('Nota: chave de acesso não encontrada (nem em <infProt><chNFe> nem no atributo Id de <infNFe>).');
    return undefined;
  }
  if (!/^\d{44}$/.test(chave)) {
    erros.push('Nota: a chave de acesso deve ter 44 dígitos.');
    return undefined;
  }
  return mascararChave(chave);
}

function lerItem(det: Element, posicao: number, erros: string[]): ItemNotaFiscal | undefined {
  const nItemAttr = det.getAttribute('nItem');
  const numeroItem = nItemAttr !== null && /^\d+$/.test(nItemAttr) ? Number(nItemAttr) : undefined;
  const rotulo = numeroItem !== undefined ? `Item ${numeroItem}` : `Item na posição ${posicao + 1}`;
  const l = new Leitor(erros, rotulo);
  if (numeroItem === undefined) erros.push(`${rotulo}: atributo nItem ausente ou inválido em <det>.`);

  const prod = l.filho(det, 'prod', 'det');
  const imposto = l.filho(det, 'imposto', 'det');

  const codigoProduto = prod && l.texto(prod, 'cProd', 'prod');
  const descricao = prod && l.texto(prod, 'xProd', 'prod');
  const ncm = prod && l.texto(prod, 'NCM', 'prod');
  const cest = prod && l.textoOpcional(prod, 'CEST');
  const cfop = prod && l.texto(prod, 'CFOP', 'prod');

  const icms = imposto && lerIcms(imposto, l);
  const pis = imposto && lerPisCofins(imposto, 'PIS', l);
  const cofins = imposto && lerPisCofins(imposto, 'COFINS', l);
  const ipi = imposto && lerIpi(imposto, l);
  const ibscbs = imposto && lerIbsCbs(imposto, l);

  if (!icms || !pis || !cofins || numeroItem === undefined || !codigoProduto || !descricao || !ncm || !cfop) {
    return undefined;
  }
  return {
    numeroItem,
    codigoProduto,
    descricao,
    ncm,
    ...(cest ? { cest } : {}),
    cfop,
    origem: icms.origem,
    icms: icms.icms,
    pis,
    cofins,
    ...(ipi ? { ipi } : {}),
    ...(ibscbs ? { ibscbs } : {}),
  };
}

function lerIcms(imposto: Element, l: Leitor): { icms: IcmsItem; origem: number } | undefined {
  const icmsEl = l.filho(imposto, 'ICMS', 'imposto');
  if (!icmsEl) return undefined;
  const grupoEl = filhos(icmsEl)[0];
  if (!grupoEl) {
    l.erro('grupo de ICMS vazio: <ICMS> não tem nenhum grupo dentro (ex.: <ICMS00>).');
    return undefined;
  }
  const grupo = grupoEl.localName;
  if (!(GRUPOS_ICMS_SUPORTADOS as readonly string[]).includes(grupo)) {
    l.erro(`grupo de ICMS <${grupo}> não é suportado nesta versão. Suportados: ${GRUPOS_ICMS_SUPORTADOS.join(', ')}.`);
    return undefined;
  }

  const origem = l.codigo(grupoEl, 'orig', grupo, [0, 1, 2, 3, 4, 5, 6, 7, 8] as const);
  const valores = {
    grupo,
    ...l.numerosOpcionais(grupoEl, ['modBC', 'vBC', 'pICMS', 'vICMS', 'pCredSN', 'vCredICMSSN'] as const),
  };

  if (grupo.startsWith('ICMSSN')) {
    const csosn = l.texto(grupoEl, 'CSOSN', grupo);
    if (csosn === undefined || origem === undefined) return undefined;
    return { origem, icms: { ...valores, regime: 'simples', csosn } };
  }
  const cst = l.texto(grupoEl, 'CST', grupo);
  if (cst === undefined || origem === undefined) return undefined;
  return { origem, icms: { ...valores, regime: 'normal', cst } };
}

function lerPisCofins(imposto: Element, tributo: 'PIS' | 'COFINS', l: Leitor): PisCofinsItem | undefined {
  const el = l.filho(imposto, tributo, 'imposto');
  if (!el) return undefined;
  const grupoEl = filhos(el)[0];
  const sufixo = grupoEl?.localName.slice(tributo.length);
  if (!grupoEl || !grupoEl.localName.startsWith(tributo) || !(GRUPOS_PIS_COFINS as readonly string[]).includes(sufixo ?? '')) {
    const encontrado = grupoEl ? `<${grupoEl.localName}>` : 'nenhum';
    const esperados = GRUPOS_PIS_COFINS.map((g) => `<${tributo}${g}>`).join(', ');
    l.erro(`grupo de ${tributo} não suportado: encontrado ${encontrado}; esperado um de ${esperados}.`);
    return undefined;
  }
  const cst = l.texto(grupoEl, 'CST', grupoEl.localName);
  if (cst === undefined) return undefined;
  const p = tributo === 'PIS' ? 'pPIS' : 'pCOFINS';
  const v = tributo === 'PIS' ? 'vPIS' : 'vCOFINS';
  const n = l.numerosOpcionais(grupoEl, ['vBC', p, v, 'qBCProd', 'vAliqProd'] as const);
  return definidos({
    grupo: sufixo as PisCofinsItem['grupo'],
    cst,
    vBC: n.vBC,
    aliquota: n[p],
    valor: n[v],
    quantidadeBC: n.qBCProd,
    aliquotaPorUnidade: n.vAliqProd,
  });
}

function lerIpi(imposto: Element, l: Leitor): IpiItem | undefined {
  const ipi = filho(imposto, 'IPI');
  if (!ipi) return undefined;
  const grupoEl = filho(ipi, 'IPITrib') ?? filho(ipi, 'IPINT');
  if (!grupoEl) {
    l.erro('<IPI> sem <IPITrib> nem <IPINT>.');
    return undefined;
  }
  const cst = l.texto(grupoEl, 'CST', grupoEl.localName);
  if (cst === undefined) return undefined;
  const n = l.numerosOpcionais(grupoEl, ['vBC', 'pIPI', 'vIPI'] as const);
  return definidos({ cst, vBC: n.vBC, aliquota: n.pIPI, valor: n.vIPI });
}

function lerIbsCbs(imposto: Element, l: Leitor): IbsCbsItem | undefined {
  const el = filho(imposto, 'IBSCBS');
  if (!el) return undefined;
  const cst = l.texto(el, 'CST', 'IBSCBS');
  const cClassTrib = l.texto(el, 'cClassTrib', 'IBSCBS');
  if (cst === undefined || cClassTrib === undefined) return undefined;

  // Alguns CST (ex.: imunidade) não trazem o grupo de valores gIBSCBS.
  const g = filho(el, 'gIBSCBS');
  if (!g) return { cst, cClassTrib };
  const gIBSUF = filho(g, 'gIBSUF');
  const gCBS = filho(g, 'gCBS');
  const base = l.numerosOpcionais(g, ['vBC', 'vIBS'] as const);
  const uf = gIBSUF ? l.numerosOpcionais(gIBSUF, ['pIBSUF'] as const) : {};
  const cbs = gCBS ? l.numerosOpcionais(gCBS, ['pCBS', 'vCBS'] as const) : {};
  return definidos({ cst, cClassTrib, vBC: base.vBC, pIBSUF: uf.pIBSUF, pCBS: cbs.pCBS, vIBS: base.vIBS, vCBS: cbs.vCBS });
}

// ---------------------------------------------------------------------------
// Utilitários de leitura do DOM (sempre filhos diretos, sempre no namespace da NF-e).

function filhos(el: Element): Element[] {
  return Array.from(el.children).filter((c) => c.namespaceURI === NFE_NAMESPACE);
}

function filho(el: Element, nome: string): Element | undefined {
  return filhos(el).find((c) => c.localName === nome);
}

function textoDe(el: Element, nome: string): string | undefined {
  const t = filho(el, nome)?.textContent?.trim();
  return t ? t : undefined;
}

/** Remove chaves com valor `undefined` (compatível com exactOptionalPropertyTypes). */
function definidos<T extends object>(obj: { [K in keyof T]: T[K] | undefined }): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** Lê campos registrando erros com o rótulo do contexto ("Nota", "Item 2"). */
class Leitor {
  constructor(
    private readonly erros: string[],
    private readonly rotulo: string,
  ) {}

  erro(mensagem: string): void {
    this.erros.push(`${this.rotulo}: ${mensagem}`);
  }

  filho(el: Element, nome: string, pai: string): Element | undefined {
    const f = filho(el, nome);
    if (!f) this.erro(`elemento <${nome}> não encontrado dentro de <${pai}>.`);
    return f;
  }

  texto(el: Element, nome: string, pai: string): string | undefined {
    const t = textoDe(el, nome);
    if (t === undefined) this.erro(`elemento <${nome}> não encontrado ou vazio dentro de <${pai}>.`);
    return t;
  }

  textoOpcional(el: Element, nome: string): string | undefined {
    return textoDe(el, nome);
  }

  inteiro(el: Element, nome: string, pai: string): number | undefined {
    const t = this.texto(el, nome, pai);
    if (t === undefined) return undefined;
    if (!/^\d+$/.test(t)) {
      this.erro(`<${nome}> deveria ser um número inteiro, mas veio "${t}".`);
      return undefined;
    }
    return Number(t);
  }

  codigo<const T extends readonly number[]>(el: Element, nome: string, pai: string, permitidos: T): T[number] | undefined {
    const n = this.inteiro(el, nome, pai);
    if (n === undefined) return undefined;
    if (!permitidos.includes(n)) {
      this.erro(`<${nome}> com valor ${n}; valores aceitos pelo leiaute: ${permitidos.join(', ')}.`);
      return undefined;
    }
    return n as T[number];
  }

  numerosOpcionais<const K extends string>(el: Element, nomes: readonly K[]): Partial<Record<K, number>> {
    const out: Partial<Record<K, number>> = {};
    for (const nome of nomes) {
      const t = textoDe(el, nome);
      if (t === undefined) continue;
      if (!DECIMAL.test(t)) {
        this.erro(`<${nome}> em <${el.localName}> deveria ser número (com ponto decimal), mas veio "${t}".`);
        continue;
      }
      out[nome] = Number(t);
    }
    return out;
  }
}
