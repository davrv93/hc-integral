# Contrato entre servicios — HC Integral

Documento fuente de verdad para `auth/`, `api/`, `worker/`, `web/`. Cualquier
cambio aquí debe reflejarse en los cuatro. Esquema DB: `migrations/0001_init.sql`.

## Puertos (desarrollo)

| Servicio | Puerto | Base URL |
|---|---|---|
| auth  | 8080 | http://localhost:8080 |
| api   | 8081 | http://localhost:8081 |
| web   | 5173 | http://localhost:5173 |
| postgres | 5432 | — |

## 1. auth-service (Go) — OAuth2 Authorization Code + PKCE

Cliente único de desarrollo: `client_id=hc-web`, `redirect_uri=http://localhost:5173/callback`, público (sin client_secret), `code_challenge_method=S256` obligatorio.

### Endpoints

- `GET /oauth/authorize?response_type=code&client_id=hc-web&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...`
  Si no hay sesión, sirve un formulario HTML de login (email + password) en el propio auth-service (server-rendered, sin dependencias de frontend). Al autenticar, genera `code` (opaco, 10 min TTL), redirige a `redirect_uri?code=...&state=...`.
  Login fallido 5 veces → `locked_until = now()+15min` en `usuarios`, respuesta 429 con mensaje.
- `POST /oauth/token`
  - `grant_type=authorization_code`: body `{code, redirect_uri, client_id, code_verifier}` → `{access_token, refresh_token, token_type:"Bearer", expires_in}`.
  - `grant_type=refresh_token`: body `{refresh_token, client_id}` → nuevo par (rotación: el refresh usado se marca `revoked`; reutilizar un token revocado revoca toda la `family_id`).
- `GET /.well-known/jwks.json` → JWK set (RS256, clave generada al arrancar si no existe `auth/keys/private.pem`, persistida en disco).
- `POST /oauth/logout` — body `{refresh_token}`, revoca la familia.
- `GET /healthz`

### JWT access token (RS256, TTL 15 min)

Claims:
```json
{
  "iss": "hc-auth",
  "sub": "<usuario.id uuid>",
  "email": "...",
  "nombre": "...",
  "rol": "admin|medico|psicologia|terapia_fisica|nutricion|revisor",
  "iat": 0,
  "exp": 0
}
```
`kid` en el header debe coincidir con una clave del JWKS.

### Seguridad

- Passwords: argon2id (`golang.org/x/crypto/argon2`), parámetros: time=1, memory=64MB, threads=4, salt 16 bytes random, formato almacenado `argon2id$v=19$m=65536,t=1,p=4$<salt_b64>$<hash_b64>`.
- Semilla de desarrollo (`auth/cmd/seed`): crea usuarios de ejemplo:
  - `dra.avilez@hc.local` / `Clave123!` — rol `admin`
  - `dr.abril@hc.local` / `Clave123!` — rol `medico`
  y sus filas correspondientes en `medicos` (DRA. AVILEZ, DR. ABRIL).

## 2. api-service (Go) — REST, valida JWT del auth-service

Middleware: lee `Authorization: Bearer <jwt>`, valida firma contra JWKS (cachea, refresca cada 10 min o en `kid` desconocido), rechaza expirado/inválido con 401. Inyecta `usuario_id`, `rol` en el contexto de la request. Todo endpoint bajo `/api/v1` requiere auth salvo `/api/v1/health`.

### Formato común

- Paginación: query `page` (1-based, default 1), `page_size` (default 20, max 100). Respuesta de listas:
  ```json
  {"data": [...], "page": 1, "page_size": 20, "total": 128, "total_pages": 7}
  ```
- Error: `{"error": {"code": "not_found", "message": "..."}}` con status HTTP correspondiente (400/401/403/404/409/422/500).
- Fechas: ISO 8601 (`2026-10-02`), timestamps con `Z`.
- RBAC de escritura sobre `historias`: cualquier rol autenticado puede leer; `PATCH` del bloque de una disciplina requiere `rol` = esa disciplina o `admin`/`medico`; cambiar `estado_revision` requiere `rol` en (`admin`,`revisor`,`medico`). El api-service aplica la regla pero no bloquea al MVP más allá de registrar auditoría — ver TODO.md fase RBAC fino.

### Endpoints

