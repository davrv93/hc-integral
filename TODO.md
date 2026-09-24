# TODO — HC Integral

Checklist para verificar qué se cumplió del plan. `[x]` hecho y verificado,
`[~]` hecho parcial / simulado, `[ ]` pendiente. Cada bloque tiene su
comentario de estado; se actualiza según el reporte de cada servicio.

## Fase 1 — Base

- [x] Esquema PostgreSQL (`migrations/0001_init.sql`): usuarios, médicos,
      pacientes, historias, intervenciones, auditoría, outbox, OAuth.
- [x] Contrato de servicios (`docs/CONTRACT.md`) y sistema visual
      (`docs/design-system.md`).
- [x] `docker-compose.yml` (Postgres) y `.env.example`.
- [x] CI (lint + tests) — `.github/workflows/ci.yml` ejecuta Go
      test/vet/build en auth/api/worker y lint/build del frontend.

## Fase 2 — Auth (Go, OAuth2 + PKCE)

- [x] `GET/POST /oauth/authorize` (login server-rendered, sesión in-memory)
- [x] `POST /oauth/token` (authorization_code + refresh_token, rotación,
      revocación de familia completa al detectar reuso)
- [x] `GET /.well-known/jwks.json` (RS256)
- [x] Bloqueo tras 5 intentos fallidos (15 min) — verificado con 429 real
- [x] Seed de usuarios de desarrollo (idempotente)
- [x] `go build ./...`, `go vet`, `gofmt` sin errores
- [x] Probado end-to-end contra Postgres real: PKCE completo, rotación,
      reuso detectado, logout, lockout, imagen Docker (`/healthz` ok, 78MB)

Bug encontrado y corregido en `migrations/0001_init.sql`: `CREATE EXTENSION
citext` estaba después de la tabla `usuarios` que lo usa — movido junto a
las demás extensiones al inicio del archivo.

Simplificaciones: sesión de login in-memory (un solo proceso), sin CSRF en
el form (mismo origen, dev), sin rate-limit por IP además del lockout por
cuenta.

## Fase 3 — API (Go, REST)

- [x] Middleware JWT (valida contra JWKS del auth-service, refresco cada 10 min)
- [x] CRUD pacientes / médicos (DNI validado, 409 en duplicado)
- [x] CRUD historias + intervenciones por disciplina (PUT upsert)
- [x] Auditoría real en cada escritura (antes/después, usuario, IP)
- [x] `GET /api/v1/reportes/resumen` (todos los agregados, verificados con datos reales)
- [x] Paginación y filtros (`q`, médico, plan, objetivos, estado)
- [x] `go build ./...`, `go vet`, `gofmt` sin errores
- [x] Probado end-to-end contra Postgres real (mock JWKS + binario real):
      401/404/409/422 confirmados, outbox poblado solo por triggers (nunca
      por la API)

Simplificaciones: RBAC fino por rol no bloquea a nivel HTTP en este MVP
(según lo previsto en CONTRACT.md — toda escritura sí queda auditada por
usuario); `GET /medicos` sin paginar; `historias` list incluye campos
denormalizados (paciente_nombre, medico_nombre) para evitar N+1 en el
frontend.

## Fase 4 — Espejo SQLite (worker)

- [x] Lee `outbox`, aplica a SQLite, marca `procesado`
- [x] `GET /healthz` con pendientes y última sincronización
- [x] `go build ./...`, `go vet`, `go test`, `gofmt` sin errores
- [x] Probado end-to-end contra Postgres real (insert/update/delete replicado)
      y contra la imagen Docker; apagado limpio con SIGTERM verificado.

Simplificaciones documentadas en `worker/README.md`: entrega at-least-once
(seguro por upsert idempotente), sin introspección automática de esquema,
`usuarios`/`auditoria` no se espejan (no están en el contrato de este worker).

## Fase 5 — Frontend (React + Tailwind)

- [x] Login con PKCE real (SubtleCrypto S256) contra auth-service
- [x] Sidebar + shell de la app
- [x] Dashboard con datos de `reportes/resumen` (donut, barras, plazos)
- [x] Historias: creación con modal de búsqueda de paciente por DNI,
      selección de médico y diagnóstico; búsqueda debounced, filtros,
      paginación server-side, archivar con SweetAlert2 + toast
- [x] Detalle de HC: 5 pestañas, react-hook-form + zod, guarda solo campos
      modificados como atención, historial de auditoría real y gráfico de
      evolución por snapshots de auditoría
- [x] Reportes: LineChart, barras por disciplina, tabla por médico
- [x] `npm run build` (tsc + vite), `npm run lint`, `npm run dev` — todo limpio

Placeholders explícitos (fuera de alcance de esta pasada, no son bugs):
"Actividad reciente" del dashboard y CRUD de Médicos/Usuarios. Pacientes ya
tiene alta, búsqueda y paginación sobre la API existente; Reportes descarga
CSV y abre una vista imprimible para PDF. Bundle sin code-splitting
(~304KB gzip) — ver `web/README.md`.

## Fase 6 — Integración

- [x] `docker compose up` levanta Postgres, migración se aplica limpia
      (recreado desde cero tras el fix de `citext`, 10 tablas creadas sin error)
- [x] auth + api + worker corren juntos contra la misma DB (verificado con
      los tres binarios reales simultáneos, no mocks)
- [x] Flujo completo probado en vivo: login PKCE real → JWT → `POST
      /pacientes` + `POST /historias` vía API → trigger llena `outbox` →
      worker replica a SQLite en <4s → `GET /reportes/resumen` refleja el
      nuevo registro correctamente
- [x] README raíz con instrucciones de arranque (`README.md`)

## Pendiente fuera de esta pasada (explícito, no es olvido)

- [x] RBAC básico por rol/disciplina: admin/médico escriben historias y
      pacientes; cada intervención solo la escribe admin o su disciplina.
- [ ] Tokens en `localStorage` en el frontend — mover a cookie httpOnly + BFF
      antes de producción.
- [x] Exportación real en Reportes: CSV compatible con Excel y vista imprimible
      para guardar/imprimir como PDF.
- [~] Pantallas de Pacientes y Médicos/usuarios: Pacientes tiene alta,
      búsqueda y paginación; Médicos/usuarios queda en solo lectura porque la
      API aún no expone endpoints de escritura.
- [ ] Cifrado en reposo del espejo SQLite si sale del servidor.
- [ ] Tests automatizados end-to-end (Playwright) y CI.
