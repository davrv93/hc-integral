interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: Option<T>[]
  value: T | null | undefined
  onChange: (value: T) => void
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <div aria-label={label} className="grid w-full grid-cols-3 rounded-control border border-border bg-white p-1 sm:inline-flex sm:w-auto sm:grid-cols-none" role="radiogroup">
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
            className={`min-h-control w-full min-w-0 rounded-[8px] px-1 text-xs font-medium leading-tight transition-colors duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto sm:px-4 sm:text-sm ${
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
