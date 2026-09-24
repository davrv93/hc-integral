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
import { toastError, toastSuccess } from '@/lib/alerts'
import type { Disciplina, ReporteResumen } from '@/lib/types'

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

function csvCell(value: string | number): string {
  const raw = String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function downloadTextFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildResumenCsv(resumen: ReporteResumen): string {
  const rows: (string | number)[][] = [
    ['Seccion', 'Indicador', 'Valor'],
    ['Estado', ESTADO_REVISION_LABEL.en_revision, resumen.por_estado.en_revision],
    ['Estado', ESTADO_REVISION_LABEL.requiere_propuesta, resumen.por_estado.requiere_propuesta],
    ['Estado', ESTADO_REVISION_LABEL.completo, resumen.por_estado.completo],
    ['Plan de trabajo', 'SI', resumen.plan_trabajo.SI],
    ['Plan de trabajo', 'NO', resumen.plan_trabajo.NO],
    ['Plan de trabajo', 'PARCIAL', resumen.plan_trabajo.PARCIAL],
    ['Objetivos', 'SI', resumen.objetivos.SI],
    ['Objetivos', 'NO', resumen.objetivos.NO],
    ['Objetivos', 'PARCIAL', resumen.objetivos.PARCIAL],
    ...DISCIPLINAS.map((d) => ['Intervenciones', DISCIPLINA_LABEL[d], resumen.intervenciones_por_disciplina[d] ?? 0]),
    [],
    ['Medico', 'Total', ESTADO_REVISION_LABEL.en_revision, ESTADO_REVISION_LABEL.requiere_propuesta, ESTADO_REVISION_LABEL.completo],
    ...resumen.por_medico.map((m) => [m.nombre, m.total, m.en_revision, m.requiere_propuesta, m.completo]),
    [],
    ['Mes', 'Creadas', 'Completadas'],
    ...resumen.serie_mensual.map((m) => [m.mes, m.creadas, m.completadas]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function printResumen(resumen: ReporteResumen) {
  const printable = window.open('', '_blank', 'width=960,height=720')
  if (!printable) {
    toastError('No se pudo abrir la ventana de impresion.')
    return
  }
  const medicoRows = resumen.por_medico
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.nombre)}</td><td>${m.total}</td><td>${m.en_revision}</td><td>${m.requiere_propuesta}</td><td>${m.completo}</td></tr>`
    )
    .join('')
  const serieRows = resumen.serie_mensual
    .map((m) => `<tr><td>${m.mes}</td><td>${m.creadas}</td><td>${m.completadas}</td></tr>`)
    .join('')

  printable.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Reporte HC Integral</title>
  <style>
    body { font-family: Arial, sans-serif; color: #18302F; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th, td { border-bottom: 1px solid #D8E2E0; padding: 8px; text-align: left; }
    th { background: #F2F6F5; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
    .metric { border: 1px solid #D8E2E0; padding: 12px; }
    .metric strong { display: block; font-size: 22px; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Reporte HC Integral</h1>
  <div>Generado: ${new Date().toLocaleString()}</div>
  <div class="grid">
    <div class="metric">${ESTADO_REVISION_LABEL.en_revision}<strong>${resumen.por_estado.en_revision}</strong></div>
    <div class="metric">${ESTADO_REVISION_LABEL.requiere_propuesta}<strong>${resumen.por_estado.requiere_propuesta}</strong></div>
    <div class="metric">${ESTADO_REVISION_LABEL.completo}<strong>${resumen.por_estado.completo}</strong></div>
  </div>
  <h2>Desglose por medico</h2>
  <table><thead><tr><th>Medico</th><th>Total</th><th>${ESTADO_REVISION_LABEL.en_revision}</th><th>${ESTADO_REVISION_LABEL.requiere_propuesta}</th><th>${ESTADO_REVISION_LABEL.completo}</th></tr></thead><tbody>${medicoRows}</tbody></table>
  <h2>Serie mensual</h2>
  <table><thead><tr><th>Mes</th><th>Creadas</th><th>Completadas</th></tr></thead><tbody>${serieRows}</tbody></table>
</body>
</html>`)
  printable.document.close()
  printable.focus()
  printable.print()
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

  function exportCsv() {
    if (!resumen) {
      toastError('No hay datos cargados para exportar.')
      return
    }
    downloadTextFile('reporte-hc-integral.csv', 'text/csv;charset=utf-8', buildResumenCsv(resumen))
    toastSuccess('Reporte CSV descargado.')
  }

  function exportPdf() {
    if (!resumen) {
      toastError('No hay datos cargados para exportar.')
      return
    }
    printResumen(resumen)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text">Reportes</h1>
          <p className="text-sm text-text-muted">Indicadores agregados de historias clínicas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            <FileSpreadsheet size={16} />
            Excel
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
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
