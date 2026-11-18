/**
 * npm run check:rules
 *
 * Falha (código de saída 1) se algum arquivo de regras estiver malformado ou
 * se alguma regra violar a política — por exemplo, marcada como "validado"
 * sem fonte, validadoPor e validadoEm. Roda no CI a cada push.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRuleFile } from '../src/domain/rules/load';
import { checkRulePolicy } from '../src/domain/rules/policy';
import type { Rule } from '../src/domain/rules/schema';

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort();

let failed = false;
const all: Rule[] = [];

for (const file of files) {
  try {
    const parsed = parseRuleFile(file, JSON.parse(readFileSync(join(dataDir, file), 'utf8')));
    all.push(...parsed.regras);
  } catch (e) {
    failed = true;
    console.error(e instanceof Error ? e.message : String(e));
  }
}

const problems = checkRulePolicy(all);
for (const p of problems) console.error(`✗ ${p.regraId}: ${p.mensagem}`);

const count = (s: Rule['status']) => all.filter((r) => r.status === s).length;
console.log(
  `${files.length} arquivo(s), ${all.length} regra(s): ` +
    `${count('validado')} validada(s), ${count('nao_validado')} não validada(s), ${count('pendente')} pendente(s).`,
);

if (failed || problems.length > 0) {
  console.error(`\nVerificação de regras FALHOU (${problems.length} problema(s) de política).`);
  process.exit(1);
}
console.log('Verificação de regras OK.');
