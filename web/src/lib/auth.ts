// Flujo OAuth2 Authorization Code + PKCE (S256) contra el auth-service.
// Ver docs/CONTRACT.md seccion 1 y 4.
import axios from 'axios'
import type { Rol } from './types'

export const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:8080'
const CLIENT_ID = 'hc-web'
const TOKENS_STORAGE_KEY = 'hc_auth_tokens'
const PKCE_STORAGE_PREFIX = 'hc_pkce_'

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  obtained_at: number
}

export interface JwtUser {
  sub: string
  email: string
  nombre: string
  rol: Rol
  iat: number
  exp: number
}

// ---------- PKCE helpers ----------

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBase64Url(byteLength: number): string {
  const arr = new Uint8Array(byteLength)
  crypto.getRandomValues(arr)
  return base64UrlEncode(arr.buffer)
}

/** Genera un code_verifier valido (43-128 caracteres base64url). */
export function generateCodeVerifier(): string {
  return randomBase64Url(64) // ~86 caracteres
}

export function generateState(): string {
  return randomBase64Url(24)
}

/** SHA-256 del verifier, codificado base64url, via SubtleCrypto. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

function decodeJwtPayload(token: string): JwtUser | null {
  try {
    const [, payload] = token.split('.')
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json) as JwtUser
  } catch {
    return null
  }
}

// ---------- Auth store (modulo + localStorage) ----------

type Listener = () => void

function loadTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthTokens) : null
  } catch {
    return null
  }
}

let tokens: AuthTokens | null = loadTokens()
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

export const authStore = {
  getTokens(): AuthTokens | null {
    return tokens
  },
  setTokens(next: AuthTokens | null) {
    tokens = next
    try {
      if (next) localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(TOKENS_STORAGE_KEY)
    } catch {
      // localStorage no disponible (modo privado, etc): seguimos en memoria
    }
    notify()
  },
  getAccessToken(): string | null {
    return tokens?.access_token ?? null
  },
  isAuthenticated(): boolean {
    return !!tokens?.access_token
  },
  getUser(): JwtUser | null {
    return tokens ? decodeJwtPayload(tokens.access_token) : null
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// ---------- Flujo de login ----------

/** Inicia el flujo PKCE: genera verifier/challenge/state y redirige al auth-service. */
export async function startLogin(): Promise<void> {
  const verifier = generateCodeVerifier()
  const state = generateState()
  const challenge = await generateCodeChallenge(verifier)
  sessionStorage.setItem(PKCE_STORAGE_PREFIX + state, verifier)

  const redirectUri = `${window.location.origin}/callback`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })
  window.location.href = `${AUTH_URL}/oauth/authorize?${params.toString()}`
}

export function consumeVerifier(state: string): string | null {
  const key = PKCE_STORAGE_PREFIX + state
  const verifier = sessionStorage.getItem(key)
  sessionStorage.removeItem(key)
  return verifier
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

/** Intercambia el codigo de autorizacion por tokens (POST /oauth/token). */
export async function exchangeCodeForToken(code: string, state: string): Promise<void> {
  const verifier = consumeVerifier(state)
  if (!verifier) {
    throw new Error('No se encontro code_verifier para este intento de login (state desconocido).')
  }
  const redirectUri = `${window.location.origin}/callback`
  const res = await axios.post<TokenResponse>(`${AUTH_URL}/oauth/token`, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  })
  authStore.setTokens({ ...res.data, obtained_at: Date.now() })
}

/** Intenta un refresh silencioso usando el refresh_token guardado. */
export async function refreshTokens(): Promise<boolean> {
  const current = authStore.getTokens()
  if (!current?.refresh_token) return false
  try {
    const res = await axios.post<TokenResponse>(`${AUTH_URL}/oauth/token`, {
      grant_type: 'refresh_token',
      refresh_token: current.refresh_token,
      client_id: CLIENT_ID,
    })
    authStore.setTokens({ ...res.data, obtained_at: Date.now() })
    return true
  } catch {
    authStore.setTokens(null)
    return false
  }
}

export async function logout(): Promise<void> {
  const current = authStore.getTokens()
  try {
    if (current?.refresh_token) {
      await axios.post(`${AUTH_URL}/oauth/logout`, { refresh_token: current.refresh_token })
    }
  } catch {
    // Si el logout remoto falla igual limpiamos el estado local
  } finally {
    authStore.setTokens(null)
  }
}
