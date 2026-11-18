import { describe, expect, it } from 'vitest';
import xmlA from './__fixtures__/a-interna-to-icms41.xml?raw';
import xmlB from './__fixtures__/b-interestadual-to-pa-3-itens.xml?raw';
import xmlC from './__fixtures__/c-simples-nacional-sn101.xml?raw';
import { lerNFe, mascararChave } from './parse';
import type { NotaFiscal } from './types';

function ler(xml: string): NotaFiscal {
  const r = lerNFe(xml);
  if (!r.ok) throw new Error(`Esperava leitura ok, vieram erros:\n${r.erros.join('\n')}`);
  return r.nota;
}

function erros(xml: string): string[] {
  const r = lerNFe(xml);
  if (r.ok) throw new Error('Esperava erro de leitura, mas a nota foi lida.');
  return r.erros;
}

describe('Fixture A — interna TO, ICMS40 com CST 41, órgão público', () => {
  const nota = ler(xmlA);

  it('cabeçalho', () => {
    expect(nota).toMatchObject({
      chave: '172603**************550010000001011123456786',
      numero: 101,
      emissao: '2026-03-10T10:15:00-03:00',
      finalidade: 1,
      naturezaOperacao: 'VENDA DE MERCADORIA',
      idDest: 1,
      indFinal: 1,
    });
  });

  it('emitente e destinatário só com UF, CRT, CNAE e indIEDest', () => {
    expect(nota.emitente).toEqual({ uf: 'TO', crt: 3, cnae: '4669999' });
    expect(nota.destinatario).toEqual({ uf: 'TO', indIEDest: 9 });
  });

  it('um item, com todos os campos', () => {
    expect(nota.itens).toEqual([
      {
        numeroItem: 1,
        codigoProduto: 'MAQ-001',
        descricao: 'MAQUINA FICTICIA DE TESTE',
        ncm: '84791090',
        cfop: '5102',
        origem: 0,
        icms: { grupo: 'ICMS40', regime: 'normal', cst: '41' },
        pis: { grupo: 'Aliq', cst: '01', vBC: 3500, aliquota: 0, valor: 0 },
        cofins: { grupo: 'Aliq', cst: '01', vBC: 3500, aliquota: 0, valor: 0 },
      },
    ]);
  });
});

describe('Fixture B — interestadual TO → PA, três itens, com IBSCBS', () => {
  const nota = ler(xmlB);

  it('cabeçalho, emitente e destinatário', () => {
    expect(nota).toMatchObject({ numero: 102, idDest: 2, indFinal: 0, finalidade: 1 });
    expect(nota.emitente).toEqual({ uf: 'TO', crt: 3, cnae: '4669999' });
    expect(nota.destinatario).toEqual({ uf: 'PA', indIEDest: 1 });
  });

  it('três itens com CFOP 6949 e ICMS00 (CST 00, origem 0, modBC 3, 12%)', () => {
    expect(nota.itens).toHaveLength(3);
    const valores = [1000, 500, 250];
    nota.itens.forEach((item, i) => {
      expect(item.numeroItem).toBe(i + 1);
      expect(item.cfop).toBe('6949');
      expect(item.origem).toBe(0);
      expect(item.icms).toEqual({
        grupo: 'ICMS00',
        regime: 'normal',
        cst: '00',
        modBC: 3,
        vBC: valores[i],
        pICMS: 12,
        vICMS: valores[i]! * 0.12,
      });
    });
  });

  it('item 1 com PIS 0,65% e COFINS 3%', () => {
    const item = nota.itens[0]!;
    expect(item.pis).toEqual({ grupo: 'Aliq', cst: '01', vBC: 1000, aliquota: 0.65, valor: 6.5 });
    expect(item.cofins).toEqual({ grupo: 'Aliq', cst: '01', vBC: 1000, aliquota: 3, valor: 30 });
  });

  it('itens 2 e 3 com PIS e COFINS zerados', () => {
    for (const item of nota.itens.slice(1)) {
      expect(item.pis).toMatchObject({ aliquota: 0, valor: 0 });
      expect(item.cofins).toMatchObject({ aliquota: 0, valor: 0 });
    }
  });

  it('só o item 3 tem CEST (12.003.00) e NCM 85359090', () => {
    expect(nota.itens[0]!.cest).toBeUndefined();
    expect(nota.itens[1]!.cest).toBeUndefined();
    expect(nota.itens[2]).toMatchObject({ cest: '1200300', ncm: '85359090' });
  });

  it('IBSCBS: CST 000, cClassTrib 000001, base = item − ICMS − PIS − COFINS', () => {
    const esperado = [
      { vBC: 843.5, vIBS: 0.84, vCBS: 7.59 }, // 1000 − 120 − 6,50 − 30
      { vBC: 440, vIBS: 0.44, vCBS: 3.96 }, //   500 −  60
      { vBC: 220, vIBS: 0.22, vCBS: 1.98 }, //   250 −  30
    ];
    nota.itens.forEach((item, i) => {
      expect(item.ibscbs).toEqual({ cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pCBS: 0.9, ...esperado[i] });
    });
  });
});

