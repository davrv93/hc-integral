// Command seed inserts the two development users described in
// docs/CONTRACT.md section 1 (auth-service), along with their matching
// `medicos` rows. It is idempotent: running it multiple times converges on
// the same end state (upsert by email / by usuario_id) instead of erroring
// out or duplicating rows.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5"

	"hc/auth/internal/config"
	"hc/auth/internal/security"
	"hc/auth/internal/store"
)

type seedUser struct {
	Email    string
	Password string
	Nombre   string
	Rol      string
	Titulo   string // medicos.titulo
}

var seedUsers = []seedUser{
	{Email: "dra.avilez@hc.local", Password: "Clave123!", Nombre: "DRA. AVILEZ", Rol: "admin", Titulo: "DRA."},
	{Email: "dr.abril@hc.local", Password: "Clave123!", Nombre: "DR. ABRIL", Rol: "medico", Titulo: "DR."},
}

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		log.Error("load config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("connect to database", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	for _, su := range seedUsers {
		if err := seedOne(ctx, st, su); err != nil {
			log.Error("seed user", "email", su.Email, "error", err)
			os.Exit(1)
		}
		log.Info("seeded user", "email", su.Email, "rol", su.Rol)
	}

	fmt.Println("seed complete")
}

func seedOne(ctx context.Context, st *store.Store, su seedUser) error {
	hash, err := security.HashPassword(su.Password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	var userID string
	row := st.Pool.QueryRow(ctx, `
		INSERT INTO usuarios (email, nombre, password_hash, rol, activo)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (email) DO UPDATE
		SET nombre = EXCLUDED.nombre,
		    password_hash = EXCLUDED.password_hash,
		    rol = EXCLUDED.rol,
		    activo = true,
		    failed_logins = 0,
		    locked_until = NULL,
		    updated_at = now()
		RETURNING id
	`, su.Email, su.Nombre, hash, su.Rol)
	if err := row.Scan(&userID); err != nil {
		return fmt.Errorf("upsert usuario: %w", err)
	}

	var existingMedicoID string
	err = st.Pool.QueryRow(ctx, `SELECT id FROM medicos WHERE usuario_id = $1`, userID).Scan(&existingMedicoID)
	switch {
	case err == nil:
		// Already has a medicos row; keep nombre/titulo in sync.
		if _, err := st.Pool.Exec(ctx, `
			UPDATE medicos SET nombre = $2, titulo = $3, activo = true WHERE id = $1
		`, existingMedicoID, su.Nombre, su.Titulo); err != nil {
			return fmt.Errorf("update medico: %w", err)
		}
	case errors.Is(err, pgx.ErrNoRows):
		if _, err := st.Pool.Exec(ctx, `
			INSERT INTO medicos (nombre, titulo, activo, usuario_id)
			VALUES ($1, $2, true, $3)
		`, su.Nombre, su.Titulo, userID); err != nil {
			return fmt.Errorf("insert medico: %w", err)
		}
	default:
		return fmt.Errorf("lookup medico: %w", err)
	}

	return nil
}
