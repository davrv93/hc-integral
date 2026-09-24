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

- [ ] `GET /oauth/authorize` (login server-rendered) — *ver reporte del agente*
- [ ] `POST /oauth/token` (authorization_code + refresh_token, rotación)
- [ ] `GET /.well-known/jwks.json` (RS256)
- [ ] Bloqueo tras 5 intentos fallidos (15 min)
- [ ] Seed de usuarios de desarrollo
- [ ] `go build ./...` sin errores
- [ ] Probado contra Postgres real

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

- [ ] Lee `outbox`, aplica a SQLite, marca `procesado`
- [ ] `GET /healthz` con pendientes y última sincronización
- [ ] `go build ./...` sin errores
- [ ] Prueba (unitaria o end-to-end)

## Fase 5 — Frontend (React + Tailwind)

- [ ] Login con PKCE real contra auth-service
- [ ] Sidebar + shell de la app
- [ ] Dashboard con datos de `reportes/resumen`
- [ ] Historias: búsqueda, filtros, paginación, archivar (SweetAlert2)
- [ ] Detalle de HC: 5 pestañas, guardar cambios
- [ ] Reportes: gráficos (Recharts)
- [ ] `npm run build` sin errores

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
