import { useFormContext } from 'react-hook-form'
import type { Disciplina } from '@/lib/types'
import type { HistoriaFormValues } from '@/lib/schemas'
import { IntervencionCard } from './IntervencionCard'

const DISCIPLINAS: Disciplina[] = ['medicina', 'psicologia', 'terapia_fisica', 'nutricion']

export function PropuestaTab({ historiaId }: { historiaId: string }) {
  const { register } = useFormContext<HistoriaFormValues>()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 font-serif text-base font-semibold text-text">Intervenciones por disciplina</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {DISCIPLINAS.map((d) => (
            <IntervencionCard key={d} historiaId={historiaId} disciplina={d} />
          ))}
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <label className="mb-2 block text-sm font-medium text-text-soft" htmlFor="objetivos_propuestos">
          Objetivos propuestos
        </label>
        <textarea
          id="objetivos_propuestos"
          rows={3}
          {...register('objetivos_propuestos')}
          className="w-full rounded-control border border-border bg-white p-3 text-sm text-text placeholder:text-text-muted focus-visible:border-primary"
          placeholder="Objetivos acordados por el equipo interdisciplinario…"
        />
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <label className="mb-2 block text-sm font-medium text-text-soft" htmlFor="plan_actual">
          Plan actual
        </label>
        <textarea
          id="plan_actual"
          rows={3}
          {...register('plan_actual')}
          className="w-full rounded-control border border-border bg-white p-3 text-sm text-text placeholder:text-text-muted focus-visible:border-primary"
          placeholder="Plan de intervención actual…"
        />
      </div>
    </div>
  )
}
