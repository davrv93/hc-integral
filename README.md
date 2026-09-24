# HC Integral

Historia clínica interdisciplinaria (Medicina, Psicología, Terapia física,
Nutrición). React + Tailwind, dos servicios en Go (OAuth2/PKCE y REST), y un
espejo de solo lectura en SQLite alimentado por outbox.

Contrato completo entre servicios: [docs/CONTRACT.md](docs/CONTRACT.md).
Sistema visual: [docs/design-system.md](docs/design-system.md).
Checklist de avance: [TODO.md](TODO.md).

## Arquitectura

```
web (React)  --PKCE-->  auth (Go, :8080)  --JWT RS256-->  api (Go, :8081) --> PostgreSQL
                                                                                  |
                                                                            outbox (trigger)
                                                                                  v
                                                                      worker (Go, :8082) --> SQLite (espejo, solo lectura)
```

## Arrancar todo en local

Requiere: Docker, Go 1.27+, Node 20+.

```bash
cp .env.example .env

# 1) Base de datos
docker compose up -d postgres

# 2) Usuarios de desarrollo (dra.avilez@hc.local / dr.abril@hc.local, clave Clave123!)
cd auth && go run ./cmd/seed && cd ..

# 3) Los tres servicios Go, cada uno en su terminal
(cd auth   && go run ./cmd/server)   # :8080
(cd api    && go run ./cmd/server)   # :8081
(cd worker && go run ./cmd/server)   # :8082

# 4) Frontend
cd web && cp .env.example .env && npm install && npm run dev   # :5173
```

Abrir http://localhost:5173 → botón "Ingresar" o "Continuar con cuenta
institucional" inicia el flujo OAuth2 + PKCE contra `auth`.

## Verificado en esta pasada (ver TODO.md para el detalle completo)

Cada servicio fue construido y probado por separado contra Postgres real, y
luego se corrió una integración conjunta manual: login PKCE real → JWT válido
→ creación de paciente/historia vía API → trigger de `outbox` → réplica
automática en el espejo SQLite → agregados correctos en `reportes/resumen`.
Sin mocks en esa prueba final, con los tres binarios Go y Postgres corriendo
al mismo tiempo.

## Estructura

```
migrations/   esquema PostgreSQL (0001_init.sql)
docs/         contrato de servicios + sistema visual
auth/         OAuth2 Authorization Code + PKCE (Go)
api/          REST de pacientes/historias/intervenciones/reportes (Go)
worker/       outbox -> espejo SQLite (Go)
web/          React + Vite + TypeScript + Tailwind
docker-compose.yml   Postgres para desarrollo
```

## Pendiente explícito (no implementado en esta pasada)

Ver la sección final de [TODO.md](TODO.md): RBAC fino por rol, mover tokens
de `localStorage` a cookie httpOnly + BFF, exportación real a Excel/PDF,
CRUD completo de Pacientes y de Usuarios/Médicos, cifrado en reposo del
espejo SQLite, tests end-to-end y CI.
