# Laboratório fiscal — Fase 0

Base técnica de uma ferramenta de apoio fiscal para contadores e empresas brasileiras (ICMS, PIS, COFINS e, depois, CBS/IBS).
Esta fase **não define o produto**. Ela entrega só a fundação: leitura de NF-e, uma regra fiscal de exemplo (alíquota interestadual de ICMS), regras guardadas como dados e um registro de validação feito pelo contador.

> **Versão de teste.** Nenhuma regra foi validada por contador. A ferramenta sugere, o contador decide.

## Princípios

- **Tudo roda no navegador.** Nenhum XML sai da máquina. Não há servidor, analytics nem chamadas de rede. A página tem uma Content-Security-Policy com `connect-src 'none'` (veja `index.html`).
- **Nenhum dado fiscal inventado.** Toda alíquota e toda regra ficam em arquivos de dados (`src/data/*.json`) com `status`, `fonte` e `vigência`. O que não foi conferido fica como `pendente` ou `nao_validado`, e a tela mostra isso.
- **Sem identificadores pessoais.** O leitor de NF-e não devolve CNPJ, CPF, IE, nome, endereço, telefone nem e-mail. Do emitente saem só UF, CRT e CNAE. Do destinatário, só UF e `indIEDest`. A chave de acesso sai com o CNPJ/CPF do emitente trocado por `*`.
- **A tela nunca diz "correto".** Ela mostra "regra aplicada" ou "divergência", sempre com memória de cálculo e base legal.

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 22 ou mais recente.

```bash
npm install
```

