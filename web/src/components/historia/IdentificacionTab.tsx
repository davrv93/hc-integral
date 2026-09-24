import type { Historia } from '@/lib/types'
import { formatDate } from '@/lib/labels'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-text">{value || '—'}</p>
    </div>
  )
}

export function IdentificacionTab({ historia }: { historia: Historia }) {
  const paciente = historia.paciente
  const medico = historia.medico

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 font-serif text-base font-semibold text-text">Paciente</h3>
        <div className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-3">
          <Field label="Nombres" value={paciente ? `${paciente.nombres} ${paciente.apellidos}` : ''} />
          <Field label="DNI" value={paciente?.dni ?? ''} />
          <Field label="Fecha de nacimiento" value={paciente?.fecha_nac ? formatDate(paciente.fecha_nac) : ''} />
          <Field label="Sexo" value={paciente?.sexo ?? ''} />
          <Field label="Teléfono" value={paciente?.telefono ?? ''} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-serif text-base font-semibold text-text">Médico tratante</h3>
        <div className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-3">
          <Field label="Nombre" value={medico ? `${medico.titulo} ${medico.nombre}` : ''} />
          <Field label="Especialidad" value={medico?.especialidad ?? ''} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-serif text-base font-semibold text-text">Diagnóstico</h3>
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="text-sm text-text">{historia.diagnostico}</p>
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-serif text-base font-semibold text-text">Datos de la historia</h3>
        <div className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-5 sm:grid-cols-3">
          <Field label="Correlativo" value={`#${historia.correlativo}`} />
          <Field label="Creada" value={formatDate(historia.created_at)} />
          <Field label="Última actualización" value={formatDate(historia.updated_at)} />
        </div>
      </section>
    </div>
  )
}
