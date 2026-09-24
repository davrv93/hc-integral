package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"hc/api/internal/model"
)

type CreateAtencionInput struct {
	HistoriaID          string
	Disciplina          string
	Motivo              string
	Detalle             string
	PlanTrabajoEstado   *string
	ObjetivosEstado     *string
	Necesidades         *string
	ObjetivosPropuestos *string
	PlanActual          *string
	Observaciones       *string
	ResponsableID       string
}

func scanAtencion(row rowScanner) (model.Atencion, error) {
	var a model.Atencion
	err := row.Scan(
		&a.ID, &a.HistoriaID, &a.Disciplina, &a.Fecha, &a.Motivo, &a.Detalle,
		&a.PlanTrabajoEstado, &a.ObjetivosEstado, &a.Necesidades,
		&a.ObjetivosPropuestos, &a.PlanActual, &a.Observaciones,
		&a.ResponsableID, &a.CreatedAt,
	)
	if err != nil {
		return a, err
	}
	a.Fecha = a.Fecha.UTC()
	a.CreatedAt = a.CreatedAt.UTC()
	return a, nil
}

func (s *Store) ListAtenciones(ctx context.Context, historiaID string) ([]model.Atencion, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, historia_id, disciplina::text, fecha, motivo, detalle,
			plan_trabajo_estado::text, objetivos_estado::text, necesidades,
			objetivos_propuestos, plan_actual, observaciones, responsable_id, created_at
		FROM atenciones
		WHERE historia_id = $1
		ORDER BY fecha DESC, created_at DESC`, historiaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Atencion, 0)
	for rows.Next() {
		a, err := scanAtencion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) GetAtencion(ctx context.Context, id string) (model.Atencion, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, historia_id, disciplina::text, fecha, motivo, detalle,
			plan_trabajo_estado::text, objetivos_estado::text, necesidades,
			objetivos_propuestos, plan_actual, observaciones, responsable_id, created_at
		FROM atenciones WHERE id = $1`, id)
	return scanAtencion(row)
}

func (s *Store) DeleteAtencion(ctx context.Context, id string) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM atenciones WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *Store) CreateAtencion(ctx context.Context, in CreateAtencionInput) (model.Atencion, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return model.Atencion{}, err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO atenciones (
			historia_id, disciplina, motivo, detalle, plan_trabajo_estado,
			objetivos_estado, necesidades, objetivos_propuestos, plan_actual,
			observaciones, responsable_id
		)
		VALUES ($1, $2::disciplina_tipo, $3, $4, $5::eval_estado, $6::eval_estado, $7, $8, $9, $10, $11)
		RETURNING id, historia_id, disciplina::text, fecha, motivo, detalle,
			plan_trabajo_estado::text, objetivos_estado::text, necesidades,
			objetivos_propuestos, plan_actual, observaciones, responsable_id, created_at`,
		in.HistoriaID, in.Disciplina, in.Motivo, in.Detalle, in.PlanTrabajoEstado,
		in.ObjetivosEstado, in.Necesidades, in.ObjetivosPropuestos, in.PlanActual,
		in.Observaciones, in.ResponsableID)
	a, err := scanAtencion(row)
	if err != nil {
		return a, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE historias
		SET plan_trabajo_estado = COALESCE($2::eval_estado, plan_trabajo_estado),
			objetivos_estado = COALESCE($3::eval_estado, objetivos_estado),
			necesidades = COALESCE($4, necesidades),
			objetivos_propuestos = COALESCE($5, objetivos_propuestos),
			plan_actual = COALESCE($6, plan_actual),
			observaciones = COALESCE($7, observaciones),
			updated_by = $8,
			updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		in.HistoriaID, in.PlanTrabajoEstado, in.ObjetivosEstado, in.Necesidades,
		in.ObjetivosPropuestos, in.PlanActual, in.Observaciones, in.ResponsableID)
	if err != nil {
		return a, err
	}

	return a, tx.Commit(ctx)
}
