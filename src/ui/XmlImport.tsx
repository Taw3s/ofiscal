import { useId, useRef, useState, type DragEvent } from 'react';
import { lerNFe } from '../domain/nfe/parse';
import type { ItemNotaFiscal, NotaFiscal, ResultadoLeituraNFe } from '../domain/nfe/types';
import {
  CRT_LABEL,
  FINALIDADE_LABEL,
  ID_DEST_LABEL,
  IND_FINAL_LABEL,
  IND_IE_DEST_LABEL,
  numeroBR,
  rotulo,
} from './labels';

/** Limite por arquivo para não travar o navegador com algo que não é NF-e. */
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

interface ArquivoLido {
  id: number;
  nome: string;
  resultado: ResultadoLeituraNFe;
}

async function lerArquivo(file: File): Promise<ResultadoLeituraNFe> {
  if (file.size > TAMANHO_MAXIMO) {
    return { ok: false, erros: [`Arquivo maior que ${TAMANHO_MAXIMO / 1024 / 1024} MB; não parece ser uma NF-e.`] };
  }
  try {
    return lerNFe(await file.text());
  } catch {
    return { ok: false, erros: ['Não foi possível ler o arquivo do disco.'] };
  }
}

export function XmlImport() {
  const [arquivos, setArquivos] = useState<ArquivoLido[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const proximoId = useRef(1);
  const inputId = useId();

  async function adicionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const lidos = await Promise.all(
      Array.from(lista).map(async (f) => ({ id: proximoId.current++, nome: f.name, resultado: await lerArquivo(f) })),
    );
    setArquivos((atual) => [...atual, ...lidos]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    void adicionar(e.dataTransfer.files);
  }

  return (
    <section aria-labelledby="titulo-importar" className="card">
      <h2 id="titulo-importar">Importar XML de NF-e</h2>
      <p className="ajuda">
        Os arquivos são lidos só neste navegador. Nada é enviado pela internet. Só a exibição dos campos extraídos;
        nenhuma conferência é feita aqui.
      </p>

      <div
        className={`dropzone${arrastando ? ' dropzone--ativa' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={onDrop}
        data-testid="dropzone"
      >
        <p>Arraste um ou vários XMLs (procNFe, versão 4.00) para cá, ou</p>
        <label htmlFor={inputId} className="botao">
          Escolher arquivos XML
        </label>
        <input
          id={inputId}
          className="visualmente-oculto"
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          onChange={(e) => {
            void adicionar(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {arquivos.length > 0 && (
        <div className="acoes">
          <p role="status">
            {arquivos.length} arquivo(s) lido(s): {arquivos.filter((a) => a.resultado.ok).length} com sucesso,{' '}
            {arquivos.filter((a) => !a.resultado.ok).length} com erro.
          </p>
          <button type="button" className="botao botao--secundario" onClick={() => setArquivos([])}>
            Limpar lista
          </button>
        </div>
      )}

      {arquivos.map((a) => (
        <article key={a.id} className="arquivo" aria-label={`Arquivo ${a.nome}`}>
          <h3 className="arquivo__nome">{a.nome}</h3>
          {a.resultado.ok ? (
            <Nota nota={a.resultado.nota} />
          ) : (
            <div className="erro" role="alert">
              <p>
                <strong>Não foi possível ler esta nota:</strong>
              </p>
              <ul>
                {a.resultado.erros.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function Nota({ nota }: { nota: NotaFiscal }) {
  return (
    <>
      <dl className="cabecalho-nota">
        <Campo termo="Número" valor={String(nota.numero)} />
        <Campo termo="Emissão" valor={nota.emissao} />
        <Campo termo="Chave (CNPJ mascarado)" valor={nota.chave} mono />
        <Campo termo="Natureza da operação" valor={nota.naturezaOperacao} />
        <Campo termo="Finalidade" valor={rotulo(FINALIDADE_LABEL, nota.finalidade)} />
        <Campo termo="Destino da operação (idDest)" valor={rotulo(ID_DEST_LABEL, nota.idDest)} />
        <Campo termo="Consumidor final (indFinal)" valor={rotulo(IND_FINAL_LABEL, nota.indFinal)} />
        <Campo
          termo="Emitente"
          valor={`UF ${nota.emitente.uf} · CRT ${rotulo(CRT_LABEL, nota.emitente.crt)} · CNAE ${nota.emitente.cnae ?? 'não informado'}`}
        />
        <Campo
          termo="Destinatário"
          valor={`UF ${nota.destinatario.uf} · indIEDest ${rotulo(IND_IE_DEST_LABEL, nota.destinatario.indIEDest)}`}
        />
      </dl>
      <div className="tabela-rolagem" role="region" aria-label={`Itens da nota ${nota.numero}`} tabIndex={0}>
        <table>
          <caption className="visualmente-oculto">Itens da nota {nota.numero}, campos extraídos do XML</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Código</th>
              <th scope="col">Descrição</th>
              <th scope="col">NCM</th>
              <th scope="col">CEST</th>
              <th scope="col">CFOP</th>
              <th scope="col">Origem</th>
              <th scope="col">ICMS</th>
              <th scope="col">PIS</th>
              <th scope="col">COFINS</th>
              <th scope="col">IPI</th>
              <th scope="col">IBS/CBS</th>
            </tr>
          </thead>
          <tbody>
            {nota.itens.map((item) => (
              <LinhaItem key={item.numeroItem} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Campo({ termo, valor, mono = false }: { termo: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <dt>{termo}</dt>
      <dd className={mono ? 'mono' : undefined}>{valor}</dd>
    </div>
  );
}

function LinhaItem({ item }: { item: ItemNotaFiscal }) {
  const icms = item.icms;
  return (
    <tr>
      <td>{item.numeroItem}</td>
      <td>{item.codigoProduto}</td>
      <td>{item.descricao}</td>
      <td className="mono">{item.ncm}</td>
      <td className="mono">{item.cest ?? '—'}</td>
      <td className="mono">{item.cfop}</td>
      <td>{item.origem}</td>
      <td>
        <Linhas
          linhas={[
            icms.grupo,
            icms.regime === 'normal' ? `CST ${icms.cst}` : `CSOSN ${icms.csosn}`,
            icms.modBC !== undefined ? `modBC ${icms.modBC}` : null,
            icms.vBC !== undefined ? `BC ${numeroBR(icms.vBC)}` : null,
            icms.pICMS !== undefined ? `Alíq. ${numeroBR(icms.pICMS, '%')}` : null,
            icms.vICMS !== undefined ? `Valor ${numeroBR(icms.vICMS)}` : null,
            icms.pCredSN !== undefined ? `pCredSN ${numeroBR(icms.pCredSN, '%')}` : null,
            icms.vCredICMSSN !== undefined ? `vCredICMSSN ${numeroBR(icms.vCredICMSSN)}` : null,
          ]}
        />
      </td>
      <td>
        <PisCofins t={item.pis} />
      </td>
      <td>
        <PisCofins t={item.cofins} />
      </td>
      <td>
        {item.ipi ? (
          <Linhas
            linhas={[
              `CST ${item.ipi.cst}`,
              item.ipi.aliquota !== undefined ? `Alíq. ${numeroBR(item.ipi.aliquota, '%')}` : null,
              item.ipi.valor !== undefined ? `Valor ${numeroBR(item.ipi.valor)}` : null,
            ]}
          />
        ) : (
          '—'
        )}
      </td>
      <td>
        {item.ibscbs ? (
          <Linhas
            linhas={[
              `CST ${item.ibscbs.cst}`,
              `cClassTrib ${item.ibscbs.cClassTrib}`,
              item.ibscbs.vBC !== undefined ? `BC ${numeroBR(item.ibscbs.vBC)}` : null,
              item.ibscbs.pIBSUF !== undefined ? `pIBSUF ${numeroBR(item.ibscbs.pIBSUF, '%')}` : null,
              item.ibscbs.vIBS !== undefined ? `vIBS ${numeroBR(item.ibscbs.vIBS)}` : null,
              item.ibscbs.pCBS !== undefined ? `pCBS ${numeroBR(item.ibscbs.pCBS, '%')}` : null,
              item.ibscbs.vCBS !== undefined ? `vCBS ${numeroBR(item.ibscbs.vCBS)}` : null,
            ]}
          />
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

function PisCofins({ t }: { t: ItemNotaFiscal['pis'] }) {
  return (
    <Linhas
      linhas={[
        `${t.grupo} · CST ${t.cst}`,
        t.aliquota !== undefined ? `Alíq. ${numeroBR(t.aliquota, '%')}` : null,
        t.aliquotaPorUnidade !== undefined ? `R$ ${numeroBR(t.aliquotaPorUnidade)}/un.` : null,
        t.valor !== undefined ? `Valor ${numeroBR(t.valor)}` : null,
      ]}
    />
  );
}

function Linhas({ linhas }: { linhas: (string | null)[] }) {
  return (
    <span className="linhas">
      {linhas
        .filter((l): l is string => l !== null)
        .map((l, i) => (
          <span key={i}>{l}</span>
        ))}
    </span>
  );
}
