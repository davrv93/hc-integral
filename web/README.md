# HC Integral — Web

Frontend de HC Integral: React 18 + TypeScript + Vite + Tailwind CSS. Consume
`auth-service` (OAuth2 + PKCE) y `api-service` (REST) según `docs/CONTRACT.md`,
y sigue la paleta/tipografía de `docs/design-system.md`.

## Requisitos

- Node.js 18+ (probado con Node 24)
- `auth-service` corriendo en `VITE_AUTH_URL` (default `http://localhost:8080`)
- `api-service` corriendo en `VITE_API_URL` (default `http://localhost:8081`)

## Instalación y ejecución

```bash
cd web
cp .env.example .env   # ajustar si auth/api corren en otros puertos
npm install
npm run dev             # http://localhost:5173
```

Build de producción:

```bash
npm run build            # tsc -b && vite build -> dist/
npm run preview          # sirve dist/ localmente
```

## Variables de entorno

| Variable         | Default                  | Descripción                        |
|------------------|---------------------------|-------------------------------------|
| `VITE_AUTH_URL`  | `http://localhost:8080`   | Base URL del auth-service (OAuth2). |
| `VITE_API_URL`   | `http://localhost:8081`   | Base URL del api-service (REST).    |

Ver `.env.example`.

## Flujo de autenticación (OAuth2 Authorization Code + PKCE)

Al pulsar "Ingresar" o "Continuar con cuenta institucional" en `/login`, el
cliente genera un `code_verifier` aleatorio (43-128 caracteres base64url) y
deriva el `code_challenge` correspondiente con SHA-256 (`SubtleCrypto`,
método `S256`). El `code_verifier` se guarda en `sessionStorage` bajo una
clave indexada por `state` (también generado aleatoriamente), y el navegador
es redirigido a `${VITE_AUTH_URL}/oauth/authorize?...` con
`response_type=code`, `client_id=hc-web`, `redirect_uri=<origin>/callback`,
`code_challenge`, `code_challenge_method=S256` y `state`. El propio
auth-service renderiza el formulario de login (email + password) — el
frontend no implementa un formulario de credenciales propio. Tras
autenticar, el auth-service redirige a `/callback?code=...&state=...`; esa
ruta recupera el `code_verifier` guardado (usando `state` para emparejar) y
hace `POST ${VITE_AUTH_URL}/oauth/token` con
`grant_type=authorization_code` para intercambiar el código por
`access_token`/`refresh_token`, que se guardan en un store de módulo en
memoria y se persisten en `localStorage` (ver nota de seguridad abajo).
Todas las peticiones a `VITE_API_URL` pasan por un cliente Axios que adjunta
`Authorization: Bearer <access_token>`; si una respuesta llega con 401, el
interceptor intenta una única vez un refresh silencioso
(`grant_type=refresh_token`) y reintenta la petición original — si el
refresh también falla, limpia el estado local y redirige a `/login`. El
logout hace `POST /oauth/logout` con el `refresh_token` (revoca la familia
en el servidor) y limpia el estado local.

**Nota de seguridad (MVP):** los tokens se guardan en `localStorage`, lo cual
es vulnerable a robo vía XSS. Para producción se recomienda migrar a un
patrón BFF (Backend For Frontend) con cookies `httpOnly` + `SameSite=Strict`
y CSRF token, de modo que el JavaScript del cliente nunca tenga acceso
directo a los tokens.

## Estructura

```
src/
  lib/          # api client (axios + interceptores), auth/PKCE, endpoints, types, labels, schemas (zod), alerts (SweetAlert2)
  hooks/        # useAuth (useSyncExternalStore sobre el auth store), useDebounce
  components/
    layout/     # Sidebar, AppShell
    ui/         # Badge, Button, SegmentedControl, KpiTile, Pagination, Tabs, Skeleton, EmptyState
    charts/     # EstadoDonutChart, StackedBarRow, SerieMensualChart, HorizontalBarList (Recharts)
    historia/   # Tabs de detalle de historia clínica (Identificación, Evaluación, Propuesta, Seguimiento, Historial)
  pages/        # Login, Callback, Dashboard, Historias, HistoriaDetalle, Reportes, Pacientes, MedicosUsuarios, NotFound
```

## Páginas y estado de implementación

Ver el reporte de la tarea para el detalle completo; en resumen:

- **Login / Callback**: funcional (PKCE completo).
- **Dashboard**: funcional; el panel "Actividad reciente" queda como
  placeholder ("Próximamente") porque el contrato no define un endpoint
  agregado de auditoría global.
- **Historias** (lista): funcional — búsqueda debounced, tabs por estado con
  conteos, filtro por médico, paginación server-driven, archivar con
  confirmación SweetAlert2.
- **Historia detalle**: funcional — tabs completos, formulario con
  react-hook-form + zod, guardado parcial (`PATCH`) de campos modificados,
  guardado independiente por disciplina (`PUT .../intervenciones/:disciplina`).
- **Reportes**: funcional — gráficos Recharts (línea, barras horizontales,
  barras apiladas) y tabla por médico. Los botones de exportar Excel/PDF son
  stubs que muestran un toast "próximamente".
- **Pacientes** y **Médicos y usuarios**: la lista de médicos es real; el
  resto queda como placeholder ("Próximamente"), tal como se especificó en
  el alcance mínimo de esta iteración.
