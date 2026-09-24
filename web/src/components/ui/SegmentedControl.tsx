interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-control border border-border bg-white p-1" role="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`min-h-[36px] rounded-[8px] px-4 text-sm font-medium transition-colors duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed ${
              active ? 'bg-primary text-white' : 'text-text-soft hover:bg-bg'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