```bash
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

Para gerar a versão final, que é a que deve ser usada para conferir a política de segurança:

```bash
npm run build
```

```bash
npm run preview
```

## Como rodar os testes e as verificações

| Comando | O que faz |
|---|---|
| `npm test` | Roda todos os testes automáticos (regra interestadual, leitor de NF-e, regras, validação, tela). |
| `npm run typecheck` | Confere os tipos do TypeScript. |
| `npm run lint` | Confere o estilo do código e proíbe `console` (para não vazar dado fiscal em log). |
| `npm run check:rules` | Confere os arquivos de regras. **Falha** se uma regra estiver `validado` sem `fonte`, `validadoPor` e `validadoEm`. |
| `npm run build` | Gera a versão final em `dist/`. |

O GitHub Actions (`.github/workflows/ci.yml`) roda os cinco a cada push.

Onde ler os testes, que descrevem o comportamento esperado em português:

- `src/domain/icms/interstate.test.ts`: todos os casos de alíquota interestadual (e as 702 rotas possíveis).
- `src/domain/nfe/parse.test.ts`: campos extraídos das três notas de exemplo, privacidade e mensagens de erro.
- `src/domain/rules/rules.test.ts`: política das regras e conteúdo das tabelas.
- `src/validation/validation.test.ts`: registro de validação, CSV e armazenamento.
- `src/ui/App.test.tsx`: a tela, do jeito que o contador usa.

## A tela "Laboratório"

Uma página com três blocos:

1. **Importar XML de NF-e**: arraste um ou vários XMLs (procNFe 4.00). Para cada nota aparece o cabeçalho e uma tabela por item (NCM, CEST, CFOP, origem, ICMS, PIS, COFINS, IPI, IBS/CBS). Só exibição, sem julgamento. As notas de exemplo estão em `src/domain/nfe/__fixtures__/`.
2. **Alíquota interestadual de ICMS**: UF de origem, UF de destino e origem da mercadoria. Mostra a alíquota, o status da regra, a memória de cálculo e a base legal. Abaixo dela fica o formulário de validação.
3. **Registro de validações**: total, taxa de acerto (registros "confere" ÷ total), exportação em CSV e botão para apagar.

## Como adicionar uma regra

As regras ficam em `src/data/`, em arquivos JSON. Cada regra tem este formato:

```json
{
  "id": "icms-interno-modal-sp",
  "descricao": "Alíquota modal (padrão) interna de ICMS em SP",
  "escopo": { "uf": "SP" },
  "valor": null,
  "status": "pendente",
  "fonte": null,
  "vigenciaInicio": null
}
```

| Campo | Significado |
|---|---|
| `id` | Identificador único, minúsculo, com hífens. |
| `descricao` | Texto livre explicando a regra. |
| `escopo` | Onde ela vale. Campos possíveis: `uf`, `ufsOrigem`, `ufsDestino`, `origensMercadoria`, `ncmPrefixo`, `crt`. Campo ausente = sem restrição. |
| `valor` | Número (ex.: alíquota em %) ou `null` se ainda não se sabe. |
| `status` | `pendente` (sem dado), `nao_validado` (tem valor, ainda não conferido) ou `validado`. |
| `fonte` | De onde veio: norma, artigo, link. `null` se não há. |
| `validadoPor`, `validadoEm` | Só para regras `validado`. Data no formato `AAAA-MM-DD`. |
| `vigenciaInicio`, `vigenciaFim` | Datas `AAAA-MM-DD`, ou `null` se não confirmadas. |

Passos para preencher um valor que hoje está `pendente`:

1. Edite o arquivo em `src/data/`, por exemplo `icms-interno-modal.json`.
2. Preencha `valor` e `fonte` (norma e artigo). Mude `status` para `nao_validado`.
3. Rode `npm run check:rules` e `npm test`.

Para criar um **arquivo novo** de regras, adicione o JSON em `src/data/` e registre-o em `src/data/index.ts` (lista `RULE_FILES`).

A versão das regras (`regras-xxxxxxxx`, visível no topo da tela) é calculada automaticamente a partir do conteúdo dos arquivos. Qualquer mudança gera uma versão nova, e cada registro de validação guarda a versão com que foi feito.

## Como validar uma regra

Uma regra só pode virar `validado` depois que um contador conferir o valor na norma.

1. Confira o valor e a vigência no texto legal.
2. No JSON, preencha:
   ```json
   "status": "validado",
   "fonte": "Resolução do Senado Federal nº 22/1989, art. 1º",
   "validadoPor": "Nome do contador (CRC)",
   "validadoEm": "2026-12-01",
   "vigenciaInicio": "AAAA-MM-DD"
   ```
3. Rode `npm run check:rules`. Ele recusa a regra se faltar `fonte`, `validadoPor`, `validadoEm`, `valor` ou `vigenciaInicio`.
4. Um teste em `src/domain/rules/rules.test.ts` hoje exige que **nenhuma** regra esteja validada (é a situação real da Fase 0). Remova esse teste quando a primeira regra for validada.

Para conferir **resultados** (e não o arquivo de regras), use a tela: calcule, marque "Regra aplicada confere" ou "Divergente" (com valor esperado e comentário com base legal) e exporte o CSV para análise.

## Estrutura

```
src/
  data/                 Arquivos de regras (JSON) e carga com validação
  domain/
    uf.ts               As 27 UFs
    icms/interstate.ts  Alíquota interestadual de ICMS (função pura)
    nfe/                Leitor de NF-e (procNFe 4.00) e notas de exemplo
    rules/              Esquema (zod), política e carga de regras
  validation/           Registro de validação, CSV e localStorage
  ui/                   Tela "Laboratório" (React)
