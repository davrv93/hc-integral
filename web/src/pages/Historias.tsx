import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, Eye, Search } from 'lucide-react'
import { deleteHistoria, fetchHistorias, fetchMedicos } from '@/lib/endpoints'
import type { EstadoRevision } from '@/lib/types'
import { ESTADO_REVISION_LABEL, ESTADO_REVISION_ORDER, formatDate } from '@/lib/labels'
import { EstadoRevisionBadge, EvalBadge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { confirmArchivar, toastError, toastSuccess } from '@/lib/alerts'
import { extractApiError } from '@/lib/api'

const TABS: { value: EstadoRevision | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'en_revision', label: ESTADO_REVISION_LABEL.en_revision },
  { value: 'requiere_propuesta', label: ESTADO_REVISION_LABEL.requiere_propuesta },
  { value: 'completo', label: ESTADO_REVISION_LABEL.completo },
]

export function Historias() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [tab, setTab] = useState<EstadoRevision | 'todos'>('todos')
  const [medicoId, setMedicoId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const medicosQuery = useQuery({ queryKey: ['medicos'], queryFn: fetchMedicos })

  const historiasQuery = useQuery({
    queryKey: ['historias', { q: debouncedSearch, medicoId, tab, page, pageSize }],
    queryFn: () =>
      fetchHistorias({
        q: debouncedSearch || undefined,
        medico_id: medicoId || undefined,
        estado_revision: tab === 'todos' ? undefined : tab,
        page,
        page_size: pageSize,
      }),
  })

  // Conteos por tab (independientes de la paginación, para las pestañas).
  const countsQuery = useQuery({
    queryKey: ['historias', 'counts', { q: debouncedSearch, medicoId }],
    queryFn: async () => {
      const results = await Promise.all(
        ESTADO_REVISION_ORDER.map((estado) =>
          fetchHistorias({
            q: debouncedSearch || undefined,
            medico_id: medicoId || undefined,
            estado_revision: estado,
            page: 1,
            page_size: 1,
          })
        )
      )
      const counts: Record<EstadoRevision, number> = {
        en_revision: results[0].total,
        requiere_propuesta: results[1].total,
        completo: results[2].total,
      }
      return counts
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => deleteHistoria(id),
    onSuccess: () => {
      toastSuccess('Historia archivada correctamente.')
      void queryClient.invalidateQueries({ queryKey: ['historias'] })
    },
    onError: (err) => {
      toastError(extractApiError(err).message || 'No se pudo archivar la historia.')
    },
  })

  async function handleArchive(id: string, label: string) {
    const confirmed = await confirmArchivar(label)
    if (confirmed) archiveMutation.mutate(id)
  }

  const totalTodos = useMemo(() => {
    const c = countsQuery.data
    if (!c) return undefined
    return c.en_revision + c.requiere_propuesta + c.completo
  }, [countsQuery.data])

  const rows = historiasQuery.data?.data ?? []
  const totalPages = historiasQuery.data?.total_pages ?? 1

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text">Historias clínicas</h1>
        <p className="text-sm text-text-muted">Busca, filtra y gestiona las historias registradas.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const count = t.value === 'todos' ? totalTodos : countsQuery.data?.[t.value]
          const active = tab === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTab(t.value)
                setPage(1)
              }}
              className={`inline-flex min-h-control items-center gap-2 rounded-control px-4 text-sm font-medium transition-colors duration-150 ease-out ${
                active ? 'bg-primary text-white' : 'bg-white text-text-soft border border-border hover:bg-bg'
              }`}
            >
              {t.label}
              {count !== undefined && (
                <span
                  className={`rounded-pill px-1.5 py-0.5 text-xs ${
                    active ? 'bg-white/20' : 'bg-bg text-text-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por paciente, DNI o diagnóstico…"
            className="min-h-control w-full rounded-control border border-border bg-white pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus-visible:border-primary"
          />
        </div>
        <select
          value={medicoId}
          onChange={(e) => {
            setMedicoId(e.target.value)
            setPage(1)
          }}
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

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-[#F7FAF9] text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Médico</th>
                <th className="px-4 py-3 font-medium">Plan de trabajo</th>
                <th className="px-4 py-3 font-medium">Objetivos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plazo</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            {!historiasQuery.isLoading && (
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} style={{ height: 56 }} className="border-b border-[#EEF2F1] last:border-0 hover:bg-bg/50">
                    <td className="px-4 py-2">
                      <Link to={`/historias/${h.id}`} className="font-medium text-text hover:text-primary">
                        {h.paciente ? `${h.paciente.nombres} ${h.paciente.apellidos}` : `#${h.correlativo}`}
                      </Link>
                      <p className="text-xs text-text-muted">{h.diagnostico}</p>
                    </td>
                    <td className="px-4 py-2 text-text-soft">
                      {h.medico ? `${h.medico.titulo} ${h.medico.nombre}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <EvalBadge value={h.plan_trabajo_estado} />
                    </td>
                    <td className="px-4 py-2">
                      <EvalBadge value={h.objetivos_estado} />
                    </td>
                    <td className="px-4 py-2">
                      <EstadoRevisionBadge value={h.estado_revision} />
                    </td>
                    <td className="px-4 py-2 text-text-soft">{formatDate(h.plazo)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/historias/${h.id}`)}
                          aria-label="Ver historia"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-primary-soft hover:text-primary"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleArchive(h.id, h.paciente ? `${h.paciente.nombres} ${h.paciente.apellidos}` : `#${h.correlativo}`)
                          }
                          aria-label="Archivar historia"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-danger-soft-bg hover:text-danger-soft-fg"
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {historiasQuery.isLoading && <TableSkeleton rows={8} cols={7} />}
        </div>

        {!historiasQuery.isLoading && rows.length === 0 && (
          <EmptyState
            title="No se encontraron historias"
            description="Ajusta la búsqueda o los filtros para ver resultados."
          />
        )}

        {!historiasQuery.isLoading && rows.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  )
}
