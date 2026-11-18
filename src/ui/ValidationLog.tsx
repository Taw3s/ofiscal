import { useState } from 'react';
import { registrosParaCsv } from '../validation/csv';
import { resumir } from '../validation/record';
import type { RegistroValidacao } from '../validation/types';
import { VEREDICTO_LABEL } from '../validation/types';

interface Props {
  registros: readonly RegistroValidacao[];
  onApagar: () => void;
}

function baixarCsv(registros: readonly RegistroValidacao[]) {
  // BOM no início para o Excel reconhecer UTF-8 (acentos).
  const blob = new Blob(['﻿', registrosParaCsv(registros)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const formatarData = (iso: string) => new Date(iso).toLocaleString('pt-BR');
const formatarCampos = (c: RegistroValidacao['entrada']) =>
  Object.entries(c)
    .map(([k, v]) => `${k}: ${v ?? '—'}`)
    .join(' · ');

export function ValidationLog({ registros, onApagar }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const resumo = resumir(registros);
  const taxa =
    resumo.taxaAcerto === null
      ? '—'
      : resumo.taxaAcerto.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

  return (
    <section aria-labelledby="titulo-registro" className="card">
      <h2 id="titulo-registro">Registro de validações</h2>
      <dl className="resumo">
        <div>
          <dt>Total de registros</dt>
          <dd data-testid="total-registros">{resumo.total}</dd>
        </div>
        <div>
          <dt>Taxa de acerto</dt>
          <dd data-testid="taxa-acerto">{taxa}</dd>
        </div>
        <div>
          <dt>Confere / divergente</dt>
          <dd>
            {resumo.confere} / {resumo.divergente}
          </dd>
        </div>
      </dl>
      <p className="ajuda">
        Taxa de acerto = registros “regra aplicada confere” ÷ total de registros. Os registros ficam guardados só neste
        navegador.
      </p>

      <div className="acoes">
        <button
          type="button"
          className="botao"
          onClick={() => baixarCsv(registros)}
          disabled={registros.length === 0}
        >
          Exportar CSV
        </button>
        {!confirmando ? (
          <button
            type="button"
            className="botao botao--perigo"
            onClick={() => setConfirmando(true)}
            disabled={registros.length === 0}
          >
            Apagar registros
          </button>
        ) : (
          <span className="confirmacao" role="group" aria-label="Confirmar exclusão">
            <span>Apagar todos os {registros.length} registros? Não dá para desfazer.</span>
            <button
              type="button"
              className="botao botao--perigo"
              onClick={() => {
                onApagar();
                setConfirmando(false);
              }}
            >
              Sim, apagar
            </button>
            <button type="button" className="botao botao--secundario" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </span>
        )}
      </div>

      {registros.length > 0 && (
        <div className="tabela-rolagem" role="region" aria-label="Registros de validação" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Quem validou</th>
                <th scope="col">Entrada</th>
                <th scope="col">Saída</th>
                <th scope="col">Veredito</th>
                <th scope="col">Valor esperado</th>
                <th scope="col">Comentário</th>
                <th scope="col">Versão das regras</th>
              </tr>
            </thead>
            <tbody>
              {[...registros].reverse().map((r) => (
                <tr key={r.id}>
                  <td>{formatarData(r.data)}</td>
                  <td>{r.validadoPor}</td>
                  <td>{formatarCampos(r.entrada)}</td>
                  <td>{formatarCampos(r.saida)}</td>
                  <td>{VEREDICTO_LABEL[r.veredito]}</td>
                  <td>{r.valorEsperado ?? '—'}</td>
                  <td>{r.comentario ?? '—'}</td>
                  <td className="mono">{r.versaoRegras}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