scripts/check-rules.ts  Verificação das regras usada no CI
```

## Fora do escopo desta fase

Não foi implementado, de propósito:

- login e contas; cobrança e planos; backend;
- integração com ERP (Omie ou outro); leitura de SPED;
- tabelas de ST, MVA, benefícios fiscais, NCM ou CEST;
- cálculo de DIFAL e FCP;
- Simples Nacional (RBT12, Anexos);
- CBS/IBS além de ler o grupo da nota;
- integração com os repositórios da Receita Federal;
- IA generativa.

Também não são lidos: NFC-e (modelo 65), NF-e sem protocolo (só `NFe`, sem `nfeProc`), grupos de ICMS fora da lista suportada (ex.: `ICMS02`, `ICMS15`, `ICMS53`, `ICMS61`, `ICMSPart`, `ICMSST`), totais da nota, frete e descontos. Nesses casos o leitor recusa a nota com uma mensagem clara.

## Dúvidas fiscais para validar com contador

Nada abaixo foi decidido pelo código. Cada item precisa de confirmação.

1. **Vigência das resoluções.** `vigenciaInicio` das regras de 4%, 7% e 12% ficou `null`. Confirmar a data de início da Resolução do Senado nº 22/1989 e da nº 13/2012.
2. **Texto das resoluções.** As listas de UF e as origens (1, 2, 3, 8 → 4%; 0, 4, 5, 6, 7 → fora) vieram do briefing e estão `nao_validado`. Conferir no texto da Res. SF 13/2012 se as exceções (bens sem similar nacional da lista CAMEX, produção conforme PPB, gás natural importado) ficam todas representadas apenas pelo código de origem.
3. **Destinatário não contribuinte.** A função devolve a alíquota interestadual para qualquer destinatário. Não trata DIFAL (fora do escopo). Confirmar se, para o uso pretendido, a tela deve avisar quando `indIEDest = 9`.
4. **Data da operação.** A função não recebe data e não filtra regras por vigência. Quando houver regras com vigências diferentes, ela vai precisar receber a data de emissão.
5. **"ICMS41" e "ICMS50".** O briefing os lista como grupos, mas no leiaute 4.00 da NF-e os CST 40, 41 e 50 ficam dentro do grupo `<ICMS40>` (a fixture A usa exatamente isso). O leitor aceita `<ICMS40>` com qualquer CST e não aceita tags `<ICMS41>`/`<ICMS50>`. Da mesma forma, `<ICMSSN102>` cobre os CSOSN 102, 103, 300 e 400, e `<ICMSSN202>` cobre 202 e 203. Confirmar.
6. **Fixture B, itens 2 e 3, "PIS e COFINS 0".** Usei CST 01 com alíquota 0, igual à fixture A. Também poderia ser CST 06 (alíquota zero), 07 ou 08. Confirmar qual representa o caso real.
7. **Fixture B, base do IBS/CBS.** Base = valor do produto − ICMS − PIS − COFINS, arredondada por item (meio para cima). O leiaute do grupo `IBSCBS` (com `gIBSCBS`, `gIBSUF`, `gIBSMun` zerado e `gCBS`) e o `IBSCBSTot` seguem minha leitura da Nota Técnica da reforma, não conferida no documento oficial.
8. **Fixture C, crédito do Simples.** `vCredICMSSN = vProd × pCredSN` (1.000,00 × 3,12% = 31,20). Confirmar se frete, seguro ou desconto entram na base do crédito.
9. **Descrição dos códigos de origem (0 a 8).** A tela mostra só o número, porque o texto de cada código é dado de tabela fiscal e não foi conferido. Pode virar um arquivo de dados validado.
10. **Alíquota de TO (20%).** Registrada como `nao_validado`, com a fonte "citado por um contador em conversa". Confirmar no RICMS/TO.

## Notas técnicas

- A CSP restritiva de `index.html` é a do build (`dist/index.html`). Em `npm run dev` ela é afrouxada só no servidor local, porque o Vite precisa de script inline e WebSocket para recarregar a página (plugin em `vite.config.ts`). Para conferir a aba Rede, use `npm run build` e `npm run preview`.
- Valores do XML viram `number` do JavaScript. Para exibição isso basta. Quando houver cálculo com valores da nota, será preciso aritmética decimal para evitar erros de arredondamento.
- O CSV usa `;` como separador (o Excel em português abre direto em colunas), UTF-8 com BOM, aspas escapadas e proteção contra fórmulas (textos que começam com `=`, `+`, `-` ou `@`).
- TypeScript fixado na série 6.0 porque o `typescript-eslint` ainda não aceita o TypeScript 7.
- `npm audit` aponta um ReDoS no `picomatch`, usado só por ferramentas de desenvolvimento (Vitest e typescript-eslint). Ele não vai para o código que roda no navegador.
