import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  total?: number
}

export function Pagination({ page, totalPages, onPageChange, total }: PaginationProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs text-text-muted">
        {total !== undefined ? `${total} en total · ` : ''}Página {page} de {totalPages}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border bg-white text-text-soft transition-colors duration-150 hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Página anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border bg-white text-text-soft transition-colors duration-150 hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Página siguiente"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
