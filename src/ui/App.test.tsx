import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import xmlA from '../domain/nfe/__fixtures__/a-interna-to-icms41.xml?raw';
import xmlB from '../domain/nfe/__fixtures__/b-interestadual-to-pa-3-itens.xml?raw';
import xmlC from '../domain/nfe/__fixtures__/c-simples-nacional-sn101.xml?raw';
import { criarArmazenamento } from '../validation/storage';
import { App } from './App';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const arquivo = (nome: string, conteudo: string) => new File([conteudo], nome, { type: 'text/xml' });

function linhasDaNota(numero: number): HTMLElement[] {
  const regiao = screen.getByRole('region', { name: `Itens da nota ${numero}` });
  return within(regiao).getAllByRole('row').slice(1); // sem o cabeçalho
}

describe('Laboratório', () => {
  it('mostra a faixa de versão de teste', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent('Versão de teste. Regras ainda não validadas por contador.');
  });

  it('importa as três fixtures e mostra os campos por item', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText('Escolher arquivos XML'), [
      arquivo('a.xml', xmlA),
      arquivo('b.xml', xmlB),
      arquivo('c.xml', xmlC),
    ]);
    await screen.findByText('3 arquivo(s) lido(s): 3 com sucesso, 0 com erro.');

    const [a1] = linhasDaNota(101);
    expect(a1).toHaveTextContent('84791090');
    expect(a1).toHaveTextContent('5102');
    expect(a1).toHaveTextContent('ICMS40');
    expect(a1).toHaveTextContent('CST 41');

    const b = linhasDaNota(102);
    expect(b).toHaveLength(3);
    expect(b[0]).toHaveTextContent('Alíq. 12%');
    expect(b[0]).toHaveTextContent('Alíq. 0,65%');
    expect(b[0]).toHaveTextContent('Alíq. 3%');
    expect(b[2]).toHaveTextContent('1200300');
    expect(b[2]).toHaveTextContent('85359090');
    expect(b[2]).toHaveTextContent('cClassTrib 000001');

    const [c1] = linhasDaNota(501);
    expect(c1).toHaveTextContent('CSOSN 101');
    expect(c1).toHaveTextContent('pCredSN 3,12%');
    expect(c1).toHaveTextContent('vCredICMSSN 31,2');
    expect(c1).toHaveTextContent('Outr · CST 49');

    // Nenhum identificador do emitente/destinatário na tela.
    expect(document.body).not.toHaveTextContent('11222333000181');
    expect(document.body).not.toHaveTextContent('FICTICIA DE MAQUINAS');
  });

  it('mostra erro claro para arquivo inválido sem quebrar os outros', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText('Escolher arquivos XML'), [
      arquivo('ruim.xml', '<isto nao e xml'),
      arquivo('a.xml', xmlA),
    ]);
    await screen.findByText('2 arquivo(s) lido(s): 1 com sucesso, 1 com erro.');
    expect(screen.getByRole('alert')).toHaveTextContent('não é um XML válido');
  });

  it('calcula a alíquota, mostra memória, base legal e status, e registra validação', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('UF de origem'), 'SP');
    await user.selectOptions(screen.getByLabelText('UF de destino'), 'BA');
    await user.selectOptions(screen.getByLabelText('Origem da mercadoria (1º dígito do CST)'), '0');
    await user.click(screen.getByRole('button', { name: 'Calcular' }));

    expect(screen.getByText(/Regra aplicada:/)).toHaveTextContent('Regra aplicada: 7%');
    expect(screen.getByText(/Base legal:/).parentElement).toHaveTextContent('22/1989');
    expect(screen.getByText('Não validada')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/correto/i);

    // Divergente exige valor esperado e comentário.
    await user.type(screen.getByLabelText('Nome de quem está validando'), 'Contador Fictício');
    await user.click(screen.getByLabelText('Divergente'));
    await user.click(screen.getByRole('button', { name: 'Registrar validação' }));
    expect(screen.getByRole('alert')).toHaveTextContent('informe o valor esperado');

    await user.type(screen.getByLabelText('Valor esperado'), '12');
    await user.type(screen.getByLabelText('Comentário com a base legal'), 'Teste "com aspas"; e ponto e vírgula');
    await user.click(screen.getByRole('button', { name: 'Registrar validação' }));
    await screen.findByText(/Validação registrada/);

    expect(screen.getByTestId('total-registros')).toHaveTextContent('1');
    expect(screen.getByTestId('taxa-acerto')).toHaveTextContent('0%');

    // Novo cálculo, agora "confere".
    await user.selectOptions(screen.getByLabelText('UF de destino'), 'MG');
    await user.click(screen.getByRole('button', { name: 'Calcular' }));
    expect(screen.getByText(/Regra aplicada:/)).toHaveTextContent('12%');
    expect(screen.getByLabelText('Nome de quem está validando')).toHaveValue('Contador Fictício');
    await user.click(screen.getByLabelText('Regra aplicada confere'));
    await user.click(screen.getByRole('button', { name: 'Registrar validação' }));
    await waitFor(() => expect(screen.getByTestId('total-registros')).toHaveTextContent('2'));
    expect(screen.getByTestId('taxa-acerto')).toHaveTextContent('50%');

    // Persistiu no localStorage.
    const salvo = criarArmazenamento().carregar();
    expect(salvo.ok && salvo.valor.map((r) => r.veredito)).toEqual(['divergente', 'confere']);

    // Apagar pede confirmação.
    await user.click(screen.getByRole('button', { name: 'Apagar registros' }));
    await user.click(screen.getByRole('button', { name: 'Sim, apagar' }));
    expect(screen.getByTestId('total-registros')).toHaveTextContent('0');
    expect(criarArmazenamento().carregar()).toEqual({ ok: true, valor: [] });
  });

  it('mesma UF mostra erro de operação interna', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.selectOptions(screen.getByLabelText('UF de origem'), 'TO');
    await user.selectOptions(screen.getByLabelText('UF de destino'), 'TO');
    await user.selectOptions(screen.getByLabelText('Origem da mercadoria (1º dígito do CST)'), '0');
    await user.click(screen.getByRole('button', { name: 'Calcular' }));
    expect(screen.getByRole('alert')).toHaveTextContent('operação é interna');
  });

  it('avisa quando o armazenamento local está bloqueado, e continua funcionando', () => {
    const bloqueado = criarArmazenamento(() => {
      throw new DOMException('bloqueado', 'SecurityError');
    });
    render(<App armazenamento={bloqueado} />);
    expect(screen.getByRole('alert')).toHaveTextContent('bloqueou o armazenamento local');
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled();
  });
});
