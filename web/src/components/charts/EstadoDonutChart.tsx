import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { EstadoRevision } from '@/lib/types'
import { ESTADO_REVISION_LABEL, ESTADO_REVISION_ORDER } from '@/lib/labels'

const COLORS: Record<EstadoRevision, string> = {
  en_revision: '#C27A1A',
  requiere_propuesta: '#3E6FC2',
  completo: '#A04A9C',
}

interface EstadoDonutChartProps {
  porEstado: Record<EstadoRevision, number>
}

export function EstadoDonutChart({ porEstado }: EstadoDonutChartProps) {
  const data = ESTADO_REVISION_ORDER.map((key) => ({
    key,
    name: ESTADO_REVISION_LABEL[key],
    value: porEstado[key] ?? 0,
  }))
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={COLORS[d.key]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [value, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-semibold text-text">{total}</span>
          <span className="text-xs text-text-muted">Total</span>
        </div>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {data.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-text-soft">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[d.key] }} />
              {d.name}
            </span>
            <span className="font-medium text-text">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
