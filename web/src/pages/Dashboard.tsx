import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, FileStack } from 'lucide-react'
import { fetchHistorias, fetchReporteResumen } from '@/lib/endpoints'
import { KpiTile } from '@/components/ui/KpiTile'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { EstadoDonutChart } from '@/components/charts/EstadoDonutChart'
import { StackedBarRow } from '@/components/charts/StackedBarRow'
import { EstadoRevisionBadge } from '@/components/ui/Badge'
import { daysUntil, formatDate } from '@/lib/labels'

export function Dashboard() {
  const resumenQuery = useQuery({
    queryKey: ['reportes', 'resumen'],
    queryFn: () => fetchReporteResumen(),
  })

  const plazosQuery = useQuery({
    queryKey: ['historias', 'plazos-proximos'],
    queryFn: () => fetchHistorias({ estado_revision: 'requiere_propuesta', page_size: 100 }),
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
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text">Inicio</h1>
        <p className="text-sm text-text-muted">Resumen general de historias clínicas interdisciplinarias.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {resumenQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="rounded-card border border-border bg-surface p-6 lg:col-span-2">
          <h2 className="mb-4 font-serif text-lg font-semibold text-text">Historias por estado</h2>
          {resumenQuery.isLoading ? (
            <Skeleton className="h-48" />
          ) : resumen ? (
            <EstadoDonutChart porEstado={resumen.por_estado} />
          ) : null}
        </div>

        <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-6 lg:col-span-3">
          <h2 className="font-serif text-lg font-semibold text-text">Evaluación general</h2>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="rounded-card border border-border bg-surface p-6 lg:col-span-3">
          <h2 className="mb-4 font-serif text-lg font-semibold text-text">Plazos próximos</h2>
          {plazosQuery.isLoading ? (
            <Skeleton className="h-40" />
          ) : plazosProximos.length === 0 ? (
            <EmptyState title="Sin plazos próximos" description="No hay historias con plazo en los próximos 7 días." />
          ) : (
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
                    <td className="py-2.5">
                      <Link to={`/historias/${historia.id}`} className="font-medium text-primary hover:underline">
                        #{historia.correlativo} · {historia.diagnostico}
                      </Link>
                    </td>
                    <td className="py-2.5 text-text-soft">
                      {formatDate(historia.plazo)}{' '}
                      <span className={dias < 0 ? 'text-danger' : 'text-text-muted'}>
                        ({dias < 0 ? `${Math.abs(dias)}d vencido` : dias === 0 ? 'hoy' : `${dias}d`})
                      </span>
                    </td>
                    <td className="py-2.5">
                      <EstadoRevisionBadge value={historia.estado_revision} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-card border border-border bg-surface p-6 lg:col-span-2">
          <h2 className="mb-4 font-serif text-lg font-semibold text-text">Actividad reciente</h2>
          <EmptyState
            title="Próximamente"
            description="La actividad reciente global se mostrará aquí cuando el api-service exponga un endpoint agregado de auditoría."
          />
        </div>
      </div>
    </div>
  )
}
