import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Users } from 'lucide-react'
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
    fecha_nac: form.fecha_nac || undefined,
    sexo: form.sexo || undefined,
    telefono: form.telefono?.trim() || undefined,
  }
}

export function Pacientes() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<CreatePacienteInput>(EMPTY_FORM)
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
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text">Pacientes</h1>
        <p className="text-sm text-text-muted">Alta y busqueda del padron de pacientes.</p>
      </div>

      <form onSubmit={submit} className="rounded-card border border-border bg-surface p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="flex flex-col gap-1 text-sm md:col-span-1">
            <span className="font-medium text-text-soft">DNI</span>
            <input
              value={form.dni}
              onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
              className="min-h-control rounded-control border border-border px-3 text-text"
              inputMode="numeric"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-text-soft">Nombres</span>
            <input
              value={form.nombres}
              onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))}
              className="min-h-control rounded-control border border-border px-3 text-text"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-text-soft">Apellidos</span>
            <input
              value={form.apellidos}
              onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
              className="min-h-control rounded-control border border-border px-3 text-text"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-1">
            <span className="font-medium text-text-soft">Nacimiento</span>
            <input
              type="date"
              value={form.fecha_nac ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, fecha_nac: e.target.value }))}
              className="min-h-control rounded-control border border-border px-3 text-text"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-1">
            <span className="font-medium text-text-soft">Sexo</span>
            <select
              value={form.sexo ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sexo: e.target.value }))}
              className="min-h-control rounded-control border border-border bg-white px-3 text-text"
            >
              <option value="">Sin dato</option>
              <option value="F">F</option>
              <option value="M">M</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-text-soft">Telefono</span>
            <input
              value={form.telefono ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              className="min-h-control rounded-control border border-border px-3 text-text"
            />
          </label>
          <div className="flex items-end md:col-span-3">
            <Button type="submit" loading={createMutation.isPending}>
              <Plus size={16} />
              Crear paciente
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-card border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF2F1] p-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-text">Padron</h2>
            <p className="text-sm text-text-muted">{pacientesQuery.data?.total ?? 0} pacientes registrados</p>
          </div>
          <label className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por DNI, nombres o apellidos"
              className="min-h-control w-full rounded-control border border-border pl-9 pr-3 text-sm text-text"
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
            <div className="overflow-x-auto">
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
