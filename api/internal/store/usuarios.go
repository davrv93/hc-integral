package store

import (
	"context"

	"hc/api/internal/model"
)

type CreateUsuarioInput struct {
	Email        string
	Nombre       string
	PasswordHash string
	Rol          string
	Titulo       string
	Especialidad *string
}

func (s *Store) ListUsuarios(ctx context.Context) ([]model.Usuario, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, email::text, nombre, rol::text, activo, created_at, updated_at
		FROM usuarios
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Usuario, 0)
	for rows.Next() {
		var u model.Usuario
		if err := rows.Scan(&u.ID, &u.Email, &u.Nombre, &u.Rol, &u.Activo, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		u.CreatedAt = u.CreatedAt.UTC()
		u.UpdatedAt = u.UpdatedAt.UTC()
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) CreateUsuario(ctx context.Context, in CreateUsuarioInput) (model.Usuario, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return model.Usuario{}, err
	}
	defer tx.Rollback(ctx)

	var u model.Usuario
	err = tx.QueryRow(ctx, `
		INSERT INTO usuarios (email, nombre, password_hash, rol, activo)
		VALUES ($1, $2, $3, $4::rol_usuario, true)
		RETURNING id, email::text, nombre, rol::text, activo, created_at, updated_at`,
		in.Email, in.Nombre, in.PasswordHash, in.Rol,
	).Scan(&u.ID, &u.Email, &u.Nombre, &u.Rol, &u.Activo, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return u, err
	}

	if in.Rol == "medico" || in.Rol == "psicologia" || in.Rol == "terapia_fisica" || in.Rol == "nutricion" {
		titulo := in.Titulo
		if titulo == "" {
			titulo = "Lic."
			if in.Rol == "medico" {
				titulo = "Dr."
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO medicos (nombre, titulo, especialidad, activo, usuario_id)
			VALUES ($1, $2, $3, true, $4)`,
			in.Nombre, titulo, in.Especialidad, u.ID); err != nil {
			return u, err
		}
	}

	u.CreatedAt = u.CreatedAt.UTC()
	u.UpdatedAt = u.UpdatedAt.UTC()
	return u, tx.Commit(ctx)
}