```
GET    /api/v1/health
GET    /api/v1/medicos
GET    /api/v1/pacientes?q=&page=&page_size=
POST   /api/v1/pacientes                        {dni, nombres, apellidos, fecha_nac?, sexo?, telefono?}
GET    /api/v1/pacientes/:id
GET    /api/v1/pacientes/by-dni/:dni

GET    /api/v1/historias?q=&medico_id=&plan_trabajo_estado=&objetivos_estado=&estado_revision=&page=&page_size=
POST   /api/v1/historias                        {paciente_id, medico_id, diagnostico}
GET    /api/v1/historias/:id                    -> incluye {..., paciente:{...}, medico:{...}, intervenciones:[...]}
PATCH  /api/v1/historias/:id                    campos parciales de la tabla historias
DELETE /api/v1/historias/:id                    soft delete (set deleted_at), registra auditoria "delete"

PUT    /api/v1/historias/:id/intervenciones/:disciplina   {detalle}   disciplina en (medicina|psicologia|terapia_fisica|nutricion)

GET    /api/v1/historias/:id/auditoria

GET    /api/v1/reportes/resumen?desde=&hasta=&medico_id=
  -> {
       "por_estado": {"en_revision": 34, "requiere_propuesta": 21, "completo": 73},
       "plan_trabajo": {"SI": 58, "NO": 28, "PARCIAL": 42},
       "objetivos": {"SI": 49, "NO": 32, "PARCIAL": 47},
       "por_medico": [{"medico_id":"...","nombre":"DR. ABRIL","total":60,"en_revision":18,"requiere_propuesta":12,"completo":30}],
       "intervenciones_por_disciplina": {"medicina": 118, "psicologia": 76, "terapia_fisica": 64, "nutricion": 81},
       "serie_mensual": [{"mes":"2026-04","creadas":14,"completadas":8}, ...]
     }
```

`GET /api/v1/historias/:id` y el `PATCH` disparan los triggers de `outbox` automáticamente (a nivel de fila en Postgres) — el api-service no debe escribir en `outbox` directamente.

`estado_revision` en JSON usa snake_case (`en_revision`, `requiere_propuesta`, `completo`); el frontend traduce a las etiquetas mostradas en las maquetas (En revisión / Requiere propuesta / Completo).

## 3. worker (Go) — espejo SQLite

Poll cada 3 s (configurable `POLL_INTERVAL_MS`) sobre `outbox WHERE procesado=false ORDER BY id`, aplica cada operación a `./data/mirror.sqlite` (mismo esquema simplificado: `pacientes`, `medicos`, `historias`, `intervenciones`, sin FKs estrictas, solo lectura para consumidores externos), marca `procesado=true` en un batch por transacción. Nunca escribe en Postgres. Expone `GET /healthz` en `:8082` con `{"pendientes": N, "ultima_sincronizacion": "..."}`.

## 4. web (React + Vite + TS + Tailwind)

- Variables de entorno: `VITE_AUTH_URL=http://localhost:8080`, `VITE_API_URL=http://localhost:8081`.
- Flujo de login: genera `code_verifier`/`code_challenge` (PKCE S256) en el cliente, guarda `code_verifier` en `sessionStorage`, redirige a `${VITE_AUTH_URL}/oauth/authorize?...`. En `/callback`, intercambia `code` por tokens en `POST ${VITE_AUTH_URL}/oauth/token`, guarda `access_token`/`refresh_token` en memoria + `localStorage` (MVP; nota de seguridad en TODO.md para mover a cookie httpOnly).
- Todas las llamadas a `VITE_API_URL` usan `Authorization: Bearer <access_token>`; interceptor de TanStack Query reintenta una vez tras refrescar el token en 401.
- Paleta y componentes: seguir `docs/design-system.md` (extraído del prototipo Artifact ya aprobado): primario `#0E6E66`, fondo `#F3F6F5`, tipografía Figtree + Source Serif 4, badges de `eval_estado` y `estado_revision` con los mismos colores usados en el prototipo.
- Pantallas mínimas (MVP): Login, Dashboard (resumen), Historias (lista con búsqueda/filtros/paginación), Historia detalle (tabs: Identificación, Evaluación, Propuesta interdisciplinaria, Seguimiento, Historial), Reportes (gráficos con Recharts).
- Confirmaciones destructivas (archivar historia): SweetAlert2.

## Variables de entorno (raíz `.env`, ver `.env.example`)

```
POSTGRES_DB=hc
POSTGRES_USER=hc
POSTGRES_PASSWORD=hc_dev_password
DATABASE_URL=postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable
AUTH_PORT=8080
API_PORT=8081
WORKER_HEALTH_PORT=8082
SQLITE_MIRROR_PATH=./data/mirror.sqlite
JWT_ISSUER=hc-auth
OAUTH_CLIENT_ID=hc-web
OAUTH_REDIRECT_URI=http://localhost:5173/callback
VITE_AUTH_URL=http://localhost:8080
VITE_API_URL=http://localhost:8081
```
