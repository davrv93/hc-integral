# worker

Outbox-to-SQLite sync worker for HC Integral, as specified in
[`docs/CONTRACT.md`](../docs/CONTRACT.md) section 3.

It polls the Postgres `outbox` table (fed by triggers on `pacientes`,
`medicos`, `historias`, `intervenciones` — see `migrations/0001_init.sql`)
and replays each change into a local SQLite file, `mirror.sqlite`. The
mirror is meant to be **read-only for everyone except this worker** — no
other process should write to it.

The worker never writes to Postgres except to flip `outbox.procesado` to
`true` on rows it has successfully mirrored.

## How it works

1. Every `POLL_INTERVAL_MS` (default 3000 ms), it opens a Postgres
   transaction and runs:
   ```sql
   SELECT id, tabla, op, row_id, payload
   FROM outbox
   WHERE procesado = false
   ORDER BY id
   LIMIT 500
   ```
2. For each row, it applies the change to the matching SQLite table:
   - `insert` / `update`: decodes `payload` (the full row as JSON, produced
     by `to_jsonb(NEW)` in the trigger) and runs
     `INSERT ... ON CONFLICT(id) DO UPDATE ...` (an upsert) against the
     mirror table named by `tabla`, keyed by `row_id`.
   - `delete`: deletes the row from the mirror table by `row_id`; the
     payload's contents are ignored (a delete's `to_jsonb(OLD)` is not
     needed to remove the row).
3. Rows that applied successfully have their ids collected; once the whole
   batch has been attempted, a single
   `UPDATE outbox SET procesado = true WHERE id = ANY($1)` runs **in the
   same Postgres transaction**, which is then committed.
4. If applying a specific row to SQLite fails (bad payload, unexpected
   shape, etc.), the error is logged, that row is **not** marked
   processed (so it's retried on the next poll), but the rest of the batch
   still gets applied and committed normally.
5. `GET /healthz` (on `WORKER_HEALTH_PORT`, default `8082`) returns:
   ```json
   {"pendientes": 0, "ultima_sincronizacion": "2026-09-23T23:32:25Z"}
   ```
   - `pendientes` is a live `SELECT count(*) FROM outbox WHERE procesado = false`
     against Postgres, evaluated on every request.
   - `ultima_sincronizacion` is kept in memory and updated whenever a poll
     iteration applies one or more rows; it's `null` until the first
     successful batch.

### Mirror schema

The SQLite mirror has one table per source table, same column names, no
foreign keys, primary key = same UUID (stored as `TEXT`):

- `pacientes(id, dni, nombres, apellidos, fecha_nac, sexo, telefono, created_at, updated_at)`
- `medicos(id, nombre, titulo, especialidad, activo, usuario_id, created_at)`
- `historias(id, correlativo, paciente_id, medico_id, diagnostico, plan_trabajo_estado, objetivos_estado, necesidades, objetivos_propuestos, plan_actual, plazo, observaciones, estado_revision, created_by, updated_by, created_at, updated_at, deleted_at)`
- `intervenciones(id, historia_id, disciplina, detalle, responsable_id, updated_at)`

`activo` is stored as `INTEGER` (0/1) since SQLite has no native boolean
type; `correlativo` is stored as `INTEGER`; everything else is `TEXT`
(including timestamps/dates, which come through as their Postgres
JSON/text representation, e.g. `2026-01-01T00:00:00Z`).

The schema is created with `CREATE TABLE IF NOT EXISTS` on startup, so it's
safe to restart the worker against an existing mirror file.

## Configuration

Read from the environment (see `../.env.example`); a local `.env` (checked
at `../.env` and `./.env`) is loaded automatically if present, but its
absence is not an error — safe to run in Docker with env vars set directly.

| Variable              | Default                                                      |
|------------------------|---------------------------------------------------------------|
| `DATABASE_URL`         | `postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable` |
| `SQLITE_MIRROR_PATH`   | `./data/mirror.sqlite` (parent dir created automatically)     |
| `POLL_INTERVAL_MS`     | `3000`                                                        |
| `WORKER_HEALTH_PORT`   | `8082`                                                        |

## Running locally

Requires Postgres reachable at `DATABASE_URL` with the schema from
`../migrations/0001_init.sql` applied (e.g. via
`docker compose up -d postgres` from the repo root, which mounts
`../migrations` into `/docker-entrypoint-initdb.d`).

```sh
cd worker
go run ./cmd/server
```

Then, in another shell:

```sh
curl http://localhost:8082/healthz
```

## Running with Docker

```sh
docker build -t hc-worker .
docker run --rm \
  -e DATABASE_URL="postgres://hc:hc_dev_password@host.docker.internal:5432/hc?sslmode=disable" \
  -p 8082:8082 \
  -v hc_worker_data:/app/data \
  hc-worker
```

The image is built `CGO_ENABLED=0` (the `modernc.org/sqlite` driver is pure
Go, no cgo/libsqlite3 needed) on `golang:1.27-alpine`, running as a
non-root `worker` user in the final `alpine` image. The mirror path
defaults to `/app/data/mirror.sqlite` inside the container; mount a volume
at `/app/data` to persist it.

## Inspecting the mirror

The mirror is a plain SQLite file — inspect it with the `sqlite3` CLI (or
any SQLite-compatible tool/library) while the worker is running; WAL mode
is enabled so concurrent read-only access doesn't block the worker's
writes:

```sh
sqlite3 ./data/mirror.sqlite ".tables"
sqlite3 ./data/mirror.sqlite ".schema medicos"
sqlite3 ./data/mirror.sqlite "SELECT id, nombre, especialidad FROM medicos;"
sqlite3 ./data/mirror.sqlite "SELECT count(*) FROM historias;"
```

Do not write to the mirror from anything other than this worker — external
writers risk lock contention and, more importantly, their changes will be
silently overwritten or diverge from Postgres on the next sync.

## Testing

- **Unit tests** (`internal/mirror/mirror_test.go`) exercise the
  outbox-apply logic directly against a temp-file SQLite database, with no
  Postgres dependency: insert, upsert-on-update, delete (ignoring the
  payload and deleting by id), NULL columns, integer coercion, and error
  cases (unknown table/op).

  ```sh
  go test ./...
  ```

- **End-to-end**: verified manually against the repo's
  `docker compose` Postgres — started the worker, inserted/updated/deleted
  a row directly in `medicos` via `psql`, and confirmed each change
  appeared in `./data/mirror.sqlite` within one poll interval, and that
  `/healthz`'s `pendientes`/`ultima_sincronizacion` reflected it. Also
  verified graceful shutdown (SIGTERM stops polling and closes both DB
  handles cleanly) and that the multi-stage Docker image builds and runs.

## Known simplifications / TODO

- The mirror schema is fixed/hand-written to match
  `migrations/0001_init.sql`; if that migration's columns change, update
  `internal/mirror/mirror.go`'s `schema` map to match.
- Delivery is at-least-once, not exactly-once: if the process crashes
  after committing the SQLite write for a row but before the Postgres
  `UPDATE ... procesado = true` transaction commits, that row will be
  reapplied on restart. Since mirror writes are upserts (or deletes by
  id), this is idempotent and safe.
- `usuarios` and `auditoria` are not mirrored (not in
  CONTRACT.md's list for this worker, and have no outbox triggers).
- No metrics/tracing beyond the health endpoint and stdout logs.
