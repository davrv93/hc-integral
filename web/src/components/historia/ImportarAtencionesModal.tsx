import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, Upload, X } from 'lucide-react'
import { importAtenciones } from '@/lib/endpoints'
import { parseCsv, downloadCsv } from '@/lib/csv'
import { buildImportRows, type ImportBuildResult } from '@/lib/importAtenciones'
import { toastError, toastSuccess } from '@/lib/alerts'
import { extractApiError } from '@/lib/api'
import { Button } from '@/components/ui/Button'

const PLANTILLA_HEADERS = [
  'dni',
  'diagnostico',
  'plan_trabajo_estado',
  'objetivos_estado',
  'necesidades',
  'plan_actual',
  'observaciones',
  'medicina',
  'psicologia',
  'terapia_fisica',
  'nutricion',
]

export function ImportarAtencionesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [built, setBuilt] = useState<ImportBuildResult | null>(null)
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null)

  const importMutation = useMutation({
    mutationFn: () => importAtenciones(built!.rows),
    onSuccess: async (res) => {
      setResult(res)
      if (res.imported > 0) {
        toastSuccess(`${res.imported} atención${res.imported === 1 ? '' : 'es'} importada${res.imported === 1 ? '' : 's'}.`)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['historias'] }),
          queryClient.invalidateQueries({ queryKey: ['reportes'] }),
        ])
      }
    },
    onError: (err) => toastError(extractApiError(err).message || 'No se pudo importar el archivo.'),
  })

  function handleFile(file: File) {
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseCsv(text)
      const res = buildImportRows(parsed)
      setBuilt(res)
      if (res.format === null) {
        toastError('No se reconocen las columnas del archivo. Descarga la plantilla para ver el formato esperado.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleDescargarPlantilla() {
    downloadCsv('plantilla-atenciones.csv', [
      PLANTILLA_HEADERS,
      [
        '48054725',
        'Hipertensión arterial',
        'PARCIAL',
        'SI',
        'Presión no controlada',
        'Control quincenal',
        'Revisar en junta',
        'Ajustar antihipertensivo',
        '',
        '',
        'Dieta DASH, sodio < 2 g/día',
      ],
    ])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="import-atenciones-title" className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-t-card border border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl sm:max-h-[calc(100vh-3rem)] sm:rounded-card sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id="import-atenciones-title" className="font-serif text-xl font-semibold text-text">Importar atenciones</h2>
            <p className="text-sm text-text-muted">Sube un CSV (exportado de Excel) para registrar atenciones en lote.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-bg hover:text-text"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-control flex-1 items-center justify-center gap-2 rounded-control border-2 border-dashed border-border bg-bg px-4 text-sm font-medium text-text-soft transition-colors hover:border-primary hover:text-primary"
            >
              <Upload size={16} />
              {fileName || 'Seleccionar archivo CSV'}
            </button>
            <button
              type="button"
              onClick={handleDescargarPlantilla}
              className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-control border border-border bg-white px-3 text-sm font-medium text-text-soft transition-colors hover:bg-bg sm:w-auto"
            >
              <FileUp size={16} />
              Plantilla
            </button>
          </div>

          <p className="text-xs text-text-muted">
            Columnas esperadas: <code className="rounded bg-bg px-1 py-0.5">dni</code>, y el detalle de cada disciplina en
            columnas <code className="rounded bg-bg px-1 py-0.5">medicina</code>,{' '}
            <code className="rounded bg-bg px-1 py-0.5">psicologia</code>,{' '}
            <code className="rounded bg-bg px-1 py-0.5">terapia_fisica</code>,{' '}
            <code className="rounded bg-bg px-1 py-0.5">nutricion</code> (deja vacía la que no aplique). Opcionales:{' '}
            <code className="rounded bg-bg px-1 py-0.5">diagnostico</code>,{' '}
            <code className="rounded bg-bg px-1 py-0.5">plan_trabajo_estado</code> /{' '}
            <code className="rounded bg-bg px-1 py-0.5">objetivos_estado</code> (SI/NO/PARCIAL),{' '}
            <code className="rounded bg-bg px-1 py-0.5">necesidades</code>,{' '}
            <code className="rounded bg-bg px-1 py-0.5">plan_actual</code>,{' '}
            <code className="rounded bg-bg px-1 py-0.5">observaciones</code>. Cada paciente debe existir y tener una historia
            clínica activa.
          </p>

          {built && built.format && (
            <div className="rounded-control border border-border bg-bg p-3 text-sm">
              <p className="font-medium text-text">
                {built.rows.length} atención{built.rows.length === 1 ? '' : 'es'} lista
                {built.rows.length === 1 ? '' : 's'} para importar
                {built.skipped.length > 0 && `, ${built.skipped.length} fila${built.skipped.length === 1 ? '' : 's'} omitida${built.skipped.length === 1 ? '' : 's'}`}
                .
              </p>
              {built.skipped.length > 0 && (
                <ul className="mt-2 max-h-24 overflow-y-auto text-xs text-text-muted">
                  {built.skipped.map((s, i) => (
                    <li key={i}>Fila {s.row}: {s.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && (
            <div
              className={`rounded-control border p-3 text-sm ${
                result.errors.length > 0 ? 'border-[#F0D3CC] bg-danger-soft-bg' : 'border-[#CFE3DF] bg-[#E3F1E6]'
              }`}
            >
              <p className="font-medium text-text">
                {result.imported} importada{result.imported === 1 ? '' : 's'} · {result.errors.length} con error
                {result.errors.length === 1 ? '' : 'es'}
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-danger-soft-fg">
                  {result.errors.map((e, i) => (
                    <li key={i}>Fila {e.row}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-control w-full items-center justify-center rounded-control border border-border bg-white px-4 text-sm font-medium text-text-soft transition-colors hover:bg-bg sm:w-auto"
          >
            Cerrar
          </button>
          <Button
            type="button"
            onClick={() => importMutation.mutate()}
            loading={importMutation.isPending}
            disabled={!built || built.rows.length === 0}
            className="w-full sm:w-auto"
          >
            <Upload size={16} />
            Importar {built && built.rows.length > 0 ? `(${built.rows.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
