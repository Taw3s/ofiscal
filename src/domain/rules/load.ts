import { RuleFileSchema, type RuleFile } from './schema';

/**
 * Valida o conteúdo de um arquivo de regras. Em caso de erro, lança uma
 * mensagem que aponta o arquivo e o caminho do campo com problema.
 */
export function parseRuleFile(nomeArquivo: string, conteudo: unknown): RuleFile {
  const result = RuleFileSchema.safeParse(conteudo);
  if (result.success) return result.data;
  const detalhes = result.error.issues
    .map((i) => `  - ${i.path.length ? i.path.join('.') : '(raiz)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Arquivo de regras "${nomeArquivo}" inválido:\n${detalhes}`);
}

/**
 * Impressão digital (FNV-1a, 32 bits) do conteúdo das regras. Muda sempre que
 * qualquer regra muda; é gravada em cada registro de validação para saber com
 * qual versão das regras o contador conferiu o resultado.
 */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
