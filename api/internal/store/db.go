// Package store contains hand-written SQL queries against the Postgres
// schema defined in migrations/0001_init.sql. No ORM/codegen: queries are
// plain SQL for reliability and easy auditing against CONTRACT.md.
package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	// CONTRACT.md requires timestamps serialized with a "Z" (UTC) suffix.
	// Pin every session to UTC so timestamptz values come back with a UTC
	// time.Time location instead of the server's local zone.
	poolCfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET TIME ZONE 'UTC'")
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

func (s *Store) Close() {
	s.Pool.Close()
}

// PgError extracts a *pgconn.PgError from err, if any.
func PgError(err error) (*pgconn.PgError, bool) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr, true
	}
	return nil, false
}

func IsNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}

const (
	pgUniqueViolation     = "23505"
	pgForeignKeyViolation = "23503"
	pgInvalidTextRepr     = "22P02" // invalid input for enum/uuid/etc.
	pgCheckViolation      = "23514"
)
