import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users, X } from 'lucide-react'
import { createPaciente, fetchPacientes, type CreatePacienteInput } from '@/lib/endpoints'
import { extractApiError } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { useDebounce } from '@/hooks/useDebounce'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 10

const EMPTY_FORM: CreatePacienteInput = {
  dni: '',
  nombres: '',
  apellidos: '',
  fecha_nac: '',
  sexo: '',
  telefono: '',
}

function cleanPacienteForm(form: CreatePacienteInput): CreatePacienteInput {
  return {
    dni: form.dni.trim(),
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
    fecha_nac: form.fecha_nac,
    sexo: form.sexo,
    telefono: form.telefono?.trim() || undefined,
  }
}

export function Pacientes() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<CreatePacienteInput>(EMPTY_FORM)
  const [showCreate, setShowCreate] = useState(false)
  const debouncedQ = useDebounce(q, 350)

  const pacientesQuery = useQuery({
    queryKey: ['pacientes', { q: debouncedQ, page }],
    queryFn: () => fetchPacientes(debouncedQ, page, PAGE_SIZE),
  })

  const createMutation = useMutation({
    mutationFn: createPaciente,
    onSuccess: async (paciente) => {
      toastSuccess(`Paciente ${paciente.nombres} ${paciente.apellidos} creado.`)
      setForm(EMPTY_FORM)
      setShowCreate(false)
      setPage(1)
      await queryClient.invalidateQueries({ queryKey: ['pacientes'] })
    },
    onError: (error) => {
      toastError(extractApiError(error).message)
    },
  })

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const payload = cleanPacienteForm(form)
    if (!/^\d{8}$/.test(payload.dni)) {
      toastError('El DNI debe tener exactamente 8 digitos.')
      return
    }
    if (!payload.nombres || !payload.apellidos) {
      toastError('Nombres y apellidos son obligatorios.')
      return
    }
    createMutation.mutate(payload)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text">Pacientes</h1>
          <p className="text-sm text-text-muted">Consulta el padrón o registra un paciente.</p>
        </div>
        <Button type="button" onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus size={16} />
          Nuevo paciente
        </Button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-paciente-title"
            className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-t-card border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[calc(100vh-3rem)] sm:rounded-card sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 id="create-paciente-title" className="font-serif text-xl font-semibold text-text">Nuevo paciente</h2>
                <p className="text-sm text-text-muted">Completa los datos obligatorios de identificación.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Cerrar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-bg hover:text-text"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-text-soft">DNI</span>
                  <input
                    autoFocus
                    value={form.dni}
                    onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    className="min-h-control rounded-control border border-border px-3 text-text"
                    inputMode="numeric"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-text-soft">Nombres</span>
                  <input
                    value={form.nombres}
                    onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
                    className="min-h-control rounded-control border border-border px-3 text-text"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="font-medium text-text-soft">Apellidos</span>
                  <input
                    value={form.apellidos}
                    onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
                    className="min-h-control rounded-control border border-border px-3 text-text"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-text-soft">Fecha de nacimiento</span>
                  <input
                    type="date"
                    value={form.fecha_nac ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_nac: e.target.value }))}
                    className="min-h-control rounded-control border border-border px-3 text-text"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-text-soft">Sexo</span>
                  <select
                    value={form.sexo ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value }))}
                    className="min-h-control rounded-control border border-border bg-white px-3 text-text"
                    required
                  >
                    <option value="" disabled>Seleccionar</option>
                    <option value="F">F</option>
                    <option value="M">M</option>
                  </select>
                </label>
              </div>

              <details className="mt-4">
                <summary className="flex min-h-control cursor-pointer items-center rounded-control border border-border px-3 text-sm font-medium text-text-soft">
                  Añadir teléfono (opcional)
                </summary>
                <label className="mt-3 flex flex-col gap-1 text-sm">
                  <span className="font-medium text-text-soft">Teléfono</span>
                  <input
                    value={form.telefono ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                    className="min-h-control rounded-control border border-border px-3 text-text"
                  />
                </label>
              </details>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" loading={createMutation.isPending} className="w-full sm:w-auto">
                  <Plus size={16} />
                  Crear paciente
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-card border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F1] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold text-text">Padron</h2>
            <p className="text-sm text-text-muted">{pacientesQuery.data?.total ?? 0} pacientes registrados</p>
          </div>
          <label className="relative w-full sm:w-64">
            <span id="search-pacientes-label" className="sr-only">Buscar pacientes</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              aria-labelledby="search-pacientes-label"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por DNI o nombre"
              className="min-h-control w-full rounded-control border border-border pl-9 pr-3 text-base text-text sm:text-sm"
            />
          </label>
        </div>

        {pacientesQuery.isLoading ? (
          <div className="p-5">
            <Skeleton className="h-56" />
          </div>
        ) : !pacientesQuery.data || pacientesQuery.data.data.length === 0 ? (
          <EmptyState icon={Users} title="Sin pacientes" description="Crea un paciente o cambia el criterio de busqueda." />
        ) : (
          <>
            <div className="divide-y divide-[#EEF2F1] xl:hidden">
              {pacientesQuery.data.data.map((p) => (
                <article key={p.id} className="p-4">
                  <h3 className="font-medium text-text">{p.apellidos}, {p.nombres}</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-text-muted">DNI</dt>
                      <dd className="mt-0.5 text-text-soft">{p.dni}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Nacimiento</dt>
                      <dd className="mt-0.5 text-text-soft">{p.fecha_nac ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Sexo</dt>
                      <dd className="mt-0.5 text-text-soft">{p.sexo ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Teléfono</dt>
                      <dd className="mt-0.5 break-words text-text-soft">{p.telefono ?? '—'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-[#F7FAF9] text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">DNI</th>
                    <th className="px-4 py-3 font-medium">Nacimiento</th>
                    <th className="px-4 py-3 font-medium">Sexo</th>
                    <th className="px-4 py-3 font-medium">Telefono</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientesQuery.data.data.map((p) => (
                    <tr key={p.id} className="border-b border-[#EEF2F1] last:border-0">
                      <td className="px-4 py-3 font-medium text-text">
                        {p.apellidos}, {p.nombres}
                      </td>
                      <td className="px-4 py-3 text-text-soft">{p.dni}</td>
                      <td className="px-4 py-3 text-text-soft">{p.fecha_nac ?? '-'}</td>
                      <td className="px-4 py-3 text-text-soft">{p.sexo ?? '-'}</td>
                      <td className="px-4 py-3 text-text-soft">{p.telefono ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#EEF2F1] p-4">
              <Pagination
                page={pacientesQuery.data.page}
                totalPages={pacientesQuery.data.total_pages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
