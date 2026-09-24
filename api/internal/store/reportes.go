package store

import (
	"context"
	"fmt"
	"time"
)

type ResumenFilters struct {
	Desde    *time.Time
	Hasta    *time.Time
	MedicoID string
}

type PorMedico struct {
	MedicoID          string `json:"medico_id"`
	Nombre            string `json:"nombre"`
	Total             int    `json:"total"`
	EnRevision        int    `json:"en_revision"`
	RequierePropuesta int    `json:"requiere_propuesta"`
	Completo          int    `json:"completo"`
}

type SerieMensual struct {
	Mes         string `json:"mes"`
	Creadas     int    `json:"creadas"`
	Completadas int    `json:"completadas"`
}

type Resumen struct {
	PorEstado                   map[string]int `json:"por_estado"`
	PlanTrabajo                 map[string]int `json:"plan_trabajo"`
	Objetivos                   map[string]int `json:"objetivos"`
	PorMedico                   []PorMedico    `json:"por_medico"`
	IntervencionesPorDisciplina map[string]int `json:"intervenciones_por_disciplina"`
	SerieMensual                []SerieMensual `json:"serie_mensual"`
}

func (s *Store) Resumen(ctx context.Context, f ResumenFilters) (Resumen, error) {
	where := []string{"h.deleted_at IS NULL"}
	args := []any{}
	arg := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if f.Desde != nil {
		where = append(where, "h.created_at >= "+arg(*f.Desde))
	}
	if f.Hasta != nil {
		where = append(where, "h.created_at < "+arg(*f.Hasta))
	}
	if f.MedicoID != "" {
		where = append(where, "h.medico_id = "+arg(f.MedicoID))
	}
	whereSQL := "WHERE " + joinAnd(where)

	res := Resumen{
		PorEstado:                   map[string]int{"en_revision": 0, "requiere_propuesta": 0, "completo": 0},
		PlanTrabajo:                 map[string]int{"SI": 0, "NO": 0, "PARCIAL": 0},
		Objetivos:                   map[string]int{"SI": 0, "NO": 0, "PARCIAL": 0},
		PorMedico:                   []PorMedico{},
		IntervencionesPorDisciplina: map[string]int{"medicina": 0, "psicologia": 0, "terapia_fisica": 0, "nutricion": 0},
		SerieMensual:                []SerieMensual{},
	}

	// por_estado
	rows, err := s.Pool.Query(ctx, fmt.Sprintf(`
		SELECT h.estado_revision::text, count(*) FROM historias h %s GROUP BY h.estado_revision`, whereSQL), args...)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var k string
		var c int
		if err := rows.Scan(&k, &c); err != nil {
			rows.Close()
			return res, err
		}
		res.PorEstado[k] = c
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return res, err
	}

	// plan_trabajo
	rows, err = s.Pool.Query(ctx, fmt.Sprintf(`
		SELECT h.plan_trabajo_estado::text, count(*) FROM historias h %s AND h.plan_trabajo_estado IS NOT NULL GROUP BY h.plan_trabajo_estado`, whereSQL), args...)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var k string
		var c int
		if err := rows.Scan(&k, &c); err != nil {
			rows.Close()
			return res, err
		}
		res.PlanTrabajo[k] = c
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return res, err
	}

	// objetivos
	rows, err = s.Pool.Query(ctx, fmt.Sprintf(`
		SELECT h.objetivos_estado::text, count(*) FROM historias h %s AND h.objetivos_estado IS NOT NULL GROUP BY h.objetivos_estado`, whereSQL), args...)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var k string
		var c int
		if err := rows.Scan(&k, &c); err != nil {
			rows.Close()
			return res, err
		}
		res.Objetivos[k] = c
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return res, err
	}

	// por_medico
	rows, err = s.Pool.Query(ctx, fmt.Sprintf(`
		SELECT m.id::text, m.nombre, count(*) AS total,
			count(*) FILTER (WHERE h.estado_revision = 'en_revision') AS en_revision,
			count(*) FILTER (WHERE h.estado_revision = 'requiere_propuesta') AS requiere_propuesta,
			count(*) FILTER (WHERE h.estado_revision = 'completo') AS completo
		FROM historias h
		JOIN medicos m ON m.id = h.medico_id
		%s
		GROUP BY m.id, m.nombre
		ORDER BY m.nombre`, whereSQL), args...)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var pm PorMedico
		if err := rows.Scan(&pm.MedicoID, &pm.Nombre, &pm.Total, &pm.EnRevision, &pm.RequierePropuesta, &pm.Completo); err != nil {
			rows.Close()
			return res, err
		}
		res.PorMedico = append(res.PorMedico, pm)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return res, err
	}

	// intervenciones_por_disciplina
	rows, err = s.Pool.Query(ctx, fmt.Sprintf(`
		SELECT i.disciplina::text, count(*)
		FROM intervenciones i
		JOIN historias h ON h.id = i.historia_id
		%s
		GROUP BY i.disciplina`, whereSQL), args...)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var k string
		var c int
		if err := rows.Scan(&k, &c); err != nil {
			rows.Close()
			return res, err
		}
		res.IntervencionesPorDisciplina[k] = c
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return res, err
	}

	// serie_mensual: default range is the last 6 months (including the
	// current one) when desde/hasta are not provided.
	desde := time.Now().UTC().AddDate(0, -5, 0)
	desde = time.Date(desde.Year(), desde.Month(), 1, 0, 0, 0, 0, time.UTC)
	if f.Desde != nil {
		desde = time.Date(f.Desde.Year(), f.Desde.Month(), 1, 0, 0, 0, 0, time.UTC)
	}
	hasta := time.Now().UTC()
	if f.Hasta != nil {
		hasta = *f.Hasta
	}

	serieArgs := []any{desde, hasta}
	medicoFilter := ""
	if f.MedicoID != "" {
		medicoFilter = " AND h.medico_id = $3"
		serieArgs = append(serieArgs, f.MedicoID)
	}

	rows, err = s.Pool.Query(ctx, fmt.Sprintf(`
		SELECT to_char(mes, 'YYYY-MM') AS mes,
			coalesce((SELECT count(*) FROM historias h WHERE h.deleted_at IS NULL AND date_trunc('month', h.created_at) = mes%s), 0) AS creadas,
			coalesce((SELECT count(*) FROM historias h WHERE h.deleted_at IS NULL AND h.estado_revision = 'completo' AND date_trunc('month', h.updated_at) = mes%s), 0) AS completadas
		FROM generate_series(date_trunc('month', $1::timestamptz), date_trunc('month', $2::timestamptz), interval '1 month') AS mes
		ORDER BY mes`, medicoFilter, medicoFilter), serieArgs...)
	if err != nil {
		return res, err
	}
	for rows.Next() {
		var sm SerieMensual
		if err := rows.Scan(&sm.Mes, &sm.Creadas, &sm.Completadas); err != nil {
			rows.Close()
			return res, err
		}
		res.SerieMensual = append(res.SerieMensual, sm)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return res, err
	}

	return res, nil
}

func joinAnd(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += " AND "
		}
		out += p
	}
	return out
}
