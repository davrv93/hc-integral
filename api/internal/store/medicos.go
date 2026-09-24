package store

import (
	"context"

	"hc/api/internal/model"
)

func (s *Store) ListMedicos(ctx context.Context) ([]model.Medico, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, nombre, titulo, especialidad, activo
		FROM medicos
		ORDER BY nombre`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Medico, 0)
	for rows.Next() {
		var m model.Medico
		if err := rows.Scan(&m.ID, &m.Nombre, &m.Titulo, &m.Especialidad, &m.Activo); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// GetMedico is used to expand a historia's medico field.
func (s *Store) GetMedico(ctx context.Context, id string) (model.Medico, error) {
	var m model.Medico
	err := s.Pool.QueryRow(ctx, `
		SELECT id, nombre, titulo, especialidad, activo
		FROM medicos WHERE id = $1`, id).Scan(&m.ID, &m.Nombre, &m.Titulo, &m.Especialidad, &m.Activo)
	return m, err
}
