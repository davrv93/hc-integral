import { Controller, useFormContext } from 'react-hook-form'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EVAL_ESTADO_ORDER, EVAL_ESTADO_LABEL } from '@/lib/labels'
import type { HistoriaFormValues } from '@/lib/schemas'

const EVAL_OPTIONS = EVAL_ESTADO_ORDER.map((v) => ({ value: v, label: EVAL_ESTADO_LABEL[v] }))

export function EvaluacionTab() {
  const { control, register } = useFormContext<HistoriaFormValues>()

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <p className="mb-2 text-sm font-medium text-text-soft">Plan de trabajo</p>
        <Controller
          control={control}
          name="plan_trabajo_estado"
          render={({ field }) => (
            <SegmentedControl options={EVAL_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <p className="mb-2 text-sm font-medium text-text-soft">Objetivos</p>
        <Controller
          control={control}
          name="objetivos_estado"
          render={({ field }) => (
            <SegmentedControl options={EVAL_OPTIONS} value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-5">
        <label className="mb-2 block text-sm font-medium text-text-soft" htmlFor="necesidades">
          Necesidades identificadas
        </label>
        <textarea
          id="necesidades"
          rows={5}
          {...register('necesidades')}
          className="w-full rounded-control border border-border bg-white p-3 text-sm text-text placeholder:text-text-muted focus-visible:border-primary"
          placeholder="Describe las necesidades identificadas en la evaluación…"
        />
      </div>
    </div>
  )
}
