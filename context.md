# Contexto y reglas de negocio

HC Integral gestiona historias clínicas interdisciplinarias de Medicina, Psicología, Terapia Física y Nutrición. PostgreSQL es base principal; worker replica cambios mediante outbox a espejo SQLite de solo lectura.

## Datos clínicos

- Crear paciente requiere DNI de exactamente 8 dígitos, nombres, apellidos, fecha de nacimiento ISO 8601 y sexo. DNI es único. Teléfono es opcional; filas antiguas pueden conservar fecha o sexo nulos.
- Historia vincula paciente existente con médico existente y requiere diagnóstico. Tiene correlativo único y estado inicial `en_revision`.
- Estados de evaluación: `SI`, `NO`, `PARCIAL`; pueden no estar informados.
- Estados de revisión: `en_revision`, `requiere_propuesta`, `completo`.
- Cada historia admite una intervención por disciplina: `medicina`, `psicologia`, `terapia_fisica`, `nutricion`.
- Atención registra disciplina, motivo y detalle; evaluación y campos clínicos adicionales son opcionales. Motivo y detalle son obligatorios al crear.
- Archivar historia es borrado lógico (`deleted_at`) y genera auditoría. No presentar la acción como borrado físico. No asumir que existe restauración: contrato actual no define endpoint de restauración.
- Auditoría registra actor, acción, entidad, cambios, IP y fecha. No exponer detalles sensibles fuera de permisos existentes.

## Roles y acceso

Roles: `admin`, `medico`, `psicologia`, `terapia_fisica`, `nutricion`, `revisor`.

Implementación actual en `api/internal/apiserver/router.go`:

- Todo endpoint `/api/v1` salvo `/health` requiere Bearer token; endpoints de lectura quedan protegidos.
- Crear pacientes, crear historias, editar historias y archivarlas requiere `admin` o `medico`.
- Guardar intervención o crear atención requiere `admin` o rol de la disciplina correspondiente.
- Importar atenciones requiere uno de `admin`, `medico`, `psicologia`, `terapia_fisica`, `nutricion`.
- Crear usuarios requiere `admin`.
- El endpoint de eliminación de atención actualmente exige autenticación, sin guard de rol adicional en router. No inferir permiso más restrictivo hasta validar y cambiar regla de negocio.
- La interfaz de médicos/usuarios es de solo lectura; no agregar acciones administrativas sin confirmar permisos y soporte de API.

## Integridad entre servicios

- `docs/CONTRACT.md` describe endpoints, formato, enum y flujos. `migrations/` define constraints persistentes.
- Mantén valores JSON en snake_case y fechas en ISO 8601. Mantén paginación 1-based; `page_size` API máximo es 100.
- `GET /historias/:id/atenciones` actualmente no ofrece paginación. Antes de ampliar su uso como lista grande, añade paginación del servidor y actualiza contrato, API y frontend.
- Escrituras clínicas deben respetar validación backend, permisos y auditoría. Triggers PostgreSQL alimentan outbox; API no escribe outbox directamente.
- Si contrato y rutas implementadas difieren, verifica ambas antes de cambiar comportamiento y documenta la decisión en el contrato.
