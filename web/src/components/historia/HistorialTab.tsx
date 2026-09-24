import { useQuery } from '@tanstack/react-query'
import { fetchAuditoria } from '@/lib/endpoints'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime } from '@/lib/labels'

const ACCION_LABEL: Record<string, string> = {
  create: 'Creación',
  update: 'Actualización',
  delete: 'Archivado',
  login: 'Inicio de sesión',
  login_failed: 'Intento de inicio de sesión fallido',
}

export function HistorialTab({ historiaId }: { historiaId: string }) {
  const auditoriaQuery = useQuery({
    queryKey: ['historia', historiaId, 'auditoria'],
    queryFn: () => fetchAuditoria(historiaId),
  })

  if (auditoriaQuery.isLoading) return <TableSkeleton rows={5} cols={1} />

  const eventos = auditoriaQuery.data ?? []
  if (eventos.length === 0) {
    return <EmptyState title="Sin eventos registrados" description="Todavía no hay auditoría para esta historia." />
  }

  return (
    <ol className="flex flex-col gap-0">
      {eventos.map((ev, idx) => (
        <li key={ev.id} className="relative flex gap-4 pb-6 pl-2">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
            {idx < eventos.length - 1 && <span className="w-px flex-1 bg-border" />}
          </div>
          <div className="flex-1 rounded-card border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text">{ACCION_LABEL[ev.accion] ?? ev.accion}</span>
              <span className="text-xs text-text-muted">{formatDateTime(ev.ts)}</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">Entidad: {ev.entidad}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
