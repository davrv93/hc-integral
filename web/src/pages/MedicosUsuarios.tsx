import { useQuery } from '@tanstack/react-query'
import { Stethoscope } from 'lucide-react'
import { fetchMedicos } from '@/lib/endpoints'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export function MedicosUsuarios() {
  const medicosQuery = useQuery({ queryKey: ['medicos'], queryFn: fetchMedicos })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text">Médicos y usuarios</h1>
        <p className="text-sm text-text-muted">Directorio de médicos registrados en el sistema.</p>
      </div>

      <div className="rounded-card border border-border bg-surface">
        {medicosQuery.isLoading ? (
          <div className="p-6">
            <Skeleton className="h-40" />
          </div>
        ) : !medicosQuery.data || medicosQuery.data.length === 0 ? (
          <EmptyState icon={Stethoscope} title="Sin médicos registrados" />
        ) : (
          <>
            <div className="divide-y divide-[#EEF2F1] xl:hidden">
              {medicosQuery.data.map((m) => (
                <article key={m.id} className="p-4">
                  <h2 className="font-medium text-text">{m.titulo} {m.nombre}</h2>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-text-muted">Especialidad</dt>
                      <dd className="mt-1 text-text-soft">{m.especialidad ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">Estado</dt>
                      <dd className="mt-1 text-text-soft">{m.activo ? 'Activo' : 'Inactivo'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7FAF9] text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Especialidad</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {medicosQuery.data.map((m) => (
                    <tr key={m.id} style={{ height: 56 }} className="border-b border-[#EEF2F1] last:border-0">
                      <td className="px-4 py-2 font-medium text-text">
                        {m.titulo} {m.nombre}
                      </td>
                      <td className="px-4 py-2 text-text-soft">{m.especialidad ?? '—'}</td>
                      <td className="px-4 py-2 text-text-soft">{m.activo ? 'Activo' : 'Inactivo'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <EmptyState
          icon={Stethoscope}
          title="Gestión de usuarios: próximamente"
          description="La administración de cuentas y roles (crear/editar usuarios) se implementará en una siguiente iteración."
        />
      </div>
    </div>
  )
}
