import { z } from 'zod';
import { UFS } from '../uf';

/**
 * Esquema de uma regra fiscal guardada em arquivo de dados (src/data/*.json).
 *
 * Este esquema verifica só a FORMA dos dados (tipos e formatos).
 * As exigências de processo — por exemplo, "regra validada precisa de quem
 * validou e quando" — ficam em `policy.ts` e rodam no `npm run check:rules`.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD (ex.: 2026-01-31)');

export const RuleStatusSchema = z.enum(['validado', 'nao_validado', 'pendente']);
export type RuleStatus = z.infer<typeof RuleStatusSchema>;

export const UFSchema = z.enum(UFS);

/** Código de origem da mercadoria (1º dígito do CST): 0 a 8. */
export const OrigemMercadoriaSchema = z.number().int().min(0).max(8);

/**
 * Onde a regra se aplica. Campo ausente = sem restrição naquele critério.
 */
export const RuleScopeSchema = z
  .object({
    uf: UFSchema.optional(),
    ufsOrigem: z.array(UFSchema).nonempty().optional(),
    ufsDestino: z.array(UFSchema).nonempty().optional(),
    origensMercadoria: z.array(OrigemMercadoriaSchema).nonempty().optional(),
    ncmPrefixo: z.string().regex(/^\d{2,8}$/, 'prefixo de NCM deve ter de 2 a 8 dígitos').optional(),
    crt: z.array(z.number().int().min(1).max(4)).nonempty().optional(),
  })
  .strict();
export type RuleScope = z.infer<typeof RuleScopeSchema>;

export const RuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id deve ser minúsculo, com hífens (ex.: icms-interno-sp)'),
    descricao: z.string().min(1),
    escopo: RuleScopeSchema,
    /** Valor da regra (ex.: alíquota em %). `null` quando ainda não se sabe. */
    valor: z.number().nullable(),
    status: RuleStatusSchema,
    /** De onde veio a informação (norma, artigo, link). `null` se não há fonte. */
    fonte: z.string().nullable(),
    validadoPor: z.string().optional(),
    validadoEm: isoDate.optional(),
    vigenciaInicio: isoDate.nullable(),
    vigenciaFim: isoDate.nullable().optional(),
  })
  .strict();
export type Rule = z.infer<typeof RuleSchema>;

export const RuleFileSchema = z
  .object({
    $comentario: z.string().optional(),
    conjunto: z.string().min(1),
    regras: z.array(RuleSchema),
  })
  .strict();
export type RuleFile = z.infer<typeof RuleFileSchema>;

/** Rótulos em português para exibir o status na interface. */
export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  validado: 'Validada por contador',
  nao_validado: 'Não validada',
  pendente: 'Pendente (sem dado)',
};
