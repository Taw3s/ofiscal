import { z } from 'zod';

export const VeredictoSchema = z.enum(['confere', 'divergente']);
export type Veredicto = z.infer<typeof VeredictoSchema>;

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  confere: 'Regra aplicada confere',
  divergente: 'Divergente',
};

const Campos = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

/** Um registro de conferência feito por um contador sobre um resultado exibido. */
export const RegistroValidacaoSchema = z
  .object({
    id: z.string().min(1),
    /** Data e hora do registro (ISO 8601). */
    data: z.string().min(1),
    versaoRegras: z.string().min(1),
    validadoPor: z.string().min(1),
    /** Qual cálculo foi conferido, ex.: "aliquota-interestadual". */
    tipo: z.string().min(1),
    entrada: Campos,
    saida: Campos,
    veredito: VeredictoSchema,
    valorEsperado: z.string().optional(),
    comentario: z.string().optional(),
  })
  .strict();
export type RegistroValidacao = z.infer<typeof RegistroValidacaoSchema>;

export const RegistrosSchema = z.array(RegistroValidacaoSchema);
