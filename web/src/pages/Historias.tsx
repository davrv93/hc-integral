import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, Download, Eye, Plus, Search, X } from 'lucide-react'
import { createHistoria, deleteHistoria, fetchHistorias, fetchMedicos, fetchPacientes } from '@/lib/endpoints'
import type { EstadoRevision, Historia } from '@/lib/types'
import { ESTADO_REVISION_LABEL, ESTADO_REVISION_ORDER, EVAL_ESTADO_LABEL, formatDate } from '@/lib/labels'
import { EstadoRevisionBadge, EvalBadge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { confirmArchivar, toastError, toastSuccess } from '@/lib/alerts'
import { extractApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'

function pacienteNombre(h: Historia): string {
  return h.paciente_nombre ?? (h.paciente ? `${h.paciente.nombres} ${h.paciente.apellidos}` : `#${h.correlativo}`)
}

function pacienteDni(h: Historia): string {
  return h.paciente_dni ?? h.paciente?.dni ?? '—'
}

function medicoNombre(h: Historia): string {
  return h.medico_nombre ?? (h.medico ? `${h.medico.titulo} ${h.medico.nombre}` : '—')
}

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
  const [showCreate, setShowCreate] = useState(false)
  const [pacienteSearch, setPacienteSearch] = useState('')
  const [submittedDni, setSubmittedDni] = useState('')
  const [newHistoria, setNewHistoria] = useState({ paciente_id: '', medico_id: '', diagnostico: '' })
  const pageSize = 20

  const medicosQuery = useQuery({ queryKey: ['medicos'], queryFn: fetchMedicos })

  const pacientesQuery = useQuery({
    queryKey: ['pacientes', 'historia-create', { dni: submittedDni }],
    queryFn: () => fetchPacientes(submittedDni, 1, 8),
    enabled: showCreate && submittedDni.length > 0,
  })

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

  const createMutation = useMutation({
    mutationFn: createHistoria,
    onSuccess: (historia) => {
      toastSuccess('Historia clinica creada.')
      void queryClient.invalidateQueries({ queryKey: ['historias'] })
      navigate(`/historias/${historia.id}`)
    },
    onError: (err) => {
      toastError(extractApiError(err).message || 'No se pudo crear la historia.')
    },
  })

  async function handleArchive(id: string, label: string) {
    const confirmed = await confirmArchivar(label)
    if (confirmed) archiveMutation.mutate(id)
  }

  function handleCreate() {
    const diagnostico = newHistoria.diagnostico.trim()
    if (!newHistoria.paciente_id || !newHistoria.medico_id || !diagnostico) {
      toastError('Selecciona paciente, medico y diagnostico.')
      return
    }
    createMutation.mutate({ ...newHistoria, diagnostico })
  }

  function handleBuscarPaciente() {
    const dni = pacienteSearch.trim()
    if (!dni) {
      toastError('Ingresa el DNI del paciente.')
      return
    }
    setNewHistoria((h) => ({ ...h, paciente_id: '' }))
    setSubmittedDni(dni)
  }

  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const filtros = {
        q: debouncedSearch || undefined,
        medico_id: medicoId || undefined,
        estado_revision: tab === 'todos' ? undefined : tab,
      }
      const all: Historia[] = []
      let p = 1
      let pages = 1
      do {
        const res = await fetchHistorias({ ...filtros, page: p, page_size: 100 })
        all.push(...res.data)
        pages = res.total_pages
        p += 1
      } while (p <= pages)

      if (all.length === 0) {
        toastError('No hay historias para exportar con los filtros actuales.')
        return
      }

      downloadCsv('historias-clinicas.csv', [
        ['Paciente', 'DNI', 'Médico', 'Diagnóstico', 'Plan de trabajo', 'Objetivos', 'Estado', 'Plazo'],
        ...all.map((h) => [
          pacienteNombre(h),
          pacienteDni(h),
          medicoNombre(h),
          h.diagnostico,
          h.plan_trabajo_estado ? EVAL_ESTADO_LABEL[h.plan_trabajo_estado] : 'Sin datos',
          h.objetivos_estado ? EVAL_ESTADO_LABEL[h.objetivos_estado] : 'Sin datos',
          ESTADO_REVISION_LABEL[h.estado_revision],
          h.plazo ? formatDate(h.plazo) : '—',
        ]),
      ])
      toastSuccess(`${all.length} historias exportadas.`)
    } catch (err) {
      toastError(extractApiError(err).message || 'No se pudo exportar la lista.')
    } finally {
      setExporting(false)
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text">Historias clínicas</h1>
          <p className="text-sm text-text-muted">Busca, filtra y gestiona las historias registradas.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex min-h-control items-center justify-center gap-2 rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors duration-150 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex min-h-control items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
          >
            <Plus size={16} />
            Nueva historia
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 py-8">
          <div className="max-h-[calc(100vh-64px)] w-full max-w-4xl overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-text">Nueva historia clinica</h2>
                <p className="text-sm text-text-muted">Busca al paciente por DNI, seleccionalo y registra el diagnostico inicial.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg hover:text-text"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-soft">DNI del paciente</span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      value={pacienteSearch}
                      onChange={(e) => {
                        setPacienteSearch(e.target.value.replace(/\D/g, '').slice(0, 8))
                        setSubmittedDni('')
                        setNewHistoria((h) => ({ ...h, paciente_id: '' }))
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleBuscarPaciente()
                        }
                      }}
                      placeholder="Ej. 48054725"
                      inputMode="numeric"
                      className="min-h-control w-full rounded-control border border-border pl-9 pr-3 text-text"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBuscarPaciente}
                    className="inline-flex min-h-control items-center justify-center gap-2 rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors hover:bg-bg"
                  >
                    <Search size={16} />
                    Buscar
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-soft">Medico responsable</span>
                <select
                  value={newHistoria.medico_id}
                  onChange={(e) => setNewHistoria((h) => ({ ...h, medico_id: e.target.value }))}
                  className="min-h-control rounded-control border border-border bg-white px-3 text-text"
                >
                  <option value="">Seleccionar medico</option>
                  {medicosQuery.data?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.titulo} {m.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {submittedDni && (
              <div className="mt-4 rounded-card border border-border">
                <div className="border-b border-[#EEF2F1] px-4 py-3 text-sm font-medium text-text-soft">Resultados</div>
                <div className="max-h-56 overflow-y-auto">
                  {pacientesQuery.isLoading ? (
                    <div className="p-4 text-sm text-text-muted">Buscando...</div>
                  ) : !pacientesQuery.data || pacientesQuery.data.data.length === 0 ? (
                    <div className="p-4 text-sm text-text-muted">No se encontraron pacientes con ese DNI.</div>
                  ) : (
                    pacientesQuery.data.data.map((p) => {
                      const selected = newHistoria.paciente_id === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setNewHistoria((h) => ({ ...h, paciente_id: p.id }))}
                          className={`flex w-full items-center justify-between gap-3 border-b border-[#EEF2F1] px-4 py-3 text-left text-sm last:border-0 ${
                            selected ? 'bg-primary-soft text-primary' : 'hover:bg-bg'
                          }`}
                        >
                          <span>
                            <span className="font-medium">{p.apellidos}, {p.nombres}</span>
                            <span className="ml-2 text-text-muted">{p.dni}</span>
                          </span>
                          {selected && <span className="text-xs font-medium">Seleccionado</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-soft">Diagnostico inicial</span>
              <textarea
                value={newHistoria.diagnostico}
                onChange={(e) => setNewHistoria((h) => ({ ...h, diagnostico: e.target.value }))}
                rows={3}
                className="rounded-control border border-border px-3 py-2 text-text"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex min-h-control items-center justify-center rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors hover:bg-bg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="inline-flex min-h-control items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} />
                Crear e ingresar
              </button>
            </div>
          </div>
        </div>
      )}

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
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-[#F7FAF9] text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-medium">Paciente</th>
                <th className="px-3 py-2 font-medium">DNI</th>
                <th className="px-3 py-2 font-medium">Médico</th>
                <th className="px-3 py-2 font-medium">Plan de trabajo</th>
                <th className="px-3 py-2 font-medium">Objetivos</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Plazo</th>
                <th className="px-3 py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            {!historiasQuery.isLoading && (
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b border-[#EEF2F1] last:border-0 hover:bg-bg/50">
                    <td className="px-3 py-1.5">
                      <Link to={`/historias/${h.id}`} className="font-medium text-text hover:text-primary">
                        {pacienteNombre(h)}
                      </Link>
                      <p className="truncate text-xs text-text-muted">{h.diagnostico}</p>
                    </td>
                    <td className="px-3 py-1.5 text-text-soft">{pacienteDni(h)}</td>
                    <td className="px-3 py-1.5 text-text-soft">{medicoNombre(h)}</td>
                    <td className="px-3 py-1.5">
                      <EvalBadge value={h.plan_trabajo_estado} />
                    </td>
                    <td className="px-3 py-1.5">
                      <EvalBadge value={h.objetivos_estado} />
                    </td>
                    <td className="px-3 py-1.5">
                      <EstadoRevisionBadge value={h.estado_revision} />
                    </td>
                    <td className="px-3 py-1.5 text-text-soft">{formatDate(h.plazo)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/historias/${h.id}`)}
                          aria-label="Ver historia"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-primary-soft hover:text-primary"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(h.id, pacienteNombre(h))}
                          aria-label="Archivar historia"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-danger-soft-bg hover:text-danger-soft-fg"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
          {historiasQuery.isLoading && <TableSkeleton rows={8} cols={8} />}
        </div>

        {!historiasQuery.isLoading && rows.length === 0 && (
          <EmptyState
            title="No se encontraron historias"
            description="Ajusta la búsqueda o los filtros para ver resultados."
          />
        )}

        {!historiasQuery.isLoading && rows.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={historiasQuery.data?.total} />
        )}
      </div>
    </div>
  )
}
