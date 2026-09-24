package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"hc/api/internal/model"
)

const historiaCols = `
	id, correlativo, paciente_id, medico_id, diagnostico,
	plan_trabajo_estado::text, objetivos_estado::text, necesidades,
	objetivos_propuestos, plan_actual, plazo::text, observaciones,
	estado_revision::text, created_by, updated_by, created_at, updated_at, deleted_at`

func scanHistoria(row rowScanner) (model.Historia, error) {
	var h model.Historia
	var deletedAt *time.Time
	err := row.Scan(
		&h.ID, &h.Correlativo, &h.PacienteID, &h.MedicoID, &h.Diagnostico,
		&h.PlanTrabajoEstado, &h.ObjetivosEstado, &h.Necesidades,
		&h.ObjetivosPropuestos, &h.PlanActual, &h.Plazo, &h.Observaciones,
		&h.EstadoRevision, &h.CreatedBy, &h.UpdatedBy, &h.CreatedAt, &h.UpdatedAt, &deletedAt,
	)
	if err != nil {
		return h, err
	}
	h.CreatedAt = h.CreatedAt.UTC()
	h.UpdatedAt = h.UpdatedAt.UTC()
	if deletedAt != nil {
		s := deletedAt.UTC().Format(time.RFC3339)
		h.DeletedAt = &s
	}
	return h, nil
}

type CreateHistoriaInput struct {
	PacienteID  string
	MedicoID    string
	Diagnostico string
	CreatedBy   string
}

func (s *Store) CreateHistoria(ctx context.Context, in CreateHistoriaInput) (model.Historia, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO historias (paciente_id, medico_id, diagnostico, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $4)
		RETURNING %s`, historiaCols),
		in.PacienteID, in.MedicoID, in.Diagnostico, in.CreatedBy)
	return scanHistoria(row)
}

func (s *Store) GetHistoria(ctx context.Context, id string) (model.Historia, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM historias WHERE id = $1 AND deleted_at IS NULL`, historiaCols), id)
	return scanHistoria(row)
}

// GetHistoriaAny fetches a historia regardless of soft-delete state, used
// internally before writes so we can record accurate before/after audit
// snapshots and so PATCH/DELETE return a clean 404 vs "already deleted".
func (s *Store) GetHistoriaAny(ctx context.Context, id string) (model.Historia, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM historias WHERE id = $1`, historiaCols), id)
	return scanHistoria(row)
}

// GetLatestHistoriaByPaciente devuelve la historia activa mas reciente de
// un paciente (usada por la importacion de atenciones, que solo recibe el
// DNI del paciente en cada fila).
func (s *Store) GetLatestHistoriaByPaciente(ctx context.Context, pacienteID string) (model.Historia, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s FROM historias
		WHERE paciente_id = $1 AND deleted_at IS NULL
		ORDER BY updated_at DESC LIMIT 1`, historiaCols), pacienteID)
	return scanHistoria(row)
}

type HistoriaFilters struct {
	Q                 string
	MedicoID          string
	PlanTrabajoEstado string
	ObjetivosEstado   string
	EstadoRevision    string
}

