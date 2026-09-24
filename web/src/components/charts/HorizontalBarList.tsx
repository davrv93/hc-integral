interface Item {
  label: string
  value: number
  color: string
}

export function HorizontalBarList({ items }: { items: Item[] }) {
  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-sm text-text-soft">{item.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-pill bg-border/40">
            <div
              className="h-full rounded-pill transition-all duration-200 ease-out"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium text-text">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
