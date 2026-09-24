import { api } from './api'
import type {
  Auditoria,
  Atencion,
  Disciplina,
  EstadoRevision,
  EvalEstado,
  Historia,
  Medico,
  Paciente,
  Paginated,
  ReporteResumen,
} from './types'

export interface HistoriasQuery {
  q?: string
  medico_id?: string
  plan_trabajo_estado?: EvalEstado
  objetivos_estado?: EvalEstado
  estado_revision?: EstadoRevision
  page?: number
  page_size?: number
}

function cleanParams<T extends object>(params: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of Object.keys(params) as (keyof T)[]) {
    const value = params[key]
    if (value !== undefined && value !== null && value !== '') out[key] = value
  }
  return out
}

export async function fetchMedicos(): Promise<Medico[]> {
  const res = await api.get<Medico[] | { data: Medico[] }>('/api/v1/medicos')
  return Array.isArray(res.data) ? res.data : res.data.data
}

export async function fetchPacientes(q: string, page = 1, pageSize = 20): Promise<Paginated<Paciente>> {
  const res = await api.get<Paginated<Paciente>>('/api/v1/pacientes', {
    params: cleanParams({ q, page, page_size: pageSize }),
  })
  return res.data
}

export type CreatePacienteInput = Pick<Paciente, 'dni' | 'nombres' | 'apellidos'> &
  Partial<Pick<Paciente, 'fecha_nac' | 'sexo' | 'telefono'>>

export async function createPaciente(input: CreatePacienteInput): Promise<Paciente> {
  const res = await api.post<Paciente>('/api/v1/pacientes', input)
  return res.data
}

export async function fetchHistorias(query: HistoriasQuery): Promise<Paginated<Historia>> {
  const res = await api.get<Paginated<Historia>>('/api/v1/historias', {
    params: cleanParams({ page: 1, page_size: 20, ...query }),
  })
  return res.data
}

export type CreateHistoriaInput = Pick<Historia, 'paciente_id' | 'medico_id' | 'diagnostico'>

export async function createHistoria(input: CreateHistoriaInput): Promise<Historia> {
  const res = await api.post<Historia>('/api/v1/historias', input)
  return res.data
}

export async function fetchHistoria(id: string): Promise<Historia> {
  const res = await api.get<Historia>(`/api/v1/historias/${id}`)
  return res.data
}

export async function patchHistoria(id: string, patch: Partial<Historia>): Promise<Historia> {
  const res = await api.patch<Historia>(`/api/v1/historias/${id}`, patch)
  return res.data
}

export async function deleteHistoria(id: string): Promise<void> {
  await api.delete(`/api/v1/historias/${id}`)
}

export async function putIntervencion(
  historiaId: string,
  disciplina: Disciplina,
  detalle: string
): Promise<void> {
  await api.put(`/api/v1/historias/${historiaId}/intervenciones/${disciplina}`, { detalle })
}

export async function fetchAuditoria(historiaId: string): Promise<Auditoria[]> {
  const res = await api.get<Auditoria[] | { data: Auditoria[] }>(`/api/v1/historias/${historiaId}/auditoria`)
  return Array.isArray(res.data) ? res.data : res.data.data
}

export async function fetchAuditoriaReciente(limit = 12): Promise<Auditoria[]> {
  const res = await api.get<Auditoria[] | { data: Auditoria[] }>('/api/v1/auditoria/reciente', {
    params: { limit },
  })
  return Array.isArray(res.data) ? res.data : res.data.data
}

export type CreateAtencionInput = Pick<Atencion, 'disciplina' | 'motivo' | 'detalle'> &
  Partial<
    Pick<
      Atencion,
      | 'plan_trabajo_estado'
      | 'objetivos_estado'
      | 'necesidades'
      | 'objetivos_propuestos'
      | 'plan_actual'
      | 'observaciones'
    >
  >

export async function fetchAtenciones(historiaId: string): Promise<Atencion[]> {
  const res = await api.get<Atencion[] | { data: Atencion[] }>(`/api/v1/historias/${historiaId}/atenciones`)
  return Array.isArray(res.data) ? res.data : res.data.data
}

export async function createAtencion(historiaId: string, input: CreateAtencionInput): Promise<Atencion> {
  const res = await api.post<Atencion>(`/api/v1/historias/${historiaId}/atenciones`, input)
  return res.data
}

export async function deleteAtencion(historiaId: string, atencionId: string): Promise<void> {
  await api.delete(`/api/v1/historias/${historiaId}/atenciones/${atencionId}`)
}

export type ImportAtencionRow = { dni: string; disciplina: string; motivo: string; detalle: string } & Partial<
  Record<'plan_trabajo_estado' | 'objetivos_estado' | 'necesidades' | 'objetivos_propuestos' | 'plan_actual' | 'observaciones', string>
>

export interface ImportAtencionesResult {
  imported: number
  errors: { row: number; message: string }[]
}

export async function importAtenciones(rows: ImportAtencionRow[]): Promise<ImportAtencionesResult> {
  const res = await api.post<ImportAtencionesResult>('/api/v1/atenciones/import', { rows })
  return res.data
}

export interface ReportesQuery {
  desde?: string
  hasta?: string
  medico_id?: string
}

export async function fetchReporteResumen(query: ReportesQuery = {}): Promise<ReporteResumen> {
  const res = await api.get<ReporteResumen>('/api/v1/reportes/resumen', {
    params: cleanParams(query),
  })
  return res.data
}
