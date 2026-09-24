// Exportacion CSV compartida (Reportes, Historias): CSV se abre nativamente
// en Excel, sin depender de una libreria de generacion de .xlsx.
export function csvCell(value: string | number): string {
  const raw = String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

export function downloadTextFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  downloadTextFile(filename, 'text/csv;charset=utf-8', '﻿' + content)
}

// Parser CSV minimo (coma o punto y coma como separador, comillas dobles
// para escapar): sirve para importaciones donde el usuario sube un CSV
// exportado de Excel. Devuelve filas como objetos { encabezado: valor },
// con los encabezados normalizados (minusculas, sin tildes, espacios->'_').
function normalizeHeader(h: string): string {
  return h
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ','
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader)
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim()
    })
    return row
  })
}
