// Command server is the outbox-to-SQLite mirror worker described in
// docs/CONTRACT.md section 3: it polls Postgres' `outbox` table and
// applies pending changes to a local SQLite mirror database, exposing a
// health endpoint reporting sync status.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"hc/worker/internal/config"
	"hc/worker/internal/health"
	"hc/worker/internal/mirror"
	"hc/worker/internal/syncer"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()
	log.Printf("worker: starting (poll_interval=%s sqlite=%s health_port=%s)",
		cfg.PollInterval, cfg.SQLiteMirrorPath, cfg.HealthPort)

	pg, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("worker: connect postgres: %v", err)
	}
	defer pg.Close()

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	if err := pg.Ping(pingCtx); err != nil {
		cancel()
		log.Fatalf("worker: ping postgres: %v", err)
	}
	cancel()

	mdb, err := mirror.Open(cfg.SQLiteMirrorPath)
	if err != nil {
		log.Fatalf("worker: open sqlite mirror: %v", err)
	}
	defer mdb.Close()

	sy := syncer.New(pg, mdb, cfg.PollInterval)

	srv := health.NewServer(":"+cfg.HealthPort, sy)
	go func() {
		log.Printf("worker: healthz listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("worker: health server error: %v", err)
		}
	}()

	// Run the poll loop until the context is cancelled by SIGINT/SIGTERM.
	runDone := make(chan struct{})
	go func() {
		defer close(runDone)
		sy.Run(ctx)
	}()

	<-ctx.Done()
	log.Printf("worker: shutting down")

	<-runDone // stop polling first

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("worker: health server shutdown error: %v", err)
	}

	log.Printf("worker: stopped")
}
