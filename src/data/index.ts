import { fingerprint, parseRuleFile } from '../domain/rules/load';
import type { Rule, RuleFile } from '../domain/rules/schema';
import icmsInterestadualJson from './icms-interestadual.json';
import icmsInternoModalJson from './icms-interno-modal.json';

/**
 * Ponto único de carga das regras fiscais. Para adicionar um arquivo novo,
 * importe-o aqui e inclua-o em RULE_FILES.
 */
export const RULE_FILES: readonly RuleFile[] = [
  parseRuleFile('icms-interestadual.json', icmsInterestadualJson),
  parseRuleFile('icms-interno-modal.json', icmsInternoModalJson),
];

export const ALL_RULES: readonly Rule[] = RULE_FILES.flatMap((f) => f.regras);

/** Versão das regras: muda automaticamente quando qualquer regra muda. */
export const RULES_VERSION = `regras-${fingerprint(JSON.stringify(RULE_FILES))}`;

export function rulesOf(conjunto: string): readonly Rule[] {
  const file = RULE_FILES.find((f) => f.conjunto === conjunto);
  if (!file) throw new Error(`Conjunto de regras "${conjunto}" não encontrado em src/data.`);
  return file.regras;
}
