import { z } from 'zod'

export const evalEstadoSchema = z.enum(['SI', 'NO', 'PARCIAL'])
export const estadoRevisionSchema = z.enum(['en_revision', 'requiere_propuesta', 'completo'])

export const historiaFormSchema = z.object({
  plan_trabajo_estado: evalEstadoSchema.nullable(),
  objetivos_estado: evalEstadoSchema.nullable(),
  necesidades: z.string(),
  objetivos_propuestos: z.string(),
  plan_actual: z.string(),
  plazo: z.string(),
  estado_revision: estadoRevisionSchema,
  observaciones: z.string(),
})

export type HistoriaFormValues = z.infer<typeof historiaFormSchema>
