import type { EstadoRevision, EvalEstado } from '@/lib/types'
import { ESTADO_REVISION_LABEL, EVAL_ESTADO_LABEL } from '@/lib/labels'

const EVAL_STYLES: Record<EvalEstado, string> = {
  SI: 'bg-eval-si-bg text-eval-si-fg',
  NO: 'bg-eval-no-bg text-eval-no-fg',
  PARCIAL: 'bg-eval-parcial-bg text-eval-parcial-fg',
}

const ESTADO_STYLES: Record<EstadoRevision, string> = {
  en_revision: 'bg-estado-enRevision-bg text-estado-enRevision-fg',
  requiere_propuesta: 'bg-estado-requierePropuesta-bg text-estado-requierePropuesta-fg',
  completo: 'bg-estado-completo-bg text-estado-completo-fg',
}

const baseClass = 'inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium whitespace-nowrap'

export function EvalBadge({ value }: { value?: EvalEstado | null }) {
  if (!value) {
    return <span className={`${baseClass} bg-border/60 text-text-muted`}>Sin datos</span>
  }
  return <span className={`${baseClass} ${EVAL_STYLES[value]}`}>{EVAL_ESTADO_LABEL[value]}</span>
}

export function EstadoRevisionBadge({ value }: { value: EstadoRevision }) {
  return <span className={`${baseClass} ${ESTADO_STYLES[value]}`}>{ESTADO_REVISION_LABEL[value]}</span>
}
