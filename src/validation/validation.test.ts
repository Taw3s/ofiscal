import { describe, expect, it } from 'vitest';
import { escaparCampoCsv, registrosParaCsv } from './csv';
import { criarRegistro, resumir, type NovoRegistro } from './record';
import { CHAVE_REGISTROS, criarArmazenamento } from './storage';
import type { RegistroValidacao } from './types';

const ctx = { versaoRegras: 'regras-abc12345', agora: new Date('2026-04-01T12:00:00Z'), gerarId: () => 'id-1' };

const confere: NovoRegistro = {
  validadoPor: '  Contador Fictício  ',
  tipo: 'aliquota-interestadual',
  entrada: { ufOrigem: 'SP', ufDestino: 'BA', origemMercadoria: 0 },
  saida: { aliquota: 7, regraId: 'icms-interestadual-7-sul-sudeste-para-demais' },
  veredito: 'confere',
};

function registro(patch: Partial<NovoRegistro> = {}): RegistroValidacao {
  const r = criarRegistro({ ...confere, ...patch }, ctx);
  if (!r.ok) throw new Error(r.erros.join('\n'));
  return r.registro;
}

describe('criarRegistro', () => {
  it('guarda data, versão das regras, nome, entrada, saída e veredito', () => {
    expect(registro()).toEqual({
      id: 'id-1',
      data: '2026-04-01T12:00:00.000Z',
      versaoRegras: 'regras-abc12345',
      validadoPor: 'Contador Fictício',
      tipo: 'aliquota-interestadual',
      entrada: confere.entrada,
      saida: confere.saida,
      veredito: 'confere',
    });
  });

  it('exige nome de quem valida', () => {
    const r = criarRegistro({ ...confere, validadoPor: '   ' }, ctx);
    expect(r).toEqual({ ok: false, erros: ['Informe o nome de quem está validando.'] });
  });

  it('divergente exige valor esperado e comentário com base legal', () => {
    const r = criarRegistro({ ...confere, veredito: 'divergente' }, ctx);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erros).toHaveLength(2);
  });

  it('divergente completo é aceito', () => {
    const r = registro({ veredito: 'divergente', valorEsperado: '12', comentario: 'Art. X do RICMS fictício' });
    expect(r).toMatchObject({ veredito: 'divergente', valorEsperado: '12', comentario: 'Art. X do RICMS fictício' });
  });
});

describe('resumir', () => {
  it('sem registros, taxa de acerto é nula', () => {
    expect(resumir([])).toEqual({ total: 0, confere: 0, divergente: 0, taxaAcerto: null });
  });

  it('calcula taxa de acerto', () => {
    const d = registro({ veredito: 'divergente', valorEsperado: '12', comentario: 'x' });
    expect(resumir([registro(), registro(), registro(), d])).toEqual({ total: 4, confere: 3, divergente: 1, taxaAcerto: 0.75 });
  });
});

describe('CSV', () => {
  it.each([
    ['simples', 'simples'],
    ['com "aspas"', '"com ""aspas"""'],
    ['com; ponto e vírgula', '"com; ponto e vírgula"'],
    ['quebra\nde linha', '"quebra\nde linha"'],
    ['=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['+55', "'+55"],
    ['-1', "'-1"],
    ['@SOMA', "'@SOMA"],
  ])('escapa %j', (entrada, esperado) => {
    expect(escaparCampoCsv(entrada)).toBe(esperado);
  });

  it('gera cabeçalho e uma linha por registro, com CRLF', () => {
    const d = registro({ veredito: 'divergente', valorEsperado: '12', comentario: 'Conforme "art. 1º"; ver RICMS' });
    const csv = registrosParaCsv([registro(), d]);
    const linhas = csv.split('\r\n');
    expect(linhas[0]).toBe('data;versao_regras;validado_por;tipo;entrada;saida;veredito;valor_esperado;comentario');
    expect(linhas[1]).toBe(
      '2026-04-01T12:00:00.000Z;regras-abc12345;Contador Fictício;aliquota-interestadual;' +
        '"ufOrigem=SP, ufDestino=BA, origemMercadoria=0";' +
        '"aliquota=7, regraId=icms-interestadual-7-sul-sudeste-para-demais";Regra aplicada confere;;',
    );
    expect(linhas[2]).toMatch(/;Divergente;12;"Conforme ""art\. 1º""; ver RICMS"$/);
    expect(linhas).toHaveLength(4); // cabeçalho + 2 + linha vazia final
  });
});

/** Storage em memória que imita a API do localStorage. */
function memoria(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe('armazenamento local', () => {
  it('salva, carrega e apaga', () => {
    const s = memoria();
    const a = criarArmazenamento(() => s);
    expect(a.carregar()).toEqual({ ok: true, valor: [] });
    expect(a.salvar([registro()]).ok).toBe(true);
    expect(a.carregar()).toEqual({ ok: true, valor: [registro()] });
    expect(a.apagar().ok).toBe(true);
    expect(a.carregar()).toEqual({ ok: true, valor: [] });
  });

  it('localStorage bloqueado (exceção ao acessar) vira mensagem, não erro', () => {
    const a = criarArmazenamento(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    const r = a.carregar();
    expect(r.ok).toBe(false);
    expect(!r.ok && r.erro).toContain('bloqueou o armazenamento local');
    expect(a.salvar([]).ok).toBe(false);
    expect(a.apagar().ok).toBe(false);
    expect(a.lerNome()).toBe('');
    expect(() => a.gravarNome('x')).not.toThrow();
  });

  it('cota cheia tem mensagem própria', () => {
    const s = memoria();
    s.setItem = () => {
      throw new DOMException('cheio', 'QuotaExceededError');
    };
    const r = criarArmazenamento(() => s).salvar([registro()]);
    expect(!r.ok && r.erro).toContain('está cheio');
  });

  it('dados corrompidos não derrubam a página', () => {
    const s = memoria();
    s.setItem(CHAVE_REGISTROS, '{isto não é json');
    const r = criarArmazenamento(() => s).carregar();
    expect(!r.ok && r.erro).toContain('corrompidos');

    s.setItem(CHAVE_REGISTROS, JSON.stringify([{ id: 'x' }]));
    expect(criarArmazenamento(() => s).carregar().ok).toBe(false);
  });

  it('lembra o nome de quem valida', () => {
    const s = memoria();
    const a = criarArmazenamento(() => s);
    a.gravarNome('Contador Fictício');
    expect(a.lerNome()).toBe('Contador Fictício');
  });
});
