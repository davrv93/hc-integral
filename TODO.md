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
- [ ] CI (lint + tests) — no implementado en esta pasada.

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

- [ ] Middleware JWT (valida contra JWKS del auth-service)
- [ ] CRUD pacientes / médicos
- [ ] CRUD historias + intervenciones por disciplina
- [ ] Auditoría en cada escritura
- [ ] `GET /api/v1/reportes/resumen`
- [ ] Paginación y filtros (`q`, médico, plan, objetivos, estado)
- [ ] `go build ./...` sin errores
- [ ] Probado contra Postgres real

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
- [x] Historias: búsqueda debounced, filtros, paginación server-side,
      archivar con SweetAlert2 + toast
- [x] Detalle de HC: 5 pestañas, react-hook-form + zod, guarda solo campos
      modificados, historial de auditoría real
- [x] Reportes: LineChart, barras por disciplina, tabla por médico
- [x] `npm run build` (tsc + vite), `npm run lint`, `npm run dev` — todo limpio

Placeholders explícitos (fuera de alcance de esta pasada, no son bugs):
"Actividad reciente" del dashboard, exportar Excel/PDF, CRUD de Pacientes y
de Usuarios. Bundle sin code-splitting (~301KB gzip) — ver `web/README.md`.

## Fase 6 — Integración

- [ ] `docker compose up` levanta Postgres, migración se aplica
- [ ] auth + api + worker corren juntos contra la misma DB
- [ ] Flujo completo probado: login → crear/editar HC → aparece en reportes → aparece en espejo SQLite
- [ ] README raíz con instrucciones de arranque

## Pendiente fuera de esta pasada (explícito, no es olvido)

- [ ] RBAC fino por disciplina (hoy: cualquier rol autenticado puede escribir;
      falta bloquear por rol en el middleware).
- [ ] Tokens en `localStorage` en el frontend — mover a cookie httpOnly + BFF
      antes de producción.
- [ ] Exportación real a Excel/PDF en Reportes (hoy: stub).
- [ ] Pantallas de Pacientes y Médicos/usuarios (catálogos) como CRUD completo.
- [ ] Cifrado en reposo del espejo SQLite si sale del servidor.
- [ ] Tests automatizados end-to-end (Playwright) y CI.
