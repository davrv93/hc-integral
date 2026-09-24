package store

import (
	"context"

	"hc/api/internal/model"
)

func (s *Store) ListIntervenciones(ctx context.Context, historiaID string) ([]model.Intervencion, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, historia_id, disciplina::text, detalle, responsable_id, updated_at
		FROM intervenciones
		WHERE historia_id = $1
		ORDER BY disciplina`, historiaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Intervencion, 0)
	for rows.Next() {
		var iv model.Intervencion
		if err := rows.Scan(&iv.ID, &iv.HistoriaID, &iv.Disciplina, &iv.Detalle, &iv.ResponsableID, &iv.UpdatedAt); err != nil {
			return nil, err
		}
		iv.UpdatedAt = iv.UpdatedAt.UTC()
		out = append(out, iv)
	}
	return out, rows.Err()
}

// UpsertIntervencion inserts or updates the (historia_id, disciplina) row,
// per the UNIQUE constraint in migrations/0001_init.sql.
func (s *Store) UpsertIntervencion(ctx context.Context, historiaID, disciplina, detalle, responsableID string) (model.Intervencion, error) {
	var iv model.Intervencion
	err := s.Pool.QueryRow(ctx, `
		INSERT INTO intervenciones (historia_id, disciplina, detalle, responsable_id)
		VALUES ($1, $2::disciplina_tipo, $3, $4)
		ON CONFLICT (historia_id, disciplina)
		DO UPDATE SET detalle = EXCLUDED.detalle, responsable_id = EXCLUDED.responsable_id, updated_at = now()
		RETURNING id, historia_id, disciplina::text, detalle, responsable_id, updated_at`,
		historiaID, disciplina, detalle, responsableID,
	).Scan(&iv.ID, &iv.HistoriaID, &iv.Disciplina, &iv.Detalle, &iv.ResponsableID, &iv.UpdatedAt)
	if err != nil {
		return iv, err
	}
	iv.UpdatedAt = iv.UpdatedAt.UTC()
	return iv, nil
}