describe('Fixture C — Simples Nacional, ICMSSN101', () => {
  const nota = ler(xmlC);

  it('emitente CRT 1, sem CNAE (o XML não traz)', () => {
    expect(nota.emitente).toEqual({ uf: 'MG', crt: 1 });
    expect(nota.destinatario).toEqual({ uf: 'MG', indIEDest: 1 });
  });

  it('ICMSSN101 com CSOSN, pCredSN 3,12 e vCredICMSSN calculado', () => {
    const item = nota.itens[0]!;
    expect(item.icms).toEqual({ grupo: 'ICMSSN101', regime: 'simples', csosn: '101', pCredSN: 3.12, vCredICMSSN: 31.2 });
    expect(item.icms).not.toHaveProperty('cst');
    expect(item.origem).toBe(0);
  });

  it('PIS e COFINS no grupo Outr com CST 49 e alíquota 0', () => {
    const item = nota.itens[0]!;
    expect(item.pis).toEqual({ grupo: 'Outr', cst: '49', vBC: 0, aliquota: 0, valor: 0 });
    expect(item.cofins).toEqual({ grupo: 'Outr', cst: '49', vBC: 0, aliquota: 0, valor: 0 });
  });
});

describe('Privacidade: nenhum identificador pessoal sai do parser', () => {
  // Valores que estão nas fixtures e NÃO podem aparecer na saída.
  const proibidos = [
    // CNPJs e CPF
    '11222333000181', '99888777000100', '22333444000181', '44555666000181', '12345678909',
    // Inscrições estaduais
    '290000001', '150000001', '0010000010001', '0020000020002',
    // Nomes
    'EMPRESA FICTICIA', 'ORGAO PUBLICO', 'DISTRIBUIDORA', 'COMERCIO FICTICIO', 'PRODUTOR RURAL', 'Fulano',
    // Endereços
    'RUA DOS TESTES', 'AVENIDA', 'TRAVESSA', 'ESTRADA', 'PALMAS', 'BELEM', 'BELO HORIZONTE', '77000000',
    // Telefones e e-mails
    '63999990000', '63988880000', '91977770000', '31966660000', '31955550000', '@', '.example',
  ];

  it.each([
    ['A', xmlA],
    ['B', xmlB],
    ['C', xmlC],
  ])('fixture %s', (_nome, xml) => {
    const saida = JSON.stringify(ler(xml));
    for (const p of proibidos) expect(saida, `"${p}" vazou na saída`).not.toContain(p);
  });

  it('emitente e destinatário têm só os campos permitidos', () => {
    for (const xml of [xmlA, xmlB, xmlC]) {
      const nota = ler(xml);
      expect(Object.keys(nota.emitente).every((k) => ['uf', 'crt', 'cnae'].includes(k))).toBe(true);
      expect(Object.keys(nota.destinatario).sort()).toEqual(['indIEDest', 'uf']);
    }
  });

  it('a chave sai com o CNPJ do emitente mascarado', () => {
    expect(mascararChave('17260311222333000181550010000001011123456786')).toBe(
      '172603**************550010000001011123456786',
    );
  });
});

