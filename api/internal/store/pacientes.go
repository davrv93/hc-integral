package store

import (
	"context"
	"fmt"
	"strings"

	"hc/api/internal/model"
)

type CreatePacienteInput struct {
	DNI       string
	Nombres   string
	Apellidos string
	FechaNac  *string
	Sexo      *string
	Telefono  *string
}

const pacienteCols = `id, dni, nombres, apellidos, fecha_nac::text, sexo, telefono, created_at, updated_at`

func scanPaciente(row rowScanner) (model.Paciente, error) {
	var p model.Paciente
	err := row.Scan(&p.ID, &p.DNI, &p.Nombres, &p.Apellidos, &p.FechaNac, &p.Sexo, &p.Telefono, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return p, err
	}
	// pgx decodes timestamptz using the local zone of this process; CONTRACT.md
	// requires a "Z" (UTC) suffix on the wire, so normalize before returning.
	p.CreatedAt = p.CreatedAt.UTC()
	p.UpdatedAt = p.UpdatedAt.UTC()
	return p, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func (s *Store) CreatePaciente(ctx context.Context, in CreatePacienteInput) (model.Paciente, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO pacientes (dni, nombres, apellidos, fecha_nac, sexo, telefono)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING %s`, pacienteCols),
		in.DNI, in.Nombres, in.Apellidos, in.FechaNac, in.Sexo, in.Telefono)
	return scanPaciente(row)
}

func (s *Store) GetPaciente(ctx context.Context, id string) (model.Paciente, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM pacientes WHERE id = $1`, pacienteCols), id)
	return scanPaciente(row)
}

func (s *Store) GetPacienteByDNI(ctx context.Context, dni string) (model.Paciente, error) {
	row := s.Pool.QueryRow(ctx, fmt.Sprintf(`SELECT %s FROM pacientes WHERE dni = $1`, pacienteCols), dni)
	return scanPaciente(row)
}

func (s *Store) ListPacientes(ctx context.Context, q string, page, pageSize int) ([]model.Paciente, int, error) {
	var (
		rows  = make([]model.Paciente, 0)
		total int
	)

	where := ""
	args := []any{}
	if strings.TrimSpace(q) != "" {
		where = `WHERE f_unaccent(lower(nombres || ' ' || apellidos || ' ' || dni)) LIKE f_unaccent(lower('%' || $1 || '%'))`
		args = append(args, q)
	}

	countSQL := fmt.Sprintf(`SELECT count(*) FROM pacientes %s`, where)
	if err := s.Pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limitArg := len(args) + 1
	offsetArg := len(args) + 2
	listSQL := fmt.Sprintf(`SELECT %s FROM pacientes %s ORDER BY apellidos, nombres LIMIT $%d OFFSET $%d`,
		pacienteCols, where, limitArg, offsetArg)
	args = append(args, pageSize, (page-1)*pageSize)

	pgRows, err := s.Pool.Query(ctx, listSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer pgRows.Close()
	for pgRows.Next() {
		p, err := scanPaciente(pgRows)
		if err != nil {
			return nil, 0, err
		}
		rows = append(rows, p)
	}
	if err := pgRows.Err(); err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}
