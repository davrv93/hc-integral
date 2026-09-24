import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg text-center">
      <h1 className="font-serif text-3xl font-semibold text-text">404</h1>
      <p className="text-text-muted">La página que buscas no existe.</p>
      <Link to="/" className="text-primary hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
