# Instrucciones para agentes

## Antes de cambiar código

- Lee `context.md` para reglas de dominio y `skills.md` para criterios de diseño.
- Consulta `docs/CONTRACT.md` antes de cambiar APIs, modelos o integración entre servicios.
- Consulta `docs/design-system.md` antes de cambiar estilos o componentes visuales.
- Revisa `git status` y `git diff`. Conserva cambios previos que no pertenezcan a tu tarea.
- No leas, copies ni publiques secretos de `.env*`, claves privadas o datos clínicos reales.

## Mapa del proyecto

- `web/`: React, TypeScript, Vite y Tailwind. Rutas en `web/src/App.tsx`; páginas en `web/src/pages`; componentes reutilizables en `web/src/components`.
- `auth/`: OAuth2 Authorization Code con PKCE y emisión de JWT.
- `api/`: API REST, autenticación/autorización y acceso a PostgreSQL.
- `worker/`: procesa outbox y mantiene espejo SQLite de solo lectura.
- `migrations/`: esquema PostgreSQL versionado.
- `docs/CONTRACT.md`: contrato entre servicios. `docs/design-system.md`: identidad visual existente.

## Reglas de cambio

- Mantén validación y autorización en backend. La interfaz no sustituye controles de seguridad.
- Cambios de esquema requieren migración compatible y actualización de contrato, API, worker y frontend afectados.
- Conserva paginación del servidor en listas grandes. Evita cargar todos los registros para representarlos como tarjetas.
- Mantén etiquetas y valores de enums compatibles con API. No cambies estados clínicos para resolver un problema visual.
- Usa componentes y dependencias existentes antes de añadir dependencias.
- Conserva idioma español en textos de interfaz. Añade etiquetas accesibles, foco visible y objetivos táctiles de al menos 44 px.
- No inventes reglas clínicas. Registra incertidumbres en `context.md` o consulta al usuario si cambian permisos, datos o flujos clínicos.

## Comprobaciones

- Frontend: desde `web/`, ejecuta `npm run lint` y `npm run build`.
- Go: desde cada servicio (`auth/`, `api/`, `worker/`), ejecuta `go test ./...`, `go vet ./...` y `go build ./...` cuando el cambio afecte ese servicio.
- Cambios visuales: comprueba al menos viewport móvil y escritorio si hay navegador disponible.
- CI fuente: `.github/workflows/ci.yml`.
