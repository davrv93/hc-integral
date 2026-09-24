// Command server is the HC Integral api-service: a REST API in front of
// Postgres, validating JWTs issued by the auth-service. See
// docs/CONTRACT.md section 2 for the full spec.
package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"hc/api/internal/apiserver"
	"hc/api/internal/authn"
	"hc/api/internal/config"
	"hc/api/internal/store"
)

func main() {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer st.Close()

	keys := authn.NewKeySet(cfg.AuthJWKSURL, 10*time.Minute)
	keys.Start()

	auth := authn.NewMiddleware(keys, cfg.JWTIssuer)
	srv := apiserver.New(st, auth)

	httpServer := &http.Server{
		Addr:              ":" + cfg.APIPort,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	log.Printf("api-service listening on :%s (jwks=%s issuer=%s)", cfg.APIPort, cfg.AuthJWKSURL, cfg.JWTIssuer)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
