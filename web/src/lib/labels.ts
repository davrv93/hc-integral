import type { Disciplina, EstadoRevision, EvalEstado } from './types'

export const ESTADO_REVISION_LABEL: Record<EstadoRevision, string> = {
  en_revision: 'En revisión',
  requiere_propuesta: 'Requiere propuesta',
  completo: 'Completo',
}

export const ESTADO_REVISION_ORDER: EstadoRevision[] = ['en_revision', 'requiere_propuesta', 'completo']

export const EVAL_ESTADO_LABEL: Record<EvalEstado, string> = {
  SI: 'Sí',
  NO: 'No',
  PARCIAL: 'Parcial',
}

export const EVAL_ESTADO_ORDER: EvalEstado[] = ['SI', 'NO', 'PARCIAL']

export const DISCIPLINA_LABEL: Record<Disciplina, string> = {
  medicina: 'Medicina',
  psicologia: 'Psicología',
  terapia_fisica: 'Terapia física',
  nutricion: 'Nutrición',
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}