// ---------------------------------------------------------------------------
// Erros: devem dizer o que faltou e em qual item.

/** Aplica uma troca de texto na fixture e garante que ela de fato aconteceu. */
function alterar(xml: string, de: string | RegExp, para: string): string {
  const novo = xml.replace(de, para);
  if (novo === xml) throw new Error(`Trecho não encontrado na fixture: ${String(de)}`);
  return novo;
}

describe('Mensagens de erro', () => {
  it('XML vazio', () => {
    expect(erros('   ')).toEqual(['O arquivo está vazio.']);
  });

  it('XML malformado', () => {
    expect(erros('<nfeProc><NFe>')[0]).toContain('não é um XML válido');
  });

  it('raiz errada', () => {
    expect(erros('<?xml version="1.0"?><qualquer/>')[0]).toContain('<nfeProc>');
  });

  it('NF-e sem protocolo sugere usar o procNFe', () => {
    expect(erros('<NFe xmlns="http://www.portalfiscal.inf.br/nfe"/>')[0]).toContain('procNFe');
  });

  it('namespace ausente é recusado', () => {
    const semNs = xmlA.replaceAll(' xmlns="http://www.portalfiscal.inf.br/nfe"', '');
    expect(erros(semNs)[0]).toContain('sem namespace');
  });

  it('versão diferente de 4.00', () => {
    expect(erros(alterar(xmlA, 'versao="4.00">\n      <ide>', 'versao="3.10">\n      <ide>'))[0]).toContain('3.10');
  });

  it('NCM ausente no item 2 aponta o item e o elemento', () => {
    const xml = alterar(xmlB, '<NCM>85362000</NCM>', '');
    expect(erros(xml)).toEqual(['Item 2: elemento <NCM> não encontrado ou vazio dentro de <prod>.']);
  });

  it('vários problemas são listados juntos', () => {
    let xml = alterar(xmlB, '<CFOP>6949</CFOP>', '');
    xml = alterar(xml, /<CST>00<\/CST>([\s\S]*?<CST>00<\/CST>)([\s\S]*?)<CST>00<\/CST>/, '<CST>00</CST>$1$2');
    const e = erros(xml);
    expect(e).toContain('Item 1: elemento <CFOP> não encontrado ou vazio dentro de <prod>.');
    expect(e).toContain('Item 3: elemento <CST> não encontrado ou vazio dentro de <ICMS00>.');
  });

  it('grupo de ICMS não suportado', () => {
    const xml = alterar(xmlA, /ICMS40>/g, 'ICMS61>');
    expect(erros(xml)[0]).toMatch(/^Item 1: grupo de ICMS <ICMS61> não é suportado/);
  });

  it('número com vírgula é recusado com mensagem clara', () => {
    const xml = alterar(xmlB, '<pICMS>12.0000</pICMS>', '<pICMS>12,00</pICMS>');
    expect(erros(xml)).toEqual(['Item 1: <pICMS> em <ICMS00> deveria ser número (com ponto decimal), mas veio "12,00".']);
  });

  it('código fora do leiaute (idDest = 5)', () => {
    const xml = alterar(xmlA, '<idDest>1</idDest>', '<idDest>5</idDest>');
    expect(erros(xml)).toEqual(['Nota: <idDest> com valor 5; valores aceitos pelo leiaute: 1, 2, 3.']);
  });

  it('origem da mercadoria fora de 0 a 8', () => {
    const xml = alterar(xmlA, '<orig>0</orig>', '<orig>9</orig>');
    expect(erros(xml)[0]).toContain('Item 1: <orig> com valor 9');
  });

  it('chave do protocolo diferente da chave da nota', () => {
    const xml = alterar(xmlA, '<chNFe>17260311222333000181550010000001011123456786', '<chNFe>17260311222333000181550010000001011123456787');
    expect(erros(xml)[0]).toContain('chave em <infProt><chNFe> é diferente');
  });

  it('PIS em grupo desconhecido', () => {
    const xml = alterar(xmlA, /PISAliq>/g, 'PISST>');
    expect(erros(xml)[0]).toContain('Item 1: grupo de PIS não suportado: encontrado <PISST>');
  });

  it('NFC-e (modelo 65) é recusada', () => {
    const xml = alterar(xmlA, '<mod>55</mod>', '<mod>65</mod>');
    expect(erros(xml)[0]).toContain('modelo 65');
  });
});

