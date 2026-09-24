import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import type { Disciplina, Historia } from '@/lib/types'
import { DISCIPLINA_LABEL } from '@/lib/labels'
import { putIntervencion } from '@/lib/endpoints'
import { extractApiError } from '@/lib/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { Button } from '@/components/ui/Button'

const ACCENT: Record<Disciplina, string> = {
  medicina: '#0A8F80',
  psicologia: '#3E6FC2',
  terapia_fisica: '#C27A1A',
  nutricion: '#A04A9C',
}

export function IntervencionCard({ historiaId, disciplina }: { historiaId: string; disciplina: Disciplina }) {
  const queryClient = useQueryClient()

  const existing = queryClient.getQueryData<Historia>(['historia', historiaId])
  const inicial = existing?.intervenciones?.find((i) => i.disciplina === disciplina)?.detalle ?? ''

  const [detalle, setDetalle] = useState(inicial)
  const [dirty, setDirty] = useState(false)

  const mutation = useMutation({
    mutationFn: (value: string) => putIntervencion(historiaId, disciplina, value),
    onSuccess: () => {
      toastSuccess(`Intervención de ${DISCIPLINA_LABEL[disciplina]} guardada.`)
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['historia', historiaId] })
    },
    onError: (err) => {
      toastError(extractApiError(err).message || 'No se pudo guardar la intervención.')
    },
  })

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ACCENT[disciplina] }} />
        <h4 className="font-serif text-sm font-semibold text-text">{DISCIPLINA_LABEL[disciplina]}</h4>
      </div>
      <textarea
        rows={4}
        value={detalle}
        onChange={(e) => {
          setDetalle(e.target.value)
          setDirty(true)
        }}
        placeholder={`Intervención propuesta por ${DISCIPLINA_LABEL[disciplina]}…`}
        className="w-full rounded-control border border-border bg-white p-3 text-sm text-text placeholder:text-text-muted focus-visible:border-primary"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          loading={mutation.isPending}
          disabled={!dirty}
          onClick={() => mutation.mutate(detalle)}
        >
          <Save size={14} />
          Guardar
        </Button>
      </div>
    </div>
  )
}
