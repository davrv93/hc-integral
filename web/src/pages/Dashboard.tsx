import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, Clock, FileStack } from 'lucide-react'
import { fetchAuditoriaReciente, fetchHistorias, fetchReporteResumen } from '@/lib/endpoints'
import { KpiTile } from '@/components/ui/KpiTile'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { EstadoDonutChart } from '@/components/charts/EstadoDonutChart'
import { StackedBarRow } from '@/components/charts/StackedBarRow'
import { EstadoRevisionBadge } from '@/components/ui/Badge'
import { daysUntil, formatDate, formatDateTime } from '@/lib/labels'

const ACCION_LABEL: Record<string, string> = {
  create: 'Registro creado',
  update: 'Actualización',
  delete: 'Archivado',
  login: 'Inicio de sesión',
  login_failed: 'Login fallido',
}

const ENTIDAD_LABEL: Record<string, string> = {
  historias: 'Historia clínica',
  pacientes: 'Paciente',
  intervenciones: 'Intervención',
  atenciones: 'Atención',
}

export function Dashboard() {
  const resumenQuery = useQuery({
    queryKey: ['reportes', 'resumen'],
    queryFn: () => fetchReporteResumen(),
  })

  const plazosQuery = useQuery({
    queryKey: ['historias', 'plazos-proximos'],
    queryFn: () => fetchHistorias({ estado_revision: 'requiere_propuesta', page_size: 100 }),
  })

  const actividadQuery = useQuery({
    queryKey: ['auditoria', 'reciente'],
    queryFn: () => fetchAuditoriaReciente(10),
  })

  const plazosProximos = useMemo(() => {
    const rows = plazosQuery.data?.data ?? []
    return rows
      .filter((h) => h.plazo)
      .map((h) => ({ historia: h, dias: daysUntil(h.plazo as string) }))
      .filter((r) => r.dias <= 7)
      .sort((a, b) => a.dias - b.dias)
  }, [plazosQuery.data])

  const resumen = resumenQuery.data
  const totalActivas = resumen
    ? resumen.por_estado.en_revision + resumen.por_estado.requiere_propuesta + resumen.por_estado.completo
    : 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text">Inicio</h1>
        <p className="text-sm text-text-muted">Resumen general de historias clínicas interdisciplinarias.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {resumenQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          <>
            <KpiTile label="Historias activas" value={totalActivas} icon={FileStack} accent="#0E6E66" />
            <KpiTile
              label="En revisión"
              value={resumen?.por_estado.en_revision ?? 0}
              icon={Clock}
              accent="#7A560C"
            />
            <KpiTile
              label="Requiere propuesta"
              value={resumen?.por_estado.requiere_propuesta ?? 0}
              icon={ClipboardList}
              accent="#1B5A86"
            />
            <KpiTile
              label="Completo"
              value={resumen?.por_estado.completo ?? 0}
              icon={CheckCircle2}
              accent="#7E3579"
            />
            <KpiTile
              label="Plazos próximos"
              value={plazosQuery.isLoading ? '…' : plazosProximos.length}
              icon={AlertTriangle}
              accent="#A9392A"
              hint="≤ 7 días o vencidos"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-card border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-3 font-serif text-base font-semibold text-text">Historias por estado</h2>
          {resumenQuery.isLoading ? (
            <Skeleton className="h-40" />
          ) : resumen ? (
            <EstadoDonutChart porEstado={resumen.por_estado} />
          ) : null}
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 lg:col-span-3">
          <h2 className="font-serif text-base font-semibold text-text">Evaluación general</h2>
          {resumenQuery.isLoading ? (
            <>
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </>
          ) : resumen ? (
            <>
              <StackedBarRow label="Plan de trabajo" counts={resumen.plan_trabajo} />
              <StackedBarRow label="Objetivos" counts={resumen.objetivos} />
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-card border border-border bg-surface p-4 lg:col-span-3">
          <h2 className="mb-3 font-serif text-base font-semibold text-text">Plazos próximos</h2>
          {plazosQuery.isLoading ? (
            <Skeleton className="h-40" />
          ) : plazosProximos.length === 0 ? (
            <EmptyState title="Sin plazos próximos" description="No hay historias con plazo en los próximos 7 días." />
          ) : (
            <>
              <div className="divide-y divide-[#EEF2F1] lg:hidden">
                {plazosProximos.slice(0, 8).map(({ historia, dias }) => (
                  <article key={historia.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/historias/${historia.id}`} className="min-w-0 font-medium text-primary hover:underline">
                        <span className="block">#{historia.correlativo}</span>
                        <span className="mt-0.5 block break-words text-sm font-normal text-text">{historia.diagnostico}</span>
                      </Link>
                      <EstadoRevisionBadge value={historia.estado_revision} />
                    </div>
                    <p className="mt-2 text-sm text-text-soft">
                      {formatDate(historia.plazo)}{' '}
                      <span className={dias < 0 ? 'font-medium text-danger' : 'text-text-muted'}>
                        ({dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? 'hoy' : `${dias}d`})
                      </span>
                    </p>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#EEF2F1] text-left text-xs uppercase tracking-wide text-text-muted">
                      <th className="py-2 font-medium">Historia</th>
                      <th className="py-2 font-medium">Plazo</th>
                      <th className="py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plazosProximos.slice(0, 8).map(({ historia, dias }) => (
                      <tr key={historia.id} className="border-b border-[#EEF2F1] last:border-0">
                        <td className="py-1.5">
                          <Link to={`/historias/${historia.id}`} className="font-medium text-primary hover:underline">
                            #{historia.correlativo} · {historia.diagnostico}
                          </Link>
                        </td>
                        <td className="py-1.5 text-text-soft">
                          {formatDate(historia.plazo)}{' '}
                          <span className={dias < 0 ? 'text-danger' : 'text-text-muted'}>
                            ({dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? 'hoy' : `${dias}d`})
                          </span>
                        </td>
                        <td className="py-1.5">
                          <EstadoRevisionBadge value={historia.estado_revision} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="rounded-card border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="mb-3 font-serif text-base font-semibold text-text">Actividad reciente</h2>
          {actividadQuery.isLoading ? (
            <Skeleton className="h-40" />
          ) : !actividadQuery.data || actividadQuery.data.length === 0 ? (
            <EmptyState title="Sin actividad" description="Aún no hay eventos registrados." />
          ) : (
            <ol className="relative flex flex-col gap-2 before:absolute before:left-[13px] before:top-6 before:h-[calc(100%-28px)] before:w-px before:bg-border">
              {actividadQuery.data.map((ev) => (
                <li key={ev.id} className="relative flex gap-3">
                  <span className="z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft text-primary">
                    <Activity size={14} />
                  </span>
                  <div className="min-w-0 flex-1 rounded-control border border-[#EEF2F1] px-2.5 py-1.5 transition-colors hover:border-primary/30 hover:bg-primary-soft/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-text">{ACCION_LABEL[ev.accion] ?? ev.accion}</p>
                      <span className="text-[11px] text-text-muted">{formatDateTime(ev.ts)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {ENTIDAD_LABEL[ev.entidad] ?? ev.entidad}
                      {ev.entidad_id ? ` · ${ev.entidad_id.slice(0, 8)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
