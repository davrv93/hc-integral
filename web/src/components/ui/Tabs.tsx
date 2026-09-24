interface TabDef {
  value: string
  label: string
}

interface TabsProps {
  tabs: TabDef[]
  value: string
  onChange: (value: string) => void
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-1 [scrollbar-width:thin]">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`relative min-h-control shrink-0 whitespace-nowrap px-3 text-sm font-medium transition-colors duration-150 ease-out ${
              active ? 'text-primary' : 'text-text-muted hover:text-text-soft'
            }`}
          >
            {tab.label}
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}
