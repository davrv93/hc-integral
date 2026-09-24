import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet } from 'lucide-react'
import { fetchMedicos, fetchReporteResumen } from '@/lib/endpoints'
import { DISCIPLINA_LABEL, ESTADO_REVISION_LABEL } from '@/lib/labels'
import { Skeleton } from '@/components/ui/Skeleton'
import { SerieMensualChart } from '@/components/charts/SerieMensualChart'
import { HorizontalBarList } from '@/components/charts/HorizontalBarList'
import { StackedBarRow } from '@/components/charts/StackedBarRow'
import { Button } from '@/components/ui/Button'
import { toastInfo } from '@/lib/alerts'
import type { Disciplina } from '@/lib/types'

const CHART_COLORS = ['#0A8F80', '#3E6FC2', '#C27A1A', '#2B7FD0', '#A04A9C']
const DISCIPLINAS: Disciplina[] = ['medicina', 'psicologia', 'terapia_fisica', 'nutricion']

const PERIODOS = [
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Último año' },
  { value: 'todo', label: 'Todo' },
] as const

function desdeFromPeriodo(periodo: string): string | undefined {
  if (periodo === 'todo') return undefined
  const months = Number(periodo)
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

export function Reportes() {
  const [periodo, setPeriodo] = useState<string>('6')
  const [medicoId, setMedicoId] = useState('')

  const medicosQuery = useQuery({ queryKey: ['medicos'], queryFn: fetchMedicos })

  const desde = useMemo(() => desdeFromPeriodo(periodo), [periodo])

  const resumenQuery = useQuery({
    queryKey: ['reportes', 'resumen', { desde, medicoId }],
    queryFn: () => fetchReporteResumen({ desde, medico_id: medicoId || undefined }),
  })

  const resumen = resumenQuery.data

  const intervencionesItems = resumen
    ? DISCIPLINAS.map((d, i) => ({
        label: DISCIPLINA_LABEL[d],
        value: resumen.intervenciones_por_disciplina[d] ?? 0,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : []

  function stub(label: string) {
    toastInfo(`Exportar ${label}: próximamente.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text">Reportes</h1>
          <p className="text-sm text-text-muted">Indicadores agregados de historias clínicas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => stub('Excel')}>
            <FileSpreadsheet size={16} />
            Excel
          </Button>
          <Button variant="secondary" onClick={() => stub('PDF')}>
            <Download size={16} />
            PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="min-h-control rounded-control border border-border bg-white px-3 text-sm text-text-soft"
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={medicoId}
          onChange={(e) => setMedicoId(e.target.value)}
          className="min-h-control rounded-control border border-border bg-white px-3 text-sm text-text-soft sm:w-56"
        >
          <option value="">Todos los médicos</option>
          {medicosQuery.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.titulo} {m.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-text">Historias creadas vs. completadas</h2>
        {resumenQuery.isLoading ? (
          <Skeleton className="h-64" />
        ) : resumen ? (
          <SerieMensualChart data={resumen.serie_mensual} />
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-surface p-6">
          <h2 className="mb-4 font-serif text-lg font-semibold text-text">Intervenciones por disciplina</h2>
          {resumenQuery.isLoading ? <Skeleton className="h-40" /> : <HorizontalBarList items={intervencionesItems} />}
        </div>

        <div className="rounded-card border border-border bg-surface p-6">
          <h2 className="mb-4 font-serif text-lg font-semibold text-text">Evaluación general</h2>
          {resumenQuery.isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : resumen ? (
            <div className="flex flex-col gap-4">
              <StackedBarRow label="Plan de trabajo" counts={resumen.plan_trabajo} />
              <StackedBarRow label="Objetivos" counts={resumen.objetivos} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-text">Desglose por médico</h2>
        {resumenQuery.isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[#EEF2F1] text-left text-xs uppercase tracking-wide text-text-muted">
                  <th className="py-2 font-medium">Médico</th>
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">{ESTADO_REVISION_LABEL.en_revision}</th>
                  <th className="py-2 font-medium">{ESTADO_REVISION_LABEL.requiere_propuesta}</th>
                  <th className="py-2 font-medium">{ESTADO_REVISION_LABEL.completo}</th>
                  <th className="py-2 font-medium">Distribución</th>
                </tr>
              </thead>
              <tbody>
                {resumen?.por_medico.map((m) => (
                  <tr key={m.medico_id} className="border-b border-[#EEF2F1] last:border-0">
                    <td className="py-2.5 font-medium text-text">{m.nombre}</td>
                    <td className="py-2.5 text-text-soft">{m.total}</td>
                    <td className="py-2.5 text-text-soft">{m.en_revision}</td>
                    <td className="py-2.5 text-text-soft">{m.requiere_propuesta}</td>
                    <td className="py-2.5 text-text-soft">{m.completo}</td>
                    <td className="py-2.5">
                      <div className="flex h-2.5 w-32 overflow-hidden rounded-pill bg-border/40">
                        <div
                          className="h-full bg-[#C27A1A]"
                          style={{ width: `${(m.en_revision / (m.total || 1)) * 100}%` }}
                        />
                        <div
                          className="h-full bg-[#3E6FC2]"
                          style={{ width: `${(m.requiere_propuesta / (m.total || 1)) * 100}%` }}
                        />
                        <div className="h-full bg-[#A04A9C]" style={{ width: `${(m.completo / (m.total || 1)) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
