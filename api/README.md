# api-service

REST API for HC Integral. Validates JWTs issued by `auth-service` (RS256,
via JWKS) and serves `pacientes`, `medicos`, `historias`, `intervenciones`,
`auditoria` and `reportes` endpoints over Postgres. See
[`docs/CONTRACT.md`](../docs/CONTRACT.md) section 2 for the full contract
this implements.

Stack: Go, [chi](https://github.com/go-chi/chi) for routing,
[pgx](https://github.com/jackc/pgx) for Postgres (hand-written SQL, no
ORM/codegen). It never writes to `outbox` — that table is populated by
Postgres triggers defined in `migrations/0001_init.sql`.

## Running locally

1. Start Postgres and load the schema (from the repo root):
   ```sh
   docker compose up -d postgres
   docker exec -i <postgres-container> psql -U hc -d hc < migrations/0001_init.sql
   ```
2. Copy `.env.example` to `.env` at the repo root (or export the vars
   yourself) and run:
   ```sh
   cd api
   go run ./cmd/server
   ```
   `main.go` best-effort loads `../.env` (repo root) and `./.env` via
   godotenv; it does not fail if neither exists.

Environment variables (defaults shown):

| Var | Default |
|---|---|
| `DATABASE_URL` | `postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable` |
| `API_PORT` | `8081` |
| `AUTH_JWKS_URL` | `http://localhost:8080/.well-known/jwks.json` |
| `JWT_ISSUER` | `hc-auth` |

## Building

```sh
go build ./...
go vet ./...
```

Docker:

```sh
docker build -t hc-api-service .
docker run --rm -p 8081:8081 \
  -e DATABASE_URL=postgres://hc:hc_dev_password@host.docker.internal:5432/hc?sslmode=disable \
  -e AUTH_JWKS_URL=http://host.docker.internal:8080/.well-known/jwks.json \
  hc-api-service
```

## Auth

Every route under `/api/v1` requires `Authorization: Bearer <jwt>` except
`GET /api/v1/health`. Tokens are validated against the auth-service's JWKS
(RS256), checking `iss` against `JWT_ISSUER` and `exp`. Keys are cached and
refreshed every 10 minutes, or immediately on an unrecognized `kid`. On
success, `usuario_id` (the `sub` claim) and `rol` (the `rol` claim) are
available to handlers via the request context and used for `created_by`/
`updated_by`/auditoria attribution.

RBAC beyond "authenticated" is not enforced yet at the HTTP layer (per
CONTRACT.md: "el api-service aplica la regla pero no bloquea al MVP más allá
de registrar auditoría" — see the repo's TODO.md for the fine-grained RBAC
phase). Every write is still attributed and audited.

## Error and pagination envelopes

Errors: `{"error": {"code": "...", "message": "..."}}` with the matching
HTTP status (400/401/403/404/409/422/500).

Lists: `{"data": [...], "page": 1, "page_size": 20, "total": 128, "total_pages": 7}`.
`page` defaults to 1, `page_size` defaults to 20 and is capped at 100.

## Example requests

Set a token once:

```sh
TOKEN="<a JWT from auth-service's /oauth/token>"
```

List historias (paginated, with filters):

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/api/v1/historias?estado_revision=en_revision&page=1&page_size=20"
```

Get one historia (expands paciente, medico, intervenciones):

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/api/v1/historias/<id>
```

Patch a historia (partial update; also writes an `auditoria` row with
`antes`/`despues` snapshots):

```sh
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"estado_revision":"requiere_propuesta","observaciones":"revisado"}' \
  http://localhost:8081/api/v1/historias/<id>
```

Upsert an intervención block for a discipline:

```sh
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"detalle":"Terapia ocupacional 2x/semana"}' \
  http://localhost:8081/api/v1/historias/<id>/intervenciones/nutricion
```

Reportes resumen (aggregates over historias/intervenciones; defaults to the
last 6 months for `serie_mensual` when `desde`/`hasta` are omitted):

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8081/api/v1/reportes/resumen?desde=2026-04-01&hasta=2026-09-30&medico_id=<medico-id>"
```

Create a paciente (`dni` must be exactly 8 digits, else `422`):

```sh
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dni":"12345678","nombres":"JUAN","apellidos":"PEREZ"}' \
  http://localhost:8081/api/v1/pacientes
```

## Validation rules

- `dni` (POST `/pacientes`): exactly 8 digits, else `422 validation_error`.
- `disciplina` path param (`PUT .../intervenciones/:disciplina`): one of
  `medicina|psicologia|terapia_fisica|nutricion`, else `400 bad_request`.
- `estado_revision`, `plan_trabajo_estado`, `objetivos_estado` (query
  filters and PATCH body): must match the Postgres enum values, else
  `422 validation_error`.

## Known simplifications (see TODO in the handback report)

- List search (`q` on pacientes/historias) uses the `f_unaccent` +
  `pg_trgm` index defined in the migration via a `LIKE` on the
  concatenated/unaccented columns rather than full `ts_rank`-style ranking.
- Fine-grained RBAC (blocking writes by `rol`) is not enforced at the HTTP
  layer, matching the CONTRACT.md MVP note; every write is still audited
  with `usuario_id`.
