# auth-service

Go implementation of the OAuth2 **Authorization Code + PKCE** flow described in
[`docs/CONTRACT.md`](../docs/CONTRACT.md) section 1. Issues RS256 JWT access
tokens plus rotating opaque refresh tokens, backed by the `usuarios`,
`medicos`, `oauth_clients`, `oauth_codes` and `refresh_tokens` tables from
[`migrations/0001_init.sql`](../migrations/0001_init.sql).

## Requisitos

- Go 1.27+
- Postgres 15+ con el esquema de `migrations/0001_init.sql` ya aplicado
  (ver `docker-compose.yml` en la raíz del repo: `docker compose up -d postgres`)

## Variables de entorno

Lee `DATABASE_URL`, `AUTH_PORT`, `OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`,
`JWT_ISSUER` del entorno del proceso, y opcionalmente de un archivo `.env` en
la raíz del repo (`../.env` relativo a este módulo, o `.env` si el binario se
ejecuta desde la raíz) — ver `.env.example` en la raíz. Ausencia del archivo
no es un error.

| Variable             | Default (si falta)                                              |
|----------------------|-------------------------------------------------------------------|
| `DATABASE_URL`       | `postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable` |
| `AUTH_PORT`          | `8080`                                                             |
| `OAUTH_CLIENT_ID`    | `hc-web`                                                           |
| `OAUTH_REDIRECT_URI` | `http://localhost:5173/callback`                                   |
| `JWT_ISSUER`         | `hc-auth`                                                          |
| `AUTH_KEYS_DIR`      | `keys` (directorio relativo al cwd del proceso)                    |

## Cómo correr

```bash
cd auth
go run ./cmd/seed     # crea/actualiza los dos usuarios de desarrollo (idempotente)
go run ./cmd/server   # levanta el auth-service en :8080 (o $AUTH_PORT)
```

Al primer arranque, si no existe `auth/keys/private.pem`, se genera un
keypair RSA de 2048 bits y se persiste con permisos `0600`; en arranques
posteriores se reutiliza la misma clave (y por tanto el mismo `kid`).

Usuarios de desarrollo creados por el seed (contraseña `Clave123!` en ambos):

| Email                  | Rol     | Fila en `medicos` |
|-------------------------|---------|--------------------|
| `dra.avilez@hc.local`   | admin   | DRA. AVILEZ        |
| `dr.abril@hc.local`     | medico  | DR. ABRIL          |

## Docker

```bash
docker build -t hc-auth .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL="postgres://hc:hc_dev_password@host.docker.internal:5432/hc?sslmode=disable" \
  -v "$(pwd)/keys:/app/keys" \
  hc-auth
```

Monta `/app/keys` como volumen si quieres que la clave RSA sobreviva a la
recreación del contenedor (si no, se regenera un keypair nuevo en cada
arranque del contenedor, lo que invalida los JWT ya emitidos).

## Flujo completo por curl (Authorization Code + PKCE)

Genera un `code_verifier` / `code_challenge` (S256) con `openssl`:

```bash
VERIFIER=$(openssl rand -base64 48 | tr -d '=+/' | cut -c1-64)
CHALLENGE=$(printf '%s' "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr '+/' '-_' | tr -d '=')
echo "verifier=$VERIFIER"
echo "challenge=$CHALLENGE"
```

1. **Login (form-based)** — en un navegador real, GET `/oauth/authorize` sirve
   el formulario HTML; aquí simulamos el POST directamente con `curl -c/-b`
   para conservar la cookie de sesión:

   ```bash
   curl -c cookies.txt "http://localhost:8080/oauth/authorize?response_type=code&client_id=hc-web&redirect_uri=http://localhost:5173/callback&code_challenge=$CHALLENGE&code_challenge_method=S256&state=xyz"

   curl -i -b cookies.txt -c cookies.txt \
     --data-urlencode "client_id=hc-web" \
     --data-urlencode "redirect_uri=http://localhost:5173/callback" \
     --data-urlencode "code_challenge=$CHALLENGE" \
     --data-urlencode "code_challenge_method=S256" \
     --data-urlencode "state=xyz" \
     --data-urlencode "email=dra.avilez@hc.local" \
     --data-urlencode "password=Clave123!" \
     "http://localhost:8080/oauth/authorize"
   ```

   La respuesta es un `302` con `Location: http://localhost:5173/callback?code=...&state=xyz`.
   Copia el valor de `code`.

2. **Intercambiar el code por tokens:**

   ```bash
   CODE="<pega aquí el code>"
   curl -X POST http://localhost:8080/oauth/token \
     -H "Content-Type: application/json" \
     -d "{\"grant_type\":\"authorization_code\",\"code\":\"$CODE\",\"redirect_uri\":\"http://localhost:5173/callback\",\"client_id\":\"hc-web\",\"code_verifier\":\"$VERIFIER\"}"
   ```

   Responde `{"access_token","refresh_token","token_type":"Bearer","expires_in":900}`.

3. **Refrescar el access token (rota el refresh token; el anterior queda revocado):**

   ```bash
   REFRESH="<refresh_token de la respuesta anterior>"
   curl -X POST http://localhost:8080/oauth/token \
     -H "Content-Type: application/json" \
     -d "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"$REFRESH\",\"client_id\":\"hc-web\"}"
   ```

   Reutilizar un `refresh_token` ya rotado/usado revoca **toda la familia**
   (todos los tokens emitidos desde ese login quedan inválidos) y responde
   `400 {"error":"invalid_grant", ...}`.

4. **Ver las claves públicas (JWKS):**

   ```bash
   curl http://localhost:8080/.well-known/jwks.json
   ```

5. **Logout (revoca toda la familia del refresh token):**

   ```bash
   curl -X POST http://localhost:8080/oauth/logout \
     -H "Content-Type: application/json" \
     -d "{\"refresh_token\":\"$REFRESH\"}"
   ```

6. **Health check:**

   ```bash
   curl http://localhost:8080/healthz
   ```

## Seguridad implementada

- Passwords: argon2id, `time=1, memory=64MB, threads=4`, salt de 16 bytes,
  formato `argon2id$v=19$m=65536,t=1,p=4$<salt_b64>$<hash_b64>`.
- Bloqueo de cuenta: 5 logins fallidos consecutivos → `locked_until = now()+15min`
  en `usuarios`; mientras está bloqueada, el intento de login responde
  `429` con un JSON `{"error":"account_locked","message":"..."}`.
- PKCE `S256` obligatorio (no se admite `plain`).
- Rotación de refresh tokens con detección de reuso: reutilizar un token ya
  rotado revoca toda su `family_id`.
- JWT de acceso: RS256, TTL 15 min, claims `iss, sub, email, nombre, rol, iat, exp`,
  `kid` en el header coincide con una entrada del JWKS.

## Simplificaciones / TODO

- Las sesiones de navegador (para saltarse el formulario si ya hay sesión
  activa) se guardan **en memoria del proceso** (no en DB ni cookie firmada
  con secreto propio); se pierden al reiniciar el proceso. Suficiente para
  desarrollo; en producción convendría un almacén compartido o JWT de sesión
  firmado.
- No hay protección CSRF explícita en el formulario de login (mismo-origen,
  MVP de desarrollo).
- No hay rate limiting por IP, solo el bloqueo por cuenta ya especificado en
  el contrato.
- El `code_challenge_method=plain` no está soportado intencionalmente (el
  contrato lo marca como obligatoriamente `S256`).
