import { RegistrosSchema, type RegistroValidacao } from './types';

export const CHAVE_REGISTROS = 'laboratorio-fiscal:validacoes:v1';
export const CHAVE_NOME = 'laboratorio-fiscal:nome-validador:v1';

export type ResultadoStorage<T> = { ok: true; valor: T } | { ok: false; erro: string };

const BLOQUEADO =
  'O navegador bloqueou o armazenamento local (modo privado ou configuração de privacidade). ' +
  'Os registros desta sessão ficam só na memória e serão perdidos ao fechar a aba. Exporte o CSV antes de sair.';

/**
 * Acesso ao localStorage com tratamento de erro. `localStorage` pode lançar
 * exceção só por ser lido (SecurityError) ou ao gravar (cota cheia).
 */
export function criarArmazenamento(obterStorage: () => Storage = () => window.localStorage) {
  function storage(): Storage | null {
    try {
      return obterStorage();
    } catch {
      return null;
    }
  }

  return {
    carregar(): ResultadoStorage<RegistroValidacao[]> {
      const s = storage();
      if (!s) return { ok: false, erro: BLOQUEADO };
      let bruto: string | null;
      try {
        bruto = s.getItem(CHAVE_REGISTROS);
      } catch {
        return { ok: false, erro: BLOQUEADO };
      }
      if (bruto === null) return { ok: true, valor: [] };
      try {
        const parsed = RegistrosSchema.safeParse(JSON.parse(bruto));
        if (parsed.success) return { ok: true, valor: parsed.data };
      } catch {
        // cai na mensagem abaixo
      }
      return {
        ok: false,
        erro: 'Os registros salvos neste navegador estão corrompidos ou em formato antigo e não foram carregados. Apague os registros para recomeçar.',
      };
    },

    salvar(registros: readonly RegistroValidacao[]): ResultadoStorage<null> {
      const s = storage();
      if (!s) return { ok: false, erro: BLOQUEADO };
      try {
        s.setItem(CHAVE_REGISTROS, JSON.stringify(registros));
        return { ok: true, valor: null };
      } catch (e) {
        const cota = e instanceof DOMException && e.name === 'QuotaExceededError';
        return {
          ok: false,
          erro: cota
            ? 'O armazenamento local do navegador está cheio. Exporte o CSV e apague registros antigos.'
            : BLOQUEADO,
        };
      }
    },

    apagar(): ResultadoStorage<null> {
      const s = storage();
      if (!s) return { ok: false, erro: BLOQUEADO };
      try {
        s.removeItem(CHAVE_REGISTROS);
        return { ok: true, valor: null };
      } catch {
        return { ok: false, erro: BLOQUEADO };
      }
    },

    lerNome(): string {
      try {
        return storage()?.getItem(CHAVE_NOME) ?? '';
      } catch {
        return '';
      }
    },

    gravarNome(nome: string): void {
      try {
        storage()?.setItem(CHAVE_NOME, nome);
      } catch {
        // Lembrar o nome é só conveniência; falhar aqui não atrapalha nada.
      }
    },
  };
}

export type Armazenamento = ReturnType<typeof criarArmazenamento>;
