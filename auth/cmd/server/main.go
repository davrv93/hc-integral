// Command server runs the hc auth-service: OAuth2 Authorization Code + PKCE
// as specified in docs/CONTRACT.md section 1.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"hc/auth/internal/config"
	"hc/auth/internal/httpapi"
	"hc/auth/internal/security"
	"hc/auth/internal/store"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		log.Error("load config", "error", err)
		os.Exit(1)
	}

	keys, err := security.LoadOrGenerate(cfg.KeysDir)
	if err != nil {
		log.Error("load/generate RSA keypair", "error", err)
		os.Exit(1)
	}
	log.Info("RSA keypair ready", "kid", keys.KID, "dir", cfg.KeysDir)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	st, err := store.New(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Error("connect to database", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	handler := httpapi.New(cfg, st, keys, log)

	srv := &http.Server{
		Addr:              ":" + cfg.AuthPort,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("auth-service listening", "port", cfg.AuthPort)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Info("shutting down")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("graceful shutdown failed", "error", err)
	}
}
