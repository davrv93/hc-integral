// Tipos que reflejan los esquemas JSON descritos en docs/CONTRACT.md

export type EvalEstado = 'SI' | 'NO' | 'PARCIAL'

export type EstadoRevision = 'en_revision' | 'requiere_propuesta' | 'completo'

export type Rol =
  | 'admin'
  | 'medico'
  | 'psicologia'
  | 'terapia_fisica'
  | 'nutricion'
  | 'revisor'

export type Disciplina = 'medicina' | 'psicologia' | 'terapia_fisica' | 'nutricion'

export interface Paginated<T> {
  data: T[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

export interface Paciente {
  id: string
  dni: string
  nombres: string
  apellidos: string
  fecha_nac?: string | null
  sexo?: string | null
  telefono?: string | null
  created_at: string
  updated_at: string
}

export interface Medico {
  id: string
  nombre: string
  titulo: string
  especialidad?: string | null
  activo: boolean
  usuario_id?: string | null
  created_at: string
}

export interface Intervencion {
  id: string
  historia_id: string
  disciplina: Disciplina
  detalle: string
  responsable_id?: string | null
  updated_at: string
}

export interface Historia {
  id: string
  correlativo: number
  paciente_id: string
  medico_id: string
  diagnostico: string
  plan_trabajo_estado?: EvalEstado | null
  objetivos_estado?: EvalEstado | null
  necesidades?: string | null
  objetivos_propuestos?: string | null
  plan_actual?: string | null
  plazo?: string | null
  observaciones?: string | null
  estado_revision: EstadoRevision
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  // Presentes solo en GET /historias/:id
  paciente?: Paciente
  medico?: Medico
  intervenciones?: Intervencion[]
}

export interface Auditoria {
  id: number
  usuario_id?: string | null
  accion: string
  entidad: string
  entidad_id: string
  antes?: unknown
  despues?: unknown
  ip?: string | null
  ts: string
}

export interface ReportePorMedico {
  medico_id: string
  nombre: string
  total: number
  en_revision: number
  requiere_propuesta: number
  completo: number
}

export interface ReporteSerieMensual {
  mes: string
  creadas: number
  completadas: number
}

export interface ReporteResumen {
  por_estado: {
    en_revision: number
    requiere_propuesta: number
    completo: number
  }
  plan_trabajo: Record<EvalEstado, number>
  objetivos: Record<EvalEstado, number>
  por_medico: ReportePorMedico[]
  intervenciones_por_disciplina: Record<Disciplina, number>
  serie_mensual: ReporteSerieMensual[]
}
