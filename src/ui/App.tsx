import { useMemo, useState } from 'react';
import { RULES_VERSION } from '../data';
import { criarRegistro, type NovoRegistro } from '../validation/record';
import { criarArmazenamento, type Armazenamento } from '../validation/storage';
import type { RegistroValidacao } from '../validation/types';
import { InterstateCalculator } from './InterstateCalculator';
import { ValidationLog } from './ValidationLog';
import { XmlImport } from './XmlImport';

function gerarId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function App({ armazenamento: externo }: { armazenamento?: Armazenamento }) {
  const armazenamento = useMemo(() => externo ?? criarArmazenamento(), [externo]);
  const [inicial] = useState(() => armazenamento.carregar());
  const [registros, setRegistros] = useState<RegistroValidacao[]>(inicial.ok ? inicial.valor : []);
  const [avisoArmazenamento, setAvisoArmazenamento] = useState<string | null>(inicial.ok ? null : inicial.erro);
  const [nome, setNome] = useState(() => armazenamento.lerNome());

  function registrar(novo: NovoRegistro): string[] {
    const r = criarRegistro(novo, { versaoRegras: RULES_VERSION, agora: new Date(), gerarId });
    if (!r.ok) return r.erros;
    const proximos = [...registros, r.registro];
    setRegistros(proximos);
    const salvo = armazenamento.salvar(proximos);
    setAvisoArmazenamento(salvo.ok ? null : salvo.erro);
    armazenamento.gravarNome(r.registro.validadoPor);
    setNome(r.registro.validadoPor);
    return [];
  }

  function apagar() {
    setRegistros([]);
    const r = armazenamento.apagar();
    setAvisoArmazenamento(r.ok ? null : r.erro);
  }

  return (
    <>
      <div className="faixa-teste" role="note">
        Versão de teste. Regras ainda não validadas por contador.
      </div>
      <header className="topo">
        <h1>Laboratório fiscal</h1>
        <p className="ajuda">
          A ferramenta sugere, o contador decide. Versão das regras: <code>{RULES_VERSION}</code>
        </p>
      </header>
      <main className="conteudo">
        {avisoArmazenamento && (
          <p className="aviso" role="alert">
            {avisoArmazenamento}
          </p>
        )}
        <XmlImport />
        <InterstateCalculator nomeInicial={nome} onRegistrar={registrar} />
        <ValidationLog registros={registros} onApagar={apagar} />
      </main>
    </>
  );
}
