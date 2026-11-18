import type { Rule } from './schema';

export interface RuleProblem {
  regraId: string;
  mensagem: string;
}

function blank(value: string | null | undefined): boolean {
  return value === undefined || value === null || value.trim() === '';
}

/**
 * Regras de processo sobre os dados fiscais. Usado pelo `npm run check:rules`
 * (que roda no CI) e pelos testes. Devolve a lista de problemas; vazia = ok.
 */
export function checkRulePolicy(rules: readonly Rule[]): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const seen = new Set<string>();

  for (const r of rules) {
    const add = (mensagem: string) => problems.push({ regraId: r.id, mensagem });

    if (seen.has(r.id)) add('id repetido: cada regra precisa de um id único');
    seen.add(r.id);

    if (r.status === 'validado') {
      if (blank(r.fonte)) add('está "validado" mas não tem "fonte"');
      if (blank(r.validadoPor)) add('está "validado" mas não tem "validadoPor"');
      if (blank(r.validadoEm)) add('está "validado" mas não tem "validadoEm"');
      if (r.valor === null) add('está "validado" mas "valor" é null');
      if (r.vigenciaInicio === null) add('está "validado" mas não tem "vigenciaInicio"');
    } else {
      if (!blank(r.validadoPor) || !blank(r.validadoEm)) {
        add(`tem "validadoPor"/"validadoEm" mas o status é "${r.status}"; use "validado" ou remova esses campos`);
      }
    }

    if (r.status === 'pendente' && r.valor !== null) {
      add('está "pendente" mas tem valor; use "nao_validado" se o valor veio de alguma fonte');
    }

    if (r.status === 'nao_validado' && blank(r.fonte)) {
      add('está "nao_validado" mas não diz de onde veio o valor ("fonte")');
    }

    if (r.vigenciaInicio && r.vigenciaFim && r.vigenciaFim < r.vigenciaInicio) {
      add('"vigenciaFim" é anterior a "vigenciaInicio"');
    }
  }

  return problems;
}
