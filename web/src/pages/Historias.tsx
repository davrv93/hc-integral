import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, Download, Eye, Plus, Search, Upload, X } from 'lucide-react'
import { createHistoria, deleteHistoria, fetchHistorias, fetchMedicos, fetchPacientes } from '@/lib/endpoints'
import type { EstadoRevision, Historia } from '@/lib/types'
import { ESTADO_REVISION_LABEL, ESTADO_REVISION_ORDER, EVAL_ESTADO_LABEL, formatDate } from '@/lib/labels'
import { EstadoRevisionBadge, EvalBadge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { confirmArchivar, confirmArchivarMultiples, toastError, toastSuccess } from '@/lib/alerts'
import { extractApiError } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { ImportarAtencionesModal } from '@/components/historia/ImportarAtencionesModal'

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
  const [showImport, setShowImport] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
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

  const archiveManyMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => deleteHistoria(id))),
    onSuccess: (_r, ids) => {
      toastSuccess(ids.length === 1 ? 'Historia archivada correctamente.' : `${ids.length} historias archivadas.`)
      setSelected(new Set())
      void queryClient.invalidateQueries({ queryKey: ['historias'] })
    },
    onError: (err) => {
      toastError(extractApiError(err).message || 'No se pudieron archivar algunas historias.')
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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleArchiveSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const confirmed = await confirmArchivarMultiples(ids.length)
    if (confirmed) archiveManyMutation.mutate(ids)
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
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors duration-150 hover:bg-bg sm:w-auto"
          >
            <Upload size={16} />
            Importar atenciones
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors duration-150 hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Download size={16} />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover sm:w-auto"
          >
            <Plus size={16} />
            Nueva historia
          </button>
        </div>
      </div>

      {showImport && <ImportarAtencionesModal onClose={() => setShowImport(false)} />}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="new-historia-title" className="max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto rounded-t-card border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[calc(100vh-3rem)] sm:rounded-card sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 id="new-historia-title" className="font-serif text-xl font-semibold text-text">Nueva historia clinica</h2>
                <p className="text-sm text-text-muted">Busca al paciente por DNI, seleccionalo y registra el diagnostico inicial.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg hover:text-text"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-soft">DNI del paciente</span>
                <div className="flex flex-col gap-2 sm:flex-row">
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
                    className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors hover:bg-bg sm:w-auto"
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

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex min-h-control w-full items-center justify-center rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors hover:bg-bg sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Plus size={16} />
                Crear e ingresar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
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
              className={`inline-flex min-h-control shrink-0 items-center gap-2 rounded-control px-4 text-sm font-medium transition-colors duration-150 ease-out ${
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor="search-historias" className="sr-only">Buscar historias clínicas</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            id="search-historias"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Buscar por paciente, DNI o diagnóstico…"
            className="min-h-control w-full rounded-control border border-border bg-white pl-9 pr-3 text-base text-text placeholder:text-text-muted focus-visible:border-primary sm:text-sm"
          />
        </div>
        <label className="flex flex-col gap-1 text-sm lg:w-64">
          <span className="sr-only">Filtrar por médico</span>
          <select
            value={medicoId}
            onChange={(e) => {
              setMedicoId(e.target.value)
              setPage(1)
            }}
            className="min-h-control w-full rounded-control border border-border bg-white px-3 text-base text-text-soft sm:text-sm"
          >
            <option value="">Todos los médicos</option>
            {medicosQuery.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.titulo} {m.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {selected.size > 0 && (
          <div className="flex flex-col gap-2 border-b border-[#EEF2F1] bg-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium text-primary">
              {selected.size} historia{selected.size === 1 ? '' : 's'} seleccionada{selected.size === 1 ? '' : 's'}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm font-medium text-text-soft hover:text-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleArchiveSelected}
                disabled={archiveManyMutation.isPending}
                className="inline-flex min-h-control items-center gap-1.5 rounded-control bg-danger px-3 text-sm font-medium text-white transition-colors hover:bg-[#8f2f22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Archive size={14} />
                Archivar seleccionadas
              </button>
            </div>
          </div>
        )}
        <div className="divide-y divide-[#EEF2F1] xl:hidden">
          {historiasQuery.isLoading ? (
            <div className="p-4"><TableSkeleton rows={4} cols={1} /></div>
          ) : rows.map((h) => (
            <article key={h.id} className="p-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar historia de ${pacienteNombre(h)}`}
                  checked={selected.has(h.id)}
                  onChange={() => toggleSelected(h.id)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-border accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <Link to={`/historias/${h.id}`} className="font-medium text-text hover:text-primary">
                    {pacienteNombre(h)}
                  </Link>
                  <p className="mt-1 break-words text-sm text-text-muted">{h.diagnostico}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => navigate(`/historias/${h.id}`)}
                    aria-label="Ver historia"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-control text-primary hover:bg-primary-soft"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(h.id, pacienteNombre(h))}
                    aria-label="Archivar historia"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-control text-danger-soft-fg hover:bg-danger-soft-bg"
                  >
                    <Archive size={18} />
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 pl-8 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">DNI</dt>
                  <dd className="mt-1 text-text-soft">{pacienteDni(h)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Médico</dt>
                  <dd className="mt-1 break-words text-text-soft">{medicoNombre(h)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Plan de trabajo</dt>
                  <dd className="mt-1"><EvalBadge value={h.plan_trabajo_estado} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Objetivos</dt>
                  <dd className="mt-1"><EvalBadge value={h.objetivos_estado} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Estado</dt>
                  <dd className="mt-1"><EstadoRevisionBadge value={h.estado_revision} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Plazo</dt>
                  <dd className="mt-1 text-text-soft">{formatDate(h.plazo)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="bg-[#F7FAF9] text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="w-10 px-3 py-2">
                  {rows.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas en esta página"
                      checked={rows.every((h) => selected.has(h.id))}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          rows.forEach((h) => (e.target.checked ? next.add(h.id) : next.delete(h.id)))
                          return next
                        })
                      }
                      className="h-5 w-5 rounded border-border accent-primary"
                    />
                  )}
                </th>
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
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar historia de ${pacienteNombre(h)}`}
                        checked={selected.has(h.id)}
                        onChange={() => toggleSelected(h.id)}
                        className="h-5 w-5 rounded border-border accent-primary"
                      />
                    </td>
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
                          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-primary-soft hover:text-primary"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(h.id, pacienteNombre(h))}
                          aria-label="Archivar historia"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-control text-text-muted transition-colors duration-150 hover:bg-danger-soft-bg hover:text-danger-soft-fg"
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
          {historiasQuery.isLoading && <TableSkeleton rows={8} cols={9} />}
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
