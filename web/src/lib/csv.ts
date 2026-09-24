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
