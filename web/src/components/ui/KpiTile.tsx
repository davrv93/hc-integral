import type { LucideIcon } from 'lucide-react'

interface KpiTileProps {
  label: string
  value: string | number
  icon?: LucideIcon
  accent?: string
  hint?: string
}

export function KpiTile({ label, value, icon: Icon, accent = '#0E6E66', hint }: KpiTileProps) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-muted font-medium">{label}</span>
        {Icon && (
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: `${accent}1A`, color: accent }}
          >
            <Icon size={18} />
          </span>
        )}
      </div>
      <span className="font-serif text-3xl font-semibold text-text">{value}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  )
}
