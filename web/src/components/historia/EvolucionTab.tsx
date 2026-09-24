import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAtenciones } from '@/lib/endpoints'
import { DISCIPLINA_LABEL, formatDateTime } from '@/lib/labels'
import type { Atencion, EvalEstado } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

const EVAL_SCORE: Record<EvalEstado, number> = { NO: 0, PARCIAL: 50, SI: 100 }
interface EvolutionPoint {
  id: string
  ts: string
  score: number
  atencion: Atencion
}

function scoreAtencion(a: Atencion): number | null {
  const parts: number[] = []
  if (a.plan_trabajo_estado) parts.push(EVAL_SCORE[a.plan_trabajo_estado])
  if (a.objetivos_estado) parts.push(EVAL_SCORE[a.objetivos_estado])
  if (parts.length === 0) return null
  return Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length)
}

function polyline(points: EvolutionPoint[], width: number, height: number): string {
  if (points.length === 1) {
    const y = height - (points[0].score / 100) * height
    return `0,${y} ${width},${y}`
  }
  return points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width
      const y = height - (p.score / 100) * height
      return `${x},${y}`
    })
    .join(' ')
}

export function EvolucionTab({ historiaId }: { historiaId: string }) {
  const atencionesQuery = useQuery({
    queryKey: ['historia', historiaId, 'atenciones'],
    queryFn: () => fetchAtenciones(historiaId),
  })

  const points = useMemo<EvolutionPoint[]>(() => {
    return (atencionesQuery.data ?? [])
      .map((atencion) => {
        const score = scoreAtencion(atencion)
        return score === null ? null : { id: atencion.id, ts: atencion.fecha, score, atencion }
      })
      .filter((p): p is EvolutionPoint => p !== null)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  }, [atencionesQuery.data])

  if (atencionesQuery.isLoading) return <Skeleton className="h-72" />
  if (points.length === 0) {
    return <EmptyState title="Sin datos de evolucion" description="Registra atenciones con plan u objetivos evaluados." />
  }

  const width = 760
  const height = 220
  const latest = points[points.length - 1]

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-base font-semibold text-text">Evolucion por atenciones</h3>
            <p className="text-sm text-text-muted">Promedia los aspectos evaluados en cada atencion registrada.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-primary">{latest.score}%</p>
            <p className="text-xs text-text-muted">avance actual</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height + 34}`} className="h-72 min-w-[680px] w-full" role="img">
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = height - (tick / 100) * height
              return (
                <g key={tick}>
                  <line x1="0" x2={width} y1={y} y2={y} stroke="#D8E2E0" strokeDasharray="4 6" />
                  <text x="0" y={Math.max(10, y - 5)} fill="#5A6B6F" fontSize="11">{tick}%</text>
                </g>
              )
            })}
            <polyline points={polyline(points, width, height)} fill="none" stroke="#0A8F80" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => {
              const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width
              const y = height - (p.score / 100) * height
              return (
                <g key={p.id}>
                  <circle cx={x} cy={y} r="6" fill="#0A8F80" />
                  <text x={x} y={height + 24} textAnchor="middle" fill="#5A6B6F" fontSize="11">{new Date(p.ts).toLocaleDateString()}</text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface">
        <div className="border-b border-[#EEF2F1] px-4 py-3 text-sm font-medium text-text-soft">Lectura de evolucion</div>
        <div className="divide-y divide-[#EEF2F1]">
          {points.slice().reverse().map((p) => (
            <div key={p.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[180px_1fr_100px]">
              <span className="text-text-muted">{formatDateTime(p.ts)}</span>
              <span className="text-text-soft">
                {DISCIPLINA_LABEL[p.atencion.disciplina]} · {p.atencion.motivo} · Plan: {p.atencion.plan_trabajo_estado ?? '-'} · Objetivos: {p.atencion.objetivos_estado ?? '-'}
              </span>
              <span className="font-medium text-primary md:text-right">{p.score}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
