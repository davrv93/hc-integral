import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Brain, HeartPulse, Salad, ShieldCheck } from 'lucide-react'
import { AUTH_URL, prepareAuthorizeRequest, type AuthorizeRequest } from '@/lib/auth'

const DISCIPLINES = [
  { label: 'Medicina', icon: HeartPulse },
  { label: 'Psicología', icon: Brain },
  { label: 'Terapia física', icon: Activity },
  { label: 'Nutrición', icon: Salad },
] as const

export function Login() {
  const [authReq, setAuthReq] = useState<AuthorizeRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // PKCE (verifier/challenge/state) se genera una vez al montar la página,
  // no al enviar el formulario: el submit es un POST de navegador real
  // hacia el auth-service (sin fetch/XHR), para que el flujo funcione
  // igual con o sin JavaScript de por medio.
  useEffect(() => {
    prepareAuthorizeRequest().then(setAuthReq)
  }, [])

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-white/15 font-serif text-lg font-semibold">
            HC
          </span>
          <span className="font-serif text-xl font-semibold">HC Integral</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative flex flex-col gap-6"
        >
          <h1 className="max-w-md font-serif text-3xl font-medium leading-tight">
            Historias clínicas interdisciplinarias, en un solo lugar.
          </h1>
          <p className="max-w-sm text-white/80">
            Coordina evaluación, propuesta y seguimiento entre todas las disciplinas del equipo de
            atención.
          </p>
          <div className="flex flex-wrap gap-3">
            {DISCIPLINES.map((d) => (
              <span
                key={d.label}
                className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-sm"
              >
                <d.icon size={16} />
                {d.label}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="relative flex items-center gap-2 text-sm text-white/70">
          <ShieldCheck size={16} />
          Autenticación segura vía OAuth2 + PKCE
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-sm rounded-card border border-border bg-surface p-8 shadow-float"
        >
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-control bg-primary text-white font-serif font-semibold">
              HC
            </span>
            <span className="font-serif text-lg font-semibold text-text">HC Integral</span>
          </div>

          <h2 className="font-serif text-2xl font-semibold text-text">Bienvenido de nuevo</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Ingresa con tu usuario y contraseña para continuar.
          </p>

          <form
            method="POST"
            action={`${AUTH_URL}/oauth/authorize`}
            onSubmit={() => setSubmitting(true)}
            className="mt-8 flex flex-col gap-1"
          >
            {authReq && (
              <>
                <input type="hidden" name="client_id" value={authReq.client_id} />
                <input type="hidden" name="redirect_uri" value={authReq.redirect_uri} />
                <input type="hidden" name="code_challenge" value={authReq.code_challenge} />
                <input
                  type="hidden"
                  name="code_challenge_method"
                  value={authReq.code_challenge_method}
                />
                <input type="hidden" name="state" value={authReq.state} />
              </>
            )}

            <label htmlFor="email" className="mb-1.5 text-sm font-semibold text-text">
              Usuario
            </label>
            <input
              id="email"
              name="email"
              type="text"
              required
              autoFocus
              autoComplete="username"
              placeholder="usuario o correo"
              className="mb-4 min-h-control rounded-control border border-border bg-white px-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />

            <label htmlFor="password" className="mb-1.5 text-sm font-semibold text-text">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="mb-6 min-h-control rounded-control border border-border bg-white px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />

            <button
              type="submit"
              disabled={!authReq || submitting}
              className="inline-flex min-h-control items-center justify-center rounded-control bg-primary px-4 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-primary-hover disabled:opacity-60"
            >
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-6 flex items-center gap-1.5 text-center text-xs text-text-muted">
            <ShieldCheck size={14} className="shrink-0" />
            Autenticación OAuth2 + PKCE, sin compartir tu contraseña con la app.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
