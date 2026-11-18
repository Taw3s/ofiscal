import { describe, expect, it } from 'vitest';
import { UFS } from '../uf';
import { aliquotaInterestadual } from './interstate';

/** Atalho: devolve só a alíquota ou falha o teste com a mensagem de erro. */
function aliquota(ufOrigem: string, ufDestino: string, origem: number): number {
  const r = aliquotaInterestadual(ufOrigem, ufDestino, origem);
  if (!r.ok) throw new Error(`Esperava resultado, veio erro: ${r.erro}`);
  return r.aliquota;
}

describe('aliquotaInterestadual — Resolução do Senado nº 22/1989 (origem da mercadoria 0)', () => {
  it.each([
    ['SP', 'BA', 7],
    ['MG', 'ES', 7],
    ['RS', 'DF', 7],
    ['SP', 'MG', 12],
    ['ES', 'SP', 12],
    ['ES', 'BA', 12],
    ['BA', 'SP', 12],
    ['TO', 'PA', 12],
    ['GO', 'MG', 12],
  ])('%s → %s = %i%%', (origem, destino, esperado) => {
    expect(aliquota(origem, destino, 0)).toBe(esperado);
  });

  it('ES como origem nunca resulta em 7%, para nenhum destino', () => {
    for (const destino of UFS) {
      if (destino === 'ES') continue;
      expect(aliquota('ES', destino, 0)).toBe(12);
    }
  });

  it('origens Norte, Nordeste e Centro-Oeste sempre resultam em 12%', () => {
    const norteNordesteCentroOeste = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'GO', 'MA', 'MT', 'MS',
      'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO',
    ];
    for (const origem of norteNordesteCentroOeste) {
      for (const destino of UFS) {
        if (destino === origem) continue;
        expect(aliquota(origem, destino, 0), `${origem} → ${destino}`).toBe(12);
      }
    }
  });

  it('confere todas as 702 rotas: 7% só de SP/RJ/MG/PR/SC/RS para fora desse grupo', () => {
    // Formulação independente da lista de 21 destinos do arquivo de dados:
    // "fora do grupo Sul/Sudeste sem ES" deve ser exatamente essa lista.
    const sulSudesteSemES = new Set(['SP', 'RJ', 'MG', 'PR', 'SC', 'RS']);
    let rotas = 0;
    for (const origem of UFS) {
      for (const destino of UFS) {
        if (origem === destino) continue;
        rotas++;
        const esperado = sulSudesteSemES.has(origem) && !sulSudesteSemES.has(destino) ? 7 : 12;
        expect(aliquota(origem, destino, 0), `${origem} → ${destino}`).toBe(esperado);
      }
    }
    expect(rotas).toBe(27 * 26);
  });
});

describe('aliquotaInterestadual — Resolução do Senado nº 13/2012 (importados)', () => {
  it.each([1, 2, 3, 8])('origem %i resulta em 4%% em SP → BA (rota que seria 7%%)', (origem) => {
    expect(aliquota('SP', 'BA', origem)).toBe(4);
  });

  it.each([1, 2, 3, 8])('origem %i resulta em 4%% em BA → SP (rota que seria 12%%)', (origem) => {
    expect(aliquota('BA', 'SP', origem)).toBe(4);
  });

  it.each([1, 2, 3, 8])('origem %i resulta em 4%% em todas as rotas interestaduais', (origem) => {
    for (const o of UFS) {
      for (const d of UFS) {
        if (o !== d) expect(aliquota(o, d, origem), `${o} → ${d}`).toBe(4);
      }
    }
  });

  it.each([0, 4, 5, 6, 7])('origem %i NÃO entra nos 4%%: SP → BA = 7%% e SP → MG = 12%%', (origem) => {
    expect(aliquota('SP', 'BA', origem)).toBe(7);
    expect(aliquota('SP', 'MG', origem)).toBe(12);
  });
});

describe('aliquotaInterestadual — memória de cálculo', () => {
  it('traz um passo com base legal, id e status da regra aplicada', () => {
    const r = aliquotaInterestadual('SP', 'BA', 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.memoria).toHaveLength(1);
    const passo = r.memoria[0]!;
    expect(passo.baseLegal).toContain('22/1989');
    expect(passo.regraId).toBe(r.regra.id);
    expect(passo.descricao).toContain('SP');
    expect(passo.descricao).toContain('BA');
    expect(passo.resultado).toBe('7%');
    // Nenhuma regra foi validada por contador ainda: o status precisa aparecer.
    expect(passo.status).toBe('nao_validado');
  });

  it('origem importada cita a Resolução nº 13/2012', () => {
    const r = aliquotaInterestadual('BA', 'SP', 1);
    expect(r.ok && r.memoria[0]!.baseLegal).toContain('13/2012');
  });
});

describe('aliquotaInterestadual — entradas inválidas geram erro claro (sem exceção)', () => {
  it('mesma UF de origem e destino não é operação interestadual', () => {
    const r = aliquotaInterestadual('SP', 'SP', 0);
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('interna') });
  });

  it('UF desconhecida', () => {
    const r = aliquotaInterestadual('XX', 'SP', 0);
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('"XX"') });
  });

  it('UF em minúsculas não é aceita silenciosamente', () => {
    expect(aliquotaInterestadual('sp', 'BA', 0).ok).toBe(false);
  });

  it.each([-1, 9, 1.5, Number.NaN])('origem da mercadoria %s fora de 0 a 8', (origem) => {
    const r = aliquotaInterestadual('SP', 'BA', origem);
    expect(r).toEqual({ ok: false, erro: expect.stringContaining('origem da mercadoria') });
  });
});
