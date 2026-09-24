import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { fetchHistoria, patchHistoria } from '@/lib/endpoints'
import type { Historia } from '@/lib/types'
import { historiaFormSchema, type HistoriaFormValues } from '@/lib/schemas'
import { extractApiError } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { Tabs } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { EstadoRevisionBadge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { IdentificacionTab } from '@/components/historia/IdentificacionTab'
import { EvaluacionTab } from '@/components/historia/EvaluacionTab'
import { PropuestaTab } from '@/components/historia/PropuestaTab'
import { SeguimientoTab } from '@/components/historia/SeguimientoTab'
import { HistorialTab } from '@/components/historia/HistorialTab'
import { EvolucionTab } from '@/components/historia/EvolucionTab'
import { AtencionesTab } from '@/components/historia/AtencionesTab'

const TABS = [
  { value: 'identificacion', label: 'Identificación' },
  { value: 'atenciones', label: 'Atenciones' },
  { value: 'evaluacion', label: 'Evaluación' },
  { value: 'propuesta', label: 'Propuesta interdisciplinaria' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'evolucion', label: 'Evolución' },
  { value: 'historial', label: 'Historial' },
]

function toFormValues(historia: Historia): HistoriaFormValues {
  return {
    plan_trabajo_estado: historia.plan_trabajo_estado ?? null,
    objetivos_estado: historia.objetivos_estado ?? null,
    necesidades: historia.necesidades ?? '',
    objetivos_propuestos: historia.objetivos_propuestos ?? '',
    plan_actual: historia.plan_actual ?? '',
    plazo: historia.plazo ?? '',
    estado_revision: historia.estado_revision,
    observaciones: historia.observaciones ?? '',
  }
}

export function HistoriaDetalle() {
  const { id } = useParams<{ id: string }>()
  const historiaId = id as string
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('identificacion')
  const initializedRef = useRef(false)

  const historiaQuery = useQuery({
    queryKey: ['historia', historiaId],
    queryFn: () => fetchHistoria(historiaId),
    enabled: !!historiaId,
  })

  const methods = useForm<HistoriaFormValues>({
    resolver: zodResolver(historiaFormSchema),
    defaultValues: {
      plan_trabajo_estado: null,
      objetivos_estado: null,
      necesidades: '',
      objetivos_propuestos: '',
      plan_actual: '',
      plazo: '',
      estado_revision: 'en_revision',
      observaciones: '',
    },
  })

  useEffect(() => {
    if (historiaQuery.data && !initializedRef.current) {
      methods.reset(toFormValues(historiaQuery.data))
      initializedRef.current = true
    }
  }, [historiaQuery.data, methods])

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<Historia>) => patchHistoria(historiaId, patch),
    onSuccess: (updated) => {
      toastSuccess('Cambios guardados correctamente.')
      queryClient.setQueryData(['historia', historiaId], updated)
      methods.reset(toFormValues(updated))
    },
    onError: (err) => {
      toastError(extractApiError(err).message || 'No se pudieron guardar los cambios.')
    },
  })

  function onSubmit(values: HistoriaFormValues) {
    const dirty = methods.formState.dirtyFields
    const patch: Partial<Historia> = {}
    if (dirty.plan_trabajo_estado) patch.plan_trabajo_estado = values.plan_trabajo_estado
    if (dirty.objetivos_estado) patch.objetivos_estado = values.objetivos_estado
    if (dirty.necesidades) patch.necesidades = values.necesidades
    if (dirty.objetivos_propuestos) patch.objetivos_propuestos = values.objetivos_propuestos
    if (dirty.plan_actual) patch.plan_actual = values.plan_actual
    if (dirty.plazo) patch.plazo = values.plazo || null
    if (dirty.estado_revision) patch.estado_revision = values.estado_revision
    if (dirty.observaciones) patch.observaciones = values.observaciones

    if (Object.keys(patch).length === 0) {
      toastError('No hay cambios por guardar.')
      return
    }
    saveMutation.mutate(patch)
  }

  if (historiaQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (historiaQuery.isError || !historiaQuery.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-danger-soft-fg">No se pudo cargar la historia clínica.</p>
        <Link to="/historias" className="text-primary hover:underline">
          Volver a historias
        </Link>
      </div>
    )
  }

  const historia = historiaQuery.data
  const pacienteNombre = historia.paciente ? `${historia.paciente.nombres} ${historia.paciente.apellidos}` : `#${historia.correlativo}`

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="flex flex-col gap-6 pb-24">
        <div className="flex flex-col gap-3">
          <Link to="/historias" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary">
            <ArrowLeft size={14} />
            Historias clínicas
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-semibold text-text">{pacienteNombre}</h1>
              <p className="text-sm text-text-muted">{historia.diagnostico}</p>
            </div>
            <EstadoRevisionBadge value={historia.estado_revision} />
          </div>
        </div>

        <div className="rounded-card border border-border bg-surface">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
          <div className="p-6">
            {tab === 'identificacion' && <IdentificacionTab historia={historia} />}
            {tab === 'atenciones' && <AtencionesTab historiaId={historiaId} />}
            {tab === 'evaluacion' && <EvaluacionTab />}
            {tab === 'propuesta' && <PropuestaTab historiaId={historiaId} />}
            {tab === 'seguimiento' && <SeguimientoTab />}
            {tab === 'evolucion' && <EvolucionTab historiaId={historiaId} />}
            {tab === 'historial' && <HistorialTab historiaId={historiaId} />}
          </div>
        </div>

        <div className="fixed bottom-0 left-[240px] right-0 border-t border-border bg-surface/95 px-7 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1200px] items-center justify-end gap-3">
            <span className="text-sm text-text-muted">
              {methods.formState.isDirty ? 'Tienes cambios sin guardar' : 'Sin cambios pendientes'}
            </span>
            <Button type="submit" loading={saveMutation.isPending} disabled={!methods.formState.isDirty}>
              <Save size={16} />
              Registrar atencion
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
