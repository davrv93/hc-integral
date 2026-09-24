import type { EvalEstado } from '@/lib/types'
import { EVAL_ESTADO_LABEL, EVAL_ESTADO_ORDER } from '@/lib/labels'

const COLORS: Record<EvalEstado, string> = {
  SI: '#0A8F80',
  PARCIAL: '#C27A1A',
  NO: '#A04A9C',
}

interface StackedBarRowProps {
  label: string
  counts: Record<EvalEstado, number>
}

export function StackedBarRow({ label, counts }: StackedBarRowProps) {
  const total = EVAL_ESTADO_ORDER.reduce((sum, k) => sum + (counts[k] ?? 0), 0) || 1

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-soft">{label}</span>
        <div className="flex gap-3 text-xs text-text-muted">
          {EVAL_ESTADO_ORDER.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[k] }} />
              {EVAL_ESTADO_LABEL[k]} {counts[k] ?? 0}
            </span>
          ))}
        </div>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-pill bg-border/40">
        {EVAL_ESTADO_ORDER.map((k) => {
          const value = counts[k] ?? 0
          const pct = (value / total) * 100
          if (pct <= 0) return null
          return (
            <div
              key={k}
              style={{ width: `${pct}%`, backgroundColor: COLORS[k] }}
              className="h-full transition-all duration-200 ease-out"
              title={`${EVAL_ESTADO_LABEL[k]}: ${value}`}
            />
          )
        })}
      </div>
    </div>
  )
}