func (s *Store) ListHistorias(ctx context.Context, f HistoriaFilters, page, pageSize int) ([]model.Historia, int, error) {
	where := []string{"h.deleted_at IS NULL"}
	args := []any{}

	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if strings.TrimSpace(f.Q) != "" {
		where = append(where, fmt.Sprintf(
			"(f_unaccent(lower(h.diagnostico)) LIKE f_unaccent(lower('%%' || %s || '%%')) OR f_unaccent(lower(p.nombres || ' ' || p.apellidos || ' ' || p.dni)) LIKE f_unaccent(lower('%%' || %s || '%%')))",
			arg(f.Q), fmt.Sprintf("$%d", len(args))))
	}
	if f.MedicoID != "" {
		where = append(where, "h.medico_id = "+arg(f.MedicoID))
	}
	if f.PlanTrabajoEstado != "" {
		where = append(where, "h.plan_trabajo_estado = "+arg(f.PlanTrabajoEstado)+"::eval_estado")
	}
	if f.ObjetivosEstado != "" {
		where = append(where, "h.objetivos_estado = "+arg(f.ObjetivosEstado)+"::eval_estado")
	}
	if f.EstadoRevision != "" {
		where = append(where, "h.estado_revision = "+arg(f.EstadoRevision)+"::estado_revision")
	}

	whereSQL := "WHERE " + strings.Join(where, " AND ")

	countSQL := fmt.Sprintf(`
		SELECT count(*)
		FROM historias h
		JOIN pacientes p ON p.id = h.paciente_id
		%s`, whereSQL)
	var total int
	if err := s.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limitArg := arg(pageSize)
	offsetArg := arg((page - 1) * pageSize)
	listSQL := fmt.Sprintf(`
		SELECT %s, p.nombres || ' ' || p.apellidos, p.dni, m.nombre
		FROM historias h
		JOIN pacientes p ON p.id = h.paciente_id
		JOIN medicos m ON m.id = h.medico_id
		%s
		ORDER BY h.created_at DESC
		LIMIT %s OFFSET %s`, prefixCols(), whereSQL, limitArg, offsetArg)

	rows, err := s.Pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.Historia, 0)
	for rows.Next() {
		var h model.Historia
		var deletedAt *time.Time
		var pacienteNombre, pacienteDNI, medicoNombre string
		err := rows.Scan(
			&h.ID, &h.Correlativo, &h.PacienteID, &h.MedicoID, &h.Diagnostico,
			&h.PlanTrabajoEstado, &h.ObjetivosEstado, &h.Necesidades,
			&h.ObjetivosPropuestos, &h.PlanActual, &h.Plazo, &h.Observaciones,
			&h.EstadoRevision, &h.CreatedBy, &h.UpdatedBy, &h.CreatedAt, &h.UpdatedAt, &deletedAt,
			&pacienteNombre, &pacienteDNI, &medicoNombre,
		)
		if err != nil {
			return nil, 0, err
		}
		h.CreatedAt = h.CreatedAt.UTC()
		h.UpdatedAt = h.UpdatedAt.UTC()
		if deletedAt != nil {
			str := deletedAt.UTC().Format(time.RFC3339)
			h.DeletedAt = &str
		}
		h.PacienteNombre = &pacienteNombre
		h.PacienteDNI = &pacienteDNI
		h.MedicoNombre = &medicoNombre
		out = append(out, h)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return out, total, nil
}

// prefixCols returns historiaCols with the "h." table alias prefixed on each
// bare column reference, for use in the joined list query.
func prefixCols() string {
	cols := []string{
		"id", "correlativo", "paciente_id", "medico_id", "diagnostico",
		"plan_trabajo_estado::text", "objetivos_estado::text", "necesidades",
		"objetivos_propuestos", "plan_actual", "plazo::text", "observaciones",
		"estado_revision::text", "created_by", "updated_by", "created_at", "updated_at", "deleted_at",
	}
	prefixed := make([]string, len(cols))
	for i, c := range cols {
		prefixed[i] = "h." + c
	}
	return strings.Join(prefixed, ", ")
}

// UpdatableHistoriaFields lists columns PATCH is allowed to touch.
var UpdatableHistoriaFields = map[string]bool{
	"diagnostico":          true,
	"medico_id":            true,
	"plan_trabajo_estado":  true,
	"objetivos_estado":     true,
	"necesidades":          true,
	"objetivos_propuestos": true,
	"plan_actual":          true,
	"plazo":                true,
	"observaciones":        true,
	"estado_revision":      true,
}

// UpdateHistoria applies a partial update built from a validated column->value
// map. It returns the row before and after the change so callers can write
// the auditoria record.
func (s *Store) UpdateHistoria(ctx context.Context, id string, updatedBy string, fields map[string]any) (before, after model.Historia, err error) {
	before, err = s.GetHistoriaAny(ctx, id)
	if err != nil {
		return before, after, err
	}

	setClauses := []string{}
	args := []any{}
	i := 1
	for col, val := range fields {
		cast := ""
		switch col {
		case "plan_trabajo_estado", "objetivos_estado":
			cast = "::eval_estado"
		case "estado_revision":
			cast = "::estado_revision"
		case "plazo":
			cast = "::date"
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d%s", col, i, cast))
		args = append(args, val)
		i++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_by = $%d", i))
	args = append(args, updatedBy)
	i++
	setClauses = append(setClauses, "updated_at = now()")

	args = append(args, id)
	sql := fmt.Sprintf(`UPDATE historias SET %s WHERE id = $%d AND deleted_at IS NULL RETURNING %s`,
		strings.Join(setClauses, ", "), i, historiaCols)

	row := s.Pool.QueryRow(ctx, sql, args...)
	after, err = scanHistoria(row)
	return before, after, err
}

func (s *Store) SoftDeleteHistoria(ctx context.Context, id string, updatedBy string) (before model.Historia, err error) {
	before, err = s.GetHistoria(ctx, id)
	if err != nil {
		return before, err
	}
	_, err = s.Pool.Exec(ctx, `UPDATE historias SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id, updatedBy)
	return before, err
}