describe('Grupos que não aparecem nas fixtures', () => {
  /** Troca o bloco <imposto> do item da fixture A por outro conteúdo. */
  const comImposto = (imposto: string) => alterar(xmlA, /<imposto>[\s\S]*<\/imposto>/, `<imposto>${imposto}</imposto>`);
  const icms40 = '<ICMS><ICMS40><orig>0</orig><CST>41</CST></ICMS40></ICMS>';
  const cofinsNT = '<COFINS><COFINSNT><CST>06</CST></COFINSNT></COFINS>';

  it('PIS por quantidade (PISQtde)', () => {
    const nota = ler(
      comImposto(`${icms40}<PIS><PISQtde><CST>03</CST><qBCProd>100.0000</qBCProd><vAliqProd>0.1500</vAliqProd><vPIS>15.00</vPIS></PISQtde></PIS>${cofinsNT}`),
    );
    expect(nota.itens[0]!.pis).toEqual({ grupo: 'Qtde', cst: '03', quantidadeBC: 100, aliquotaPorUnidade: 0.15, valor: 15 });
    expect(nota.itens[0]!.cofins).toEqual({ grupo: 'NT', cst: '06' });
  });

  it('IPI tributado', () => {
    const nota = ler(
      comImposto(
        `${icms40}<IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>100.00</vBC><pIPI>5.0000</pIPI><vIPI>5.00</vIPI></IPITrib></IPI>` +
          `<PIS><PISNT><CST>06</CST></PISNT></PIS>${cofinsNT}`,
      ),
    );
    expect(nota.itens[0]!.ipi).toEqual({ cst: '50', vBC: 100, aliquota: 5, valor: 5 });
  });

  it('IBSCBS sem grupo de valores (gIBSCBS)', () => {
    const nota = ler(
      comImposto(
        `${icms40}<PIS><PISNT><CST>06</CST></PISNT></PIS>${cofinsNT}<IBSCBS><CST>410</CST><cClassTrib>410001</cClassTrib></IBSCBS>`,
      ),
    );
    expect(nota.itens[0]!.ibscbs).toEqual({ cst: '410', cClassTrib: '410001' });
  });

  it.each(['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90'])('aceita o grupo %s', (grupo) => {
    const nota = ler(
      comImposto(`<ICMS><${grupo}><orig>2</orig><CST>${grupo.slice(4)}</CST></${grupo}></ICMS><PIS><PISNT><CST>06</CST></PISNT></PIS>${cofinsNT}`),
    );
    expect(nota.itens[0]!.icms).toEqual({ grupo, regime: 'normal', cst: grupo.slice(4) });
    expect(nota.itens[0]!.origem).toBe(2);
  });

  it.each(['ICMSSN102', 'ICMSSN201', 'ICMSSN202', 'ICMSSN500', 'ICMSSN900'])('aceita o grupo %s', (grupo) => {
    const nota = ler(
      comImposto(`<ICMS><${grupo}><orig>0</orig><CSOSN>${grupo.slice(6)}</CSOSN></${grupo}></ICMS><PIS><PISNT><CST>06</CST></PISNT></PIS>${cofinsNT}`),
    );
    expect(nota.itens[0]!.icms).toEqual({ grupo, regime: 'simples', csosn: grupo.slice(6) });
  });
});
