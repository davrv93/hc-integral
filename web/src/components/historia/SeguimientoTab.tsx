import { Controller, useFormContext } from 'react-hook-form'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ESTADO_REVISION_LABEL, ESTADO_REVISION_ORDER } from '@/lib/labels'
import type { HistoriaFormValues } from '@/lib/schemas'

const ESTADO_OPTIONS = ESTADO_REVISION_ORDER.map((v) => ({ value: v, label: ESTADO_REVISION_LABEL[v] }))

export function SeguimientoTab() {
  const { control, register } = useFormContext<HistoriaFormValues>()

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-border bg-surface p-4">
        <label className="mb-2 block text-sm font-medium text-text-soft" htmlFor="plazo">
          Plazo
        </label>
        <input
          id="plazo"
          type="date"
          {...register('plazo')}
          className="min-h-control rounded-control border border-border bg-white px-3 text-sm text-text focus-visible:border-primary"
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium text-text-soft">Estado de revisión</p>
        <Controller
          control={control}
          name="estado_revision"
          render={({ field }) => (
            <SegmentedControl label="Estado de revisión" options={ESTADO_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <label className="mb-2 block text-sm font-medium text-text-soft" htmlFor="observaciones">
          Observaciones
        </label>
        <textarea
          id="observaciones"
          rows={3}
          {...register('observaciones')}
          className="w-full rounded-control border border-border bg-white p-3 text-sm text-text placeholder:text-text-muted focus-visible:border-primary"
          placeholder="Observaciones del seguimiento…"
        />
      </div>
    </div>
  )
}
