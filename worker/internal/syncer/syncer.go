// Package syncer implements the main outbox -> SQLite mirror poll loop
// described in docs/CONTRACT.md section 3.
package syncer

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"hc/worker/internal/mirror"
)

// Syncer polls the Postgres `outbox` table and applies pending rows to the
// SQLite mirror database.
type Syncer struct {
	pg     *pgxpool.Pool
	mdb    *sql.DB
	period time.Duration

	mu       sync.RWMutex
	lastSync *time.Time // last time a batch with >0 processed rows completed
}

// New creates a Syncer. pg and mdb are owned by the caller and must be
// closed by the caller after the Syncer is stopped.
func New(pg *pgxpool.Pool, mdb *sql.DB, period time.Duration) *Syncer {
	return &Syncer{pg: pg, mdb: mdb, period: period}
}

// LastSync returns the timestamp of the last successful batch that applied
// at least one row, or nil if none has happened yet.
func (s *Syncer) LastSync() *time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.lastSync == nil {
		return nil
	}
	t := *s.lastSync
	return &t
}

// Pendientes returns the current count of unprocessed outbox rows, read
// live from Postgres.
func (s *Syncer) Pendientes(ctx context.Context) (int64, error) {
	var n int64
	err := s.pg.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE procesado = false`).Scan(&n)
	return n, err
}

// Run polls every `period` until ctx is cancelled. It never returns an
// error; per-iteration errors are logged and retried on the next tick.
func (s *Syncer) Run(ctx context.Context) {
	ticker := time.NewTicker(s.period)
	defer ticker.Stop()

	// Run one pass immediately on startup rather than waiting a full period.
	s.tick(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.tick(ctx)
		}
	}
}

func (s *Syncer) tick(ctx context.Context) {
	n, err := s.runOnce(ctx)
	if err != nil {
		log.Printf("syncer: batch failed: %v", err)
		return
	}
	if n > 0 {
		now := time.Now().UTC()
		s.mu.Lock()
		s.lastSync = &now
		s.mu.Unlock()
		log.Printf("syncer: applied %d outbox row(s)", n)
	}
}

type outboxRow struct {
	ID      int64
	Tabla   string
	Op      string
	RowID   string
	Payload []byte
}

const batchSize = 500

// runOnce performs one poll+apply+mark cycle inside a single Postgres
// transaction: it selects the pending batch, applies each row to the
// SQLite mirror, and marks the rows that applied successfully as
// procesado=true in one batch UPDATE, all before committing. Rows whose
// SQLite apply fails are logged and left unprocessed so they're retried on
// the next tick; the rest of the batch is still processed and committed.
func (s *Syncer) runOnce(ctx context.Context) (int, error) {
	tx, err := s.pg.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) // no-op once committed

	rows, err := tx.Query(ctx, `
		SELECT id, tabla, op, row_id, payload
		FROM outbox
		WHERE procesado = false
		ORDER BY id
		LIMIT $1`, batchSize)
	if err != nil {
		return 0, err
	}

	var batch []outboxRow
	for rows.Next() {
		var r outboxRow
		if err := rows.Scan(&r.ID, &r.Tabla, &r.Op, &r.RowID, &r.Payload); err != nil {
			rows.Close()
			return 0, err
		}
		batch = append(batch, r)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, err
	}
	rows.Close()

	if len(batch) == 0 {
		if err := tx.Commit(ctx); err != nil {
			return 0, err
		}
		return 0, nil
	}

	okIDs := make([]int64, 0, len(batch))
	for _, r := range batch {
		if err := mirror.Apply(s.mdb, r.Tabla, r.Op, r.RowID, r.Payload); err != nil {
			log.Printf("syncer: mirror apply failed for outbox id=%d tabla=%s op=%s row_id=%s: %v",
				r.ID, r.Tabla, r.Op, r.RowID, err)
			continue
		}
		okIDs = append(okIDs, r.ID)
	}

	if len(okIDs) > 0 {
		if _, err := tx.Exec(ctx, `UPDATE outbox SET procesado = true WHERE id = ANY($1)`, okIDs); err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return len(okIDs), nil
}
