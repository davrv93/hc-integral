import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { exchangeCodeForToken } from '@/lib/auth'

export function Callback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const code = params.get('code')
    const state = params.get('state')
    const oauthError = params.get('error')

    if (oauthError) {
      setError(`El proveedor de autenticación rechazó la solicitud: ${oauthError}`)
      return
    }
    if (!code || !state) {
      setError('Faltan parámetros de autenticación (code/state) en la URL de retorno.')
      return
    }

    exchangeCodeForToken(code, state)
      .then(() => navigate('/', { replace: true }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión.'
        setError(message)
      })
  }, [params, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      {error ? (
        <>
          <p className="max-w-sm text-danger-soft-fg">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="inline-flex min-h-control items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            Volver a intentar
          </button>
        </>
      ) : (
        <>
          <Loader2 className="animate-spin text-primary" size={28} />
          <p className="text-text-muted">Completando inicio de sesión…</p>
        </>
      )}
    </div>
  )
}
