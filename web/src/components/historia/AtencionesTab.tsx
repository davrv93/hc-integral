import { FormEvent, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { createAtencion, deleteAtencion, fetchAtenciones, type CreateAtencionInput } from '@/lib/endpoints'
import { DISCIPLINA_LABEL, EVAL_ESTADO_LABEL, EVAL_ESTADO_ORDER, formatDateTime } from '@/lib/labels'
import type { Disciplina } from '@/lib/types'
import { extractApiError } from '@/lib/api'
import { confirmEliminarAtenciones, toastError, toastSuccess } from '@/lib/alerts'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

const DISCIPLINAS: Disciplina[] = ['medicina', 'psicologia', 'terapia_fisica', 'nutricion']

const EMPTY_FORM: CreateAtencionInput = {
  disciplina: 'medicina',
  motivo: '',
  detalle: '',
  plan_trabajo_estado: undefined,
  objetivos_estado: undefined,
  necesidades: '',
  objetivos_propuestos: '',
  plan_actual: '',
  observaciones: '',
}

function clean(form: CreateAtencionInput): CreateAtencionInput {
  return {
    disciplina: form.disciplina,
    motivo: form.motivo.trim(),
    detalle: form.detalle.trim(),
    plan_trabajo_estado: form.plan_trabajo_estado || undefined,
    objetivos_estado: form.objetivos_estado || undefined,
    necesidades: form.necesidades?.trim() || undefined,
    objetivos_propuestos: form.objetivos_propuestos?.trim() || undefined,
    plan_actual: form.plan_actual?.trim() || undefined,
    observaciones: form.observaciones?.trim() || undefined,
  }
}

export function AtencionesTab({ historiaId }: { historiaId: string }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateAtencionInput>(EMPTY_FORM)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const atencionesQuery = useQuery({
    queryKey: ['historia', historiaId, 'atenciones'],
    queryFn: () => fetchAtenciones(historiaId),
  })

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['historia', historiaId] }),
      queryClient.invalidateQueries({ queryKey: ['historia', historiaId, 'atenciones'] }),
    ])

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => deleteAtencion(historiaId, id))),
    onSuccess: async (_r, ids) => {
      toastSuccess(ids.length === 1 ? 'Atención eliminada.' : `${ids.length} atenciones eliminadas.`)
      setSelected(new Set())
      await invalidate()
    },
    onError: (error) => toastError(extractApiError(error).message || 'No se pudieron eliminar las atenciones.'),
  })

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    const confirmed = await confirmEliminarAtenciones(ids.length)
    if (confirmed) deleteMutation.mutate(ids)
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateAtencionInput) => createAtencion(historiaId, input),
    onSuccess: async () => {
      toastSuccess('Atencion registrada.')
      setForm(EMPTY_FORM)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['historia', historiaId] }),
        queryClient.invalidateQueries({ queryKey: ['historia', historiaId, 'atenciones'] }),
      ])
    },
    onError: (error) => toastError(extractApiError(error).message),
  })

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const payload = clean(form)
    if (!payload.motivo || !payload.detalle) {
      toastError('Motivo y detalle son obligatorios.')
      return
    }
    createMutation.mutate(payload)
  }

  const atenciones = atencionesQuery.data ?? []

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-text-soft">Disciplina</span>
            <select
              value={form.disciplina}
              onChange={(e) => setForm((f) => ({ ...f, disciplina: e.target.value as Disciplina }))}
              className="min-h-control rounded-control border border-border bg-white px-3 text-text"
            >
              {DISCIPLINAS.map((d) => (
                <option key={d} value={d}>{DISCIPLINA_LABEL[d]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="font-medium text-text-soft">Motivo</span>
            <input
              value={form.motivo}
              onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
              className="min-h-control rounded-control border border-border px-3 text-text"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-text-soft">Detalle de la atencion</span>
          <textarea
            value={form.detalle}
            onChange={(e) => setForm((f) => ({ ...f, detalle: e.target.value }))}
            rows={2}
            className="rounded-control border border-border p-3 text-text"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['plan_trabajo_estado', 'objetivos_estado'] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-soft">{field === 'plan_trabajo_estado' ? 'Plan de trabajo' : 'Objetivos'}</span>
              <select
                value={form[field] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value || undefined }))}
                className="min-h-control rounded-control border border-border bg-white px-3 text-text"
              >
                <option value="">Sin evaluar</option>
                {EVAL_ESTADO_ORDER.map((v) => (
                  <option key={v} value={v}>{EVAL_ESTADO_LABEL[v]}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['necesidades', 'objetivos_propuestos', 'plan_actual', 'observaciones'] as const).map((field) => (
            <label key={field} className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-text-soft">
                {field === 'necesidades' ? 'Necesidades' : field === 'objetivos_propuestos' ? 'Objetivos propuestos' : field === 'plan_actual' ? 'Plan actual' : 'Observaciones'}
              </span>
              <textarea
                value={form[field] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                rows={2}
                className="rounded-control border border-border p-2.5 text-text"
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={createMutation.isPending}>
            <Plus size={16} />
            Registrar atencion
          </Button>
        </div>
      </form>

      <div className="rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-[#EEF2F1] px-4 py-3">
          <div className="flex items-center gap-2">
            {atenciones.length > 0 && (
              <input
                type="checkbox"
                aria-label="Seleccionar todas"
                checked={selected.size === atenciones.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(atenciones.map((a) => a.id)) : new Set())}
                className="h-4 w-4 rounded border-border accent-primary"
              />
            )}
            <span className="text-sm font-medium text-text-soft">
              {selected.size > 0 ? `${selected.size} seleccionada${selected.size === 1 ? '' : 's'}` : 'Historial de atenciones'}
            </span>
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deleteMutation.isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium text-danger-soft-fg transition-colors hover:bg-danger-soft-bg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} />
              Eliminar
            </button>
          )}
        </div>
        {atencionesQuery.isLoading ? (
          <div className="p-4"><Skeleton className="h-56" /></div>
        ) : atenciones.length === 0 ? (
          <EmptyState title="Sin atenciones" description="Registra la primera atencion para iniciar la evolucion." />
        ) : (
          <div className="divide-y divide-[#EEF2F1]">
            {atenciones.map((a) => (
              <article key={a.id} className="flex gap-3 p-4 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Seleccionar atención de ${formatDateTime(a.fecha)}`}
                  checked={selected.has(a.id)}
                  onChange={() => toggleSelected(a.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text">{DISCIPLINA_LABEL[a.disciplina]}</span>
                    <span className="text-xs text-text-muted">{formatDateTime(a.fecha)}</span>
                  </div>
                  <p className="mt-1 font-medium text-text-soft">{a.motivo}</p>
                  <p className="mt-1 text-text-muted">{a.detalle}</p>
                  <p className="mt-2 text-xs text-text-muted">Plan: {a.plan_trabajo_estado ?? '-'} · Objetivos: {a.objetivos_estado ?? '-'}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
