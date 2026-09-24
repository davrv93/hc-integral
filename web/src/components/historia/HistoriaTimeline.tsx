import { Activity, FilePlus2 } from 'lucide-react'
import { DISCIPLINA_LABEL, formatDateTime } from '@/lib/labels'
import type { Historia } from '@/lib/types'

export function HistoriaTimeline({ historia }: { historia: Historia }) {
  const atenciones = (historia.atenciones ?? [])
    .slice()
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  const atencionesRecientes = atenciones.slice(-5)

  return (
    <>
      <div className="xl:hidden">
        <details className="rounded-card border border-border bg-surface p-4">
          <summary className="flex min-h-control cursor-pointer items-center justify-between gap-3 font-serif font-semibold text-text">
            Historial HC
            <span className="font-sans text-xs font-normal text-text-muted">{atenciones.length + 1} registros</span>
          </summary>
          <ol className="mt-4 flex flex-col gap-3">
            <li className="rounded-control bg-bg px-3 py-2">
              <p className="text-sm font-semibold text-text">Apertura · HC #{historia.correlativo}</p>
              <p className="text-xs text-text-muted">{formatDateTime(historia.created_at)}</p>
            </li>
            {atencionesRecientes.map((atencion, index) => (
              <li key={atencion.id} className="rounded-control border border-[#EEF2F1] bg-white px-3 py-2">
                <p className="text-sm font-semibold text-text">{DISCIPLINA_LABEL[atencion.disciplina]}</p>
                <p className="text-xs text-text-muted">{formatDateTime(atencion.fecha)}</p>
                <p className="mt-1 line-clamp-2 text-xs text-text-soft">{atencion.motivo}</p>
                {index === atencionesRecientes.length - 1 && atenciones.length > atencionesRecientes.length && (
                  <p className="mt-2 text-xs text-text-muted">
                    Mostrando 5 atenciones recientes. Consulta pestaña Atenciones para ver el historial completo.
                  </p>
                )}
              </li>
            ))}
          </ol>
        </details>
      </div>
      <aside className="hc-panel sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-card border border-border bg-surface/95 p-4 shadow-sm xl:block">
        <div className="mb-4">
          <h2 className="font-serif text-base font-semibold text-text">Historial HC</h2>
          <p className="text-xs text-text-muted">Registro clínico cronológico</p>
        </div>

        <ol className="relative flex flex-col gap-3 before:absolute before:left-[17px] before:top-7 before:h-[calc(100%-34px)] before:w-px before:bg-border">
          <li className="relative flex gap-3">
            <span className="z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
              <FilePlus2 size={16} />
            </span>
            <div className="min-w-0 rounded-control bg-bg px-3 py-2">
              <p className="text-sm font-semibold text-text">Apertura</p>
              <p className="text-xs text-text-muted">{formatDateTime(historia.created_at)}</p>
              <p className="mt-1 truncate text-xs text-text-soft">HC #{historia.correlativo}</p>
            </div>
          </li>

          {atenciones.map((atencion, index) => (
            <li key={atencion.id} className="relative flex gap-3">
              <span className="z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-text-soft">
                <Activity size={16} />
              </span>
              <div className="min-w-0 flex-1 rounded-control border border-[#EEF2F1] bg-white px-3 py-2 transition-colors duration-150 hover:border-primary/30 hover:bg-primary-soft/50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text">Atención {index + 1}</p>
                  <span className="rounded-pill bg-bg px-2 py-0.5 text-[11px] font-medium text-text-muted">
                    {DISCIPLINA_LABEL[atencion.disciplina]}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{formatDateTime(atencion.fecha)}</p>
                <p className="mt-1 line-clamp-2 text-xs text-text-soft">{atencion.motivo}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </>
  )
}
