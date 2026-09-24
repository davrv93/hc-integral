// Package store implements the auth-service's Postgres persistence layer
// on top of pgx, matching the schema in migrations/0001_init.sql.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned when a lookup finds no matching row.
var ErrNotFound = errors.New("not found")

// Store wraps a pgx connection pool with the queries the auth-service needs.
type Store struct {
	Pool *pgxpool.Pool
}

// New creates a pool and verifies connectivity.
func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &Store{Pool: pool}, nil
}

// Close releases pool resources.
func (s *Store) Close() {
	s.Pool.Close()
}

// User mirrors the usuarios table.
type User struct {
	ID           string
	Email        string
	Nombre       string
	PasswordHash string
	Rol          string
	Activo       bool
	FailedLogins int
	LockedUntil  *time.Time
}

// GetUserByEmail looks up an active-or-not user by email (case-insensitive,
// citext column).
func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, email, nombre, password_hash, rol, activo, failed_logins, locked_until
		FROM usuarios WHERE email = $1
	`, email)

	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.Nombre, &u.PasswordHash, &u.Rol, &u.Activo, &u.FailedLogins, &u.LockedUntil); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// GetUserByID loads a user by primary key.
func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, email, nombre, password_hash, rol, activo, failed_logins, locked_until
		FROM usuarios WHERE id = $1
	`, id)

	var u User
	if err := row.Scan(&u.ID, &u.Email, &u.Nombre, &u.PasswordHash, &u.Rol, &u.Activo, &u.FailedLogins, &u.LockedUntil); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

// RegisterFailedLogin increments failed_logins and, once it reaches
// maxAttempts, sets locked_until = now() + lockoutDuration and resets the
// counter. Returns the resulting locked_until (nil if not locked).
func (s *Store) RegisterFailedLogin(ctx context.Context, userID string, maxAttempts int, lockoutDuration time.Duration) (*time.Time, error) {
	row := s.Pool.QueryRow(ctx, `
		UPDATE usuarios
		SET failed_logins = failed_logins + 1,
		    updated_at = now()
		WHERE id = $1
		RETURNING failed_logins
	`, userID)

	var failedLogins int
	if err := row.Scan(&failedLogins); err != nil {
		return nil, err
	}

	if failedLogins >= maxAttempts {
		lockedUntil := time.Now().UTC().Add(lockoutDuration)
		_, err := s.Pool.Exec(ctx, `
			UPDATE usuarios SET locked_until = $2, failed_logins = 0, updated_at = now()
			WHERE id = $1
		`, userID, lockedUntil)
		if err != nil {
			return nil, err
		}
		return &lockedUntil, nil
	}
	return nil, nil
}

// ResetFailedLogins clears the failed-login counter and any lock after a
// successful authentication.
func (s *Store) ResetFailedLogins(ctx context.Context, userID string) error {
	_, err := s.Pool.Exec(ctx, `
		UPDATE usuarios SET failed_logins = 0, locked_until = NULL, updated_at = now()
		WHERE id = $1
	`, userID)
	return err
}

// OAuthClient mirrors the oauth_clients table.
type OAuthClient struct {
	ClientID     string
	RedirectURIs []string
	IsPublic     bool
}

// GetClient loads a registered OAuth client.
func (s *Store) GetClient(ctx context.Context, clientID string) (*OAuthClient, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT client_id, redirect_uris, is_public FROM oauth_clients WHERE client_id = $1
	`, clientID)

	var c OAuthClient
	if err := row.Scan(&c.ClientID, &c.RedirectURIs, &c.IsPublic); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// OAuthCode mirrors the oauth_codes table.
type OAuthCode struct {
	Code                string
	ClientID            string
	UsuarioID           string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	ExpiresAt           time.Time
	Used                bool
}

// CreateAuthCode inserts a new authorization code.
func (s *Store) CreateAuthCode(ctx context.Context, c OAuthCode) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO oauth_codes (code, client_id, usuario_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, c.Code, c.ClientID, c.UsuarioID, c.RedirectURI, c.CodeChallenge, c.CodeChallengeMethod, c.ExpiresAt)
	return err
}

// ConsumeAuthCode atomically marks a code as used and returns its row, iff
// it existed and had not been used before. Callers must still check
// expiry themselves (kept here rather than in SQL for a clearer error).
func (s *Store) ConsumeAuthCode(ctx context.Context, code string) (*OAuthCode, error) {
	row := s.Pool.QueryRow(ctx, `
		UPDATE oauth_codes SET used = true
		WHERE code = $1 AND used = false
		RETURNING code, client_id, usuario_id, redirect_uri, code_challenge, code_challenge_method, expires_at, used
	`, code)

	var c OAuthCode
	if err := row.Scan(&c.Code, &c.ClientID, &c.UsuarioID, &c.RedirectURI, &c.CodeChallenge, &c.CodeChallengeMethod, &c.ExpiresAt, &c.Used); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// RefreshToken mirrors the refresh_tokens table.
type RefreshToken struct {
	TokenHash string
	UsuarioID string
	ClientID  string
	FamilyID  string
	Revoked   bool
	ExpiresAt time.Time
}

// CreateRefreshToken inserts a new refresh token row.
func (s *Store) CreateRefreshToken(ctx context.Context, rt RefreshToken) error {
	_, err := s.Pool.Exec(ctx, `
		INSERT INTO refresh_tokens (token_hash, usuario_id, client_id, family_id, revoked, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, rt.TokenHash, rt.UsuarioID, rt.ClientID, rt.FamilyID, rt.Revoked, rt.ExpiresAt)
	return err
}

// GetRefreshTokenByHash loads a refresh token by its hash.
func (s *Store) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT token_hash, usuario_id, client_id, family_id, revoked, expires_at
		FROM refresh_tokens WHERE token_hash = $1
	`, tokenHash)

	var rt RefreshToken
	if err := row.Scan(&rt.TokenHash, &rt.UsuarioID, &rt.ClientID, &rt.FamilyID, &rt.Revoked, &rt.ExpiresAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &rt, nil
}

// RevokeToken marks a single refresh token as revoked.
func (s *Store) RevokeToken(ctx context.Context, tokenHash string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, tokenHash)
	return err
}

// RevokeFamily marks every refresh token in a rotation family as revoked
// (used both for reuse-detection and for logout).
func (s *Store) RevokeFamily(ctx context.Context, familyID string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked = true WHERE family_id = $1`, familyID)
	return err
}

// RotateRefreshToken revokes oldTokenHash and inserts a new refresh token in
// the same family, atomically.
func (s *Store) RotateRefreshToken(ctx context.Context, oldTokenHash string, newToken RefreshToken) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, oldTokenHash); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO refresh_tokens (token_hash, usuario_id, client_id, family_id, revoked, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, newToken.TokenHash, newToken.UsuarioID, newToken.ClientID, newToken.FamilyID, newToken.Revoked, newToken.ExpiresAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
