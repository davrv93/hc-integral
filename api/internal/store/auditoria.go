package store

import (
	"context"
	"encoding/json"

	"hc/api/internal/model"
)

func (s *Store) InsertAuditoria(ctx context.Context, usuarioID, accion, entidad, entidadID string, antes, despues any, ip string) error {
	var antesJSON, despuesJSON []byte
	var err error
	if antes != nil {
		antesJSON, err = json.Marshal(antes)
		if err != nil {
			return err
		}
	}
	if despues != nil {
		despuesJSON, err = json.Marshal(despues)
		if err != nil {
			return err
		}
	}

	var usuarioIDArg any
	if usuarioID != "" {
		usuarioIDArg = usuarioID
	}

	_, err = s.Pool.Exec(ctx, `
		INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, antes, despues, ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		usuarioIDArg, accion, entidad, entidadID, nullableJSON(antesJSON), nullableJSON(despuesJSON), ip)
	return err
}

func nullableJSON(b []byte) any {
	if b == nil {
		return nil
	}
	return b
}

func (s *Store) ListAuditoria(ctx context.Context, entidad, entidadID string, page, pageSize int) ([]model.Auditoria, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM auditoria WHERE entidad = $1 AND entidad_id = $2`, entidad, entidadID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT id, usuario_id, accion, entidad, entidad_id, antes, despues, ip, ts
		FROM auditoria
		WHERE entidad = $1 AND entidad_id = $2
		ORDER BY ts DESC
		LIMIT $3 OFFSET $4`, entidad, entidadID, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.Auditoria, 0)
	for rows.Next() {
		var a model.Auditoria
		var antes, despues []byte
		if err := rows.Scan(&a.ID, &a.UsuarioID, &a.Accion, &a.Entidad, &a.EntidadID, &antes, &despues, &a.IP, &a.TS); err != nil {
			return nil, 0, err
		}
		a.TS = a.TS.UTC()
		if antes != nil {
			_ = json.Unmarshal(antes, &a.Antes)
		}
		if despues != nil {
			_ = json.Unmarshal(despues, &a.Despues)
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}
