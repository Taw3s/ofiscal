import { useId, useState, type FormEvent } from 'react';
import type { NovoRegistro } from '../validation/record';
import type { Veredicto } from '../validation/types';
import { VEREDICTO_LABEL } from '../validation/types';

type DadosFormulario = Pick<NovoRegistro, 'validadoPor' | 'veredito' | 'valorEsperado' | 'comentario'>;

interface Props {
  nomeInicial: string;
  /** Devolve a lista de erros; vazia quando o registro foi salvo. */
  onRegistrar: (dados: DadosFormulario) => string[];
}

export function ValidationForm({ nomeInicial, onRegistrar }: Props) {
  const id = useId();
  const [nome, setNome] = useState(nomeInicial);
  const [veredito, setVeredito] = useState<Veredicto | ''>('');
  const [valorEsperado, setValorEsperado] = useState('');
  const [comentario, setComentario] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!veredito) {
      setErros(['Escolha "Regra aplicada confere" ou "Divergente".']);
      return;
    }
    const resultado = onRegistrar({
      validadoPor: nome,
      veredito,
      ...(veredito === 'divergente' ? { valorEsperado, comentario } : {}),
    });
    setErros(resultado);
    setSalvo(resultado.length === 0);
  }

  if (salvo) {
    return (
      <p className="sucesso" role="status">
        Validação registrada. Ela aparece no registro de validações abaixo.
      </p>
    );
  }

  return (
    <form className="validacao" onSubmit={enviar} noValidate aria-labelledby={`${id}-titulo`}>
      <h3 id={`${id}-titulo`}>Validação do contador</h3>
      <div className="campo">
        <label htmlFor={`${id}-nome`}>Nome de quem está validando</label>
        <input id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
      </div>
      <fieldset>
        <legend>Veredito</legend>
        {(['confere', 'divergente'] as const).map((v) => (
          <label key={v} className="opcao">
            <input
              type="radio"
              name={`${id}-veredito`}
              value={v}
              checked={veredito === v}
              onChange={() => setVeredito(v)}
            />{' '}
            {VEREDICTO_LABEL[v]}
          </label>
        ))}
      </fieldset>
      {veredito === 'divergente' && (
        <>
          <div className="campo">
            <label htmlFor={`${id}-esperado`}>Valor esperado</label>
            <input
              id={`${id}-esperado`}
              value={valorEsperado}
              onChange={(e) => setValorEsperado(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="campo">
            <label htmlFor={`${id}-comentario`}>Comentário com a base legal</label>
            <textarea
              id={`${id}-comentario`}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
            />
          </div>
        </>
      )}
      {erros.length > 0 && (
        <ul className="erro" role="alert">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button type="submit" className="botao">
        Registrar validação
      </button>
    </form>
  );
}
