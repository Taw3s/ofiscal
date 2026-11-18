import { describe, expect, it } from 'vitest';
import { ALL_RULES, RULES_VERSION, rulesOf } from '../../data';
import { UFS } from '../uf';
import { parseRuleFile } from './load';
import { checkRulePolicy } from './policy';
import type { Rule } from './schema';

const base: Rule = {
  id: 'regra-teste',
  descricao: 'Regra de teste',
  escopo: {},
  valor: 10,
  status: 'validado',
  fonte: 'Lei de teste, art. 1º',
  validadoPor: 'Contador Fictício',
  validadoEm: '2026-01-15',
  vigenciaInicio: '2026-01-01',
};

describe('checkRulePolicy', () => {
  it('aceita regra validada completa', () => {
    expect(checkRulePolicy([base])).toEqual([]);
  });

  it.each([
    ['fonte', { fonte: null }],
    ['fonte', { fonte: '   ' }],
    ['validadoPor', { validadoPor: undefined }],
    ['validadoEm', { validadoEm: undefined }],
  ])('rejeita "validado" sem %s', (campo, patch) => {
    const regra = { ...base, ...patch } as Rule;
    const problemas = checkRulePolicy([regra]);
    expect(problemas.map((p) => p.mensagem).join('\n')).toContain(`"${campo}"`);
  });

  it('rejeita "validado" com valor null', () => {
    expect(checkRulePolicy([{ ...base, valor: null }])).toHaveLength(1);
  });

  it('rejeita ids repetidos', () => {
    expect(checkRulePolicy([base, base])[0]?.mensagem).toContain('repetido');
  });

  it('rejeita "pendente" com valor preenchido', () => {
    const { validadoPor: _a, validadoEm: _b, ...semValidacao } = base;
    expect(checkRulePolicy([{ ...semValidacao, status: 'pendente' }])[0]?.mensagem).toContain('pendente');
  });

  it('rejeita "nao_validado" sem fonte', () => {
    const { validadoPor: _a, validadoEm: _b, ...semValidacao } = base;
    expect(checkRulePolicy([{ ...semValidacao, status: 'nao_validado', fonte: null }])).toHaveLength(1);
  });

  it('rejeita vigência que termina antes de começar', () => {
    expect(checkRulePolicy([{ ...base, vigenciaFim: '2025-12-31' }])).toHaveLength(1);
  });
});

describe('parseRuleFile', () => {
  it('aponta o campo inválido na mensagem de erro', () => {
    expect(() =>
      parseRuleFile('x.json', { conjunto: 'x', regras: [{ ...base, status: 'aprovado' }] }),
    ).toThrow(/x\.json[\s\S]*regras\.0\.status/);
  });

  it('rejeita UF inexistente no escopo', () => {
    expect(() => parseRuleFile('x.json', { conjunto: 'x', regras: [{ ...base, escopo: { uf: 'XX' } }] })).toThrow(
      /escopo\.uf/,
    );
  });
});

describe('dados reais em src/data', () => {
  it('passam na política de regras', () => {
    expect(checkRulePolicy(ALL_RULES)).toEqual([]);
  });

  it('nenhuma regra está marcada como validada nesta fase', () => {
    expect(ALL_RULES.filter((r) => r.status === 'validado')).toEqual([]);
  });

  it('tabela de ICMS modal interno tem exatamente as 27 UFs, uma linha cada', () => {
    const modal = rulesOf('icms-interno-modal');
    expect(modal).toHaveLength(27);
    expect(modal.map((r) => r.escopo.uf).sort()).toEqual([...UFS].sort());
  });

  it('nenhuma alíquota interna preenchida, exceto TO = 20 não validada', () => {
    const preenchidas = rulesOf('icms-interno-modal').filter((r) => r.valor !== null);
    expect(preenchidas).toHaveLength(1);
    expect(preenchidas[0]).toMatchObject({
      escopo: { uf: 'TO' },
      valor: 20,
      status: 'nao_validado',
      fonte: 'citado por um contador em conversa; confirmar no RICMS/TO',
    });
    for (const r of rulesOf('icms-interno-modal')) {
      if (r.escopo.uf !== 'TO') expect(r).toMatchObject({ status: 'pendente', valor: null });
    }
  });

  it('lista de destinos da regra dos 7% tem 21 UFs e inclui ES', () => {
    const r7 = rulesOf('icms-interestadual').find((r) => r.valor === 7);
    expect(r7?.escopo.ufsDestino).toHaveLength(21);
    expect(r7?.escopo.ufsDestino).toContain('ES');
    expect(r7?.escopo.ufsOrigem).not.toContain('ES');
  });

  it('versão das regras é uma impressão digital estável', () => {
    expect(RULES_VERSION).toMatch(/^regras-[0-9a-f]{8}$/);
  });
});
