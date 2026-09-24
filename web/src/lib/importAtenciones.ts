// Traduce filas de un CSV/Excel a filas de atencion listas para
// POST /api/v1/atenciones/import. Soporta dos formatos de encabezados
// (ya normalizados por parseCsv: minusculas, sin tildes, espacios -> "_"):
//
// Formato A (una fila = una atencion): dni, disciplina, motivo, detalle,
// plan_trabajo_estado?, objetivos_estado?, necesidades?,
// objetivos_propuestos?, plan_actual?, observaciones?
//
// Formato B (planilla original: una fila = un paciente, con una columna
// de texto por disciplina): dni, diagnostico?, plan_trabajo_estado (o
// plan_de_trabajo_actual)?, objetivos_estado (u objetivos_actuales)?,
// necesidades?, plan_actual?, observaciones?, y una o mas de
// medicina / psicologia / terapia_fisica (o t_fisica) / nutricion con el
// detalle de esa disciplina — se genera una atencion por cada columna de
// disciplina no vacia.
import type { ImportAtencionRow } from './endpoints'

const DISCIPLINA_COLUMNS: Record<string, string> = {
  medicina: 'medicina',
  psicologia: 'psicologia',
  terapia_fisica: 'terapia_fisica',
  t_fisica: 'terapia_fisica',
  'terapia_fisica_(t._fisica)': 'terapia_fisica',
  nutricion: 'nutricion',
}

const EVAL_ALIASES: Record<string, 'SI' | 'NO' | 'PARCIAL'> = {
  si: 'SI',
  sí: 'SI',
  s: 'SI',
  no: 'NO',
  n: 'NO',
  parcial: 'PARCIAL',
  p: 'PARCIAL',
}

function normalizeEval(v: string | undefined): string | undefined {
  if (!v) return undefined
  const key = v.trim().toLowerCase()
  return EVAL_ALIASES[key]
}

function pick(row: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (row[k]) return row[k]
  }
  return undefined
}

export interface ImportBuildResult {
  rows: ImportAtencionRow[]
  format: 'A' | 'B' | null
  skipped: { row: number; reason: string }[]
}

export function buildImportRows(parsed: Record<string, string>[]): ImportBuildResult {
  if (parsed.length === 0) return { rows: [], format: null, skipped: [] }

  const headers = Object.keys(parsed[0])
  const hasDisciplinaCol = headers.includes('disciplina')
  const disciplinaCols = headers.filter((h) => h in DISCIPLINA_COLUMNS)

  const skipped: ImportBuildResult['skipped'] = []
  const rows: ImportAtencionRow[] = []

  if (hasDisciplinaCol) {
    parsed.forEach((r, i) => {
      const dni = pick(r, 'dni')
      const disciplina = pick(r, 'disciplina')
      const motivo = pick(r, 'motivo')
      const detalle = pick(r, 'detalle')
      if (!dni || !disciplina || !motivo || !detalle) {
        skipped.push({ row: i + 2, reason: 'faltan dni, disciplina, motivo o detalle' })
        return
      }
      rows.push({
        dni,
        disciplina,
        motivo,
        detalle,
        plan_trabajo_estado: normalizeEval(pick(r, 'plan_trabajo_estado', 'plan_de_trabajo_actual', 'plan_de_trabajo')),
        objetivos_estado: normalizeEval(pick(r, 'objetivos_estado', 'objetivos_actuales', 'objetivos')),
        necesidades: pick(r, 'necesidades', 'necesidades_/_problemas_identificados', 'necesidades_problemas_identificados'),
        objetivos_propuestos: pick(r, 'objetivos_propuestos'),
        plan_actual: pick(r, 'plan_actual'),
        observaciones: pick(r, 'observaciones'),
      })
    })
    return { rows, format: 'A', skipped }
  }

  if (disciplinaCols.length > 0) {
    parsed.forEach((r, i) => {
      const dni = pick(r, 'dni')
      if (!dni) {
        skipped.push({ row: i + 2, reason: 'falta el DNI' })
        return
      }
      const diagnostico = pick(r, 'diagnostico')
      const shared = {
        plan_trabajo_estado: normalizeEval(pick(r, 'plan_trabajo_estado', 'plan_de_trabajo_actual', 'plan_de_trabajo')),
        objetivos_estado: normalizeEval(pick(r, 'objetivos_estado', 'objetivos_actuales', 'objetivos')),
        necesidades: pick(r, 'necesidades', 'necesidades_/_problemas_identificados', 'necesidades_problemas_identificados'),
        objetivos_propuestos: pick(r, 'objetivos_propuestos'),
        plan_actual: pick(r, 'plan_actual'),
        observaciones: pick(r, 'observaciones'),
      }
      let any = false
      for (const col of disciplinaCols) {
        const detalle = r[col]
        if (!detalle) continue
        any = true
        rows.push({
          dni,
          disciplina: DISCIPLINA_COLUMNS[col],
          motivo: diagnostico || 'Importado desde planilla',
          detalle,
          ...shared,
        })
      }
      if (!any) skipped.push({ row: i + 2, reason: 'sin datos en ninguna columna de disciplina' })
    })
    return { rows, format: 'B', skipped }
  }

  return { rows: [], format: null, skipped: [] }
}
