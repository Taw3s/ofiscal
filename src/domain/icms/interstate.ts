import { rulesOf } from '../../data';
import type { Rule, RuleStatus } from '../rules/schema';
import { isUF, type UF } from '../uf';

/**
 * Um passo da memória de cálculo: o que foi verificado, o resultado,
 * a base legal e o estado de validação da regra usada.
 */
export interface PassoMemoria {
  descricao: string;
  resultado: string;
  baseLegal: string;
  regraId: string;
  status: RuleStatus;
}

export type ResultadoAliquotaInterestadual =
  | { ok: true; aliquota: number; regra: Rule; memoria: PassoMemoria[] }
  | { ok: false; erro: string };

const ID_4 = 'icms-interestadual-4-importados';
const ID_7 = 'icms-interestadual-7-sul-sudeste-para-demais';
const ID_12 = 'icms-interestadual-12-demais';

const contains = <T>(list: readonly T[] | undefined, value: T): boolean =>
  list !== undefined && list.includes(value);

/**
 * Alíquota interestadual de ICMS.
 *
 * Ordem de decisão (os valores e as listas de UF vêm de src/data/icms-interestadual.json):
 *   1. origem da mercadoria 1, 2, 3 ou 8 → regra dos 4% (Res. SF 13/2012);
 *   2. UF de origem na lista Sul/Sudeste e UF de destino na lista N/NE/CO/ES → 7%;
 *   3. demais casos → 12% (Res. SF 22/1989).
 *
 * Função pura: não acessa rede, relógio nem armazenamento. Nunca lança
 * exceção por entrada inválida; devolve `{ ok: false, erro }`.
 */
export function aliquotaInterestadual(
  ufOrigem: string,
  ufDestino: string,
  origemMercadoria: number,
  regras: readonly Rule[] = rulesOf('icms-interestadual'),
): ResultadoAliquotaInterestadual {
  if (!isUF(ufOrigem)) return { ok: false, erro: `UF de origem "${ufOrigem}" não existe. Use a sigla em maiúsculas, ex.: SP.` };
  if (!isUF(ufDestino)) return { ok: false, erro: `UF de destino "${ufDestino}" não existe. Use a sigla em maiúsculas, ex.: BA.` };
  if (ufOrigem === ufDestino) {
    return { ok: false, erro: `Origem e destino são a mesma UF (${ufOrigem}): a operação é interna, não interestadual.` };
  }
  if (!Number.isInteger(origemMercadoria) || origemMercadoria < 0 || origemMercadoria > 8) {
    return { ok: false, erro: `Código de origem da mercadoria "${origemMercadoria}" inválido: deve ser um número inteiro de 0 a 8.` };
  }

  const regra = escolherRegra(regras, ufOrigem, ufDestino, origemMercadoria);
  if (!regra.ok) return regra;
  const r = regra.regra;
  if (r.valor === null) {
    return { ok: false, erro: `A regra "${r.id}" se aplica, mas está sem valor cadastrado (status: ${r.status}).` };
  }

  const passo: PassoMemoria = {
    descricao: descreverPasso(r.id, ufOrigem, ufDestino, origemMercadoria),
    resultado: `${r.valor}%`,
    baseLegal: r.fonte ?? 'sem fonte cadastrada',
    regraId: r.id,
    status: r.status,
  };
  return { ok: true, aliquota: r.valor, regra: r, memoria: [passo] };
}

function escolherRegra(
  regras: readonly Rule[],
  ufOrigem: UF,
  ufDestino: UF,
  origem: number,
): { ok: true; regra: Rule } | { ok: false; erro: string } {
  const byId = (id: string) => regras.find((r) => r.id === id);
  const r4 = byId(ID_4);
  const r7 = byId(ID_7);
  const r12 = byId(ID_12);
  const faltando = [[ID_4, r4], [ID_7, r7], [ID_12, r12]].filter(([, r]) => !r).map(([id]) => id);
  if (!r4 || !r7 || !r12) {
    return { ok: false, erro: `Regra(s) ausente(s) em src/data/icms-interestadual.json: ${faltando.join(', ')}.` };
  }

  if (contains(r4.escopo.origensMercadoria, origem)) return { ok: true, regra: r4 };
  if (
    contains(r7.escopo.origensMercadoria, origem) &&
    contains(r7.escopo.ufsOrigem, ufOrigem) &&
    contains(r7.escopo.ufsDestino, ufDestino)
  ) {
    return { ok: true, regra: r7 };
  }
  if (contains(r12.escopo.origensMercadoria, origem)) return { ok: true, regra: r12 };
  return { ok: false, erro: `Nenhuma regra cadastrada cobre a origem da mercadoria ${origem}.` };
}

function descreverPasso(regraId: string, ufOrigem: UF, ufDestino: UF, origem: number): string {
  const rota = `${ufOrigem} → ${ufDestino}`;
  switch (regraId) {
    case ID_4:
      return `Origem da mercadoria ${origem} está entre as origens 1, 2, 3 e 8; nesse caso a alíquota é de 4% em qualquer rota interestadual (${rota}).`;
    case ID_7:
      return `Origem da mercadoria ${origem} (fora dos 4%). Rota ${rota}: ${ufOrigem} está em SP/RJ/MG/PR/SC/RS e ${ufDestino} está em Norte, Nordeste, Centro-Oeste ou ES.`;
    default:
      return `Origem da mercadoria ${origem} (fora dos 4%). Rota ${rota} não se enquadra na regra dos 7%; aplica-se a alíquota geral.`;
  }
}
