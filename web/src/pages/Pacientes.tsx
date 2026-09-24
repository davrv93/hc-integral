import { Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function Pacientes() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text">Pacientes</h1>
        <p className="text-sm text-text-muted">Gestión del padrón de pacientes.</p>
      </div>
      <div className="rounded-card border border-border bg-surface p-6">
        <EmptyState
          icon={Users}
          title="Próximamente"
          description="La gestión completa de pacientes (alta, búsqueda por DNI, edición) se implementará en una siguiente iteración. El backend ya expone GET/POST /api/v1/pacientes."
        />
      </div>
    </div>
  )
}
