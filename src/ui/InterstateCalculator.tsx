import { useState, type FormEvent } from 'react';
import { aliquotaInterestadual, type ResultadoAliquotaInterestadual } from '../domain/icms/interstate';
import { UFS } from '../domain/uf';
import type { NovoRegistro } from '../validation/record';
import { StatusRegra } from './StatusRegra';
import { ValidationForm } from './ValidationForm';

interface Props {
  nomeInicial: string;
  onRegistrar: (novo: NovoRegistro) => string[];
}

interface Calculo {
  entrada: { ufOrigem: string; ufDestino: string; origemMercadoria: number };
  resultado: ResultadoAliquotaInterestadual;
  /** Muda a cada cálculo, para reiniciar o formulário de validação. */
  chave: number;
}

export function InterstateCalculator({ nomeInicial, onRegistrar }: Props) {
  const [ufOrigem, setUfOrigem] = useState('');
  const [ufDestino, setUfDestino] = useState('');
  const [origem, setOrigem] = useState('');
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);

  function calcular(e: FormEvent) {
    e.preventDefault();
    if (!ufOrigem || !ufDestino || origem === '') {
      setErroForm('Preencha UF de origem, UF de destino e origem da mercadoria.');
      setCalculo(null);
      return;
    }
    setErroForm(null);
    const entrada = { ufOrigem, ufDestino, origemMercadoria: Number(origem) };
    setCalculo((c) => ({
      entrada,
      resultado: aliquotaInterestadual(entrada.ufOrigem, entrada.ufDestino, entrada.origemMercadoria),
      chave: (c?.chave ?? 0) + 1,
    }));
  }

  return (
    <section aria-labelledby="titulo-interestadual" className="card">
      <h2 id="titulo-interestadual">Alíquota interestadual de ICMS</h2>
      <form className="form-linha" onSubmit={calcular} noValidate>
        <div className="campo">
          <label htmlFor="uf-origem">UF de origem</label>
          <select id="uf-origem" value={ufOrigem} onChange={(e) => setUfOrigem(e.target.value)}>
            <option value="">Selecione</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="uf-destino">UF de destino</label>
          <select id="uf-destino" value={ufDestino} onChange={(e) => setUfDestino(e.target.value)}>
            <option value="">Selecione</option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="origem-mercadoria">Origem da mercadoria (1º dígito do CST)</label>
          <select id="origem-mercadoria" value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Selecione</option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="botao">
          Calcular
        </button>
      </form>

      <div aria-live="polite">
        {erroForm && (
          <p className="erro" role="alert">
            {erroForm}
          </p>
        )}
        {calculo && !calculo.resultado.ok && (
          <p className="erro" role="alert">
            {calculo.resultado.erro}
          </p>
        )}
        {calculo && calculo.resultado.ok && (
          <div className="resultado">
            <p className="resultado__titulo">
              Regra aplicada: <strong className="resultado__valor">{calculo.resultado.aliquota}%</strong>
            </p>
            <StatusRegra status={calculo.resultado.regra.status} />
            <h3>Memória de cálculo</h3>
            <ol className="memoria">
              {calculo.resultado.memoria.map((p, i) => (
                <li key={i}>
                  <p>{p.descricao}</p>
                  <p>
                    <strong>Resultado:</strong> {p.resultado}
                  </p>
                  <p>
                    <strong>Base legal:</strong> {p.baseLegal}
                  </p>
                  <p className="ajuda">
                    Regra <code>{p.regraId}</code>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {calculo && calculo.resultado.ok && (
        <ValidationForm
          key={calculo.chave}
          nomeInicial={nomeInicial}
          onRegistrar={(v) => {
            const r = calculo.resultado;
            if (!r.ok) return ['Não há resultado para validar.'];
            return onRegistrar({
              ...v,
              tipo: 'aliquota-interestadual',
              entrada: calculo.entrada,
              saida: { aliquota: r.aliquota, regraId: r.regra.id, statusRegra: r.regra.status },
            });
          }}
        />
      )}
    </section>
  );
}
