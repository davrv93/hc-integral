// Package httpapi wires the auth-service HTTP endpoints described in
// docs/CONTRACT.md section 1 (OAuth2 Authorization Code + PKCE).
package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"hc/auth/internal/config"
	"hc/auth/internal/security"
	"hc/auth/internal/store"
)

// Server bundles the dependencies shared by all HTTP handlers.
type Server struct {
	cfg      *config.Config
	store    *store.Store
	keys     *security.KeyPair
	sessions *sessionStore
	log      *slog.Logger
}

// New builds the chi router with all auth-service routes registered.
func New(cfg *config.Config, st *store.Store, keys *security.KeyPair, log *slog.Logger) http.Handler {
	s := &Server{
		cfg:      cfg,
		store:    st,
		keys:     keys,
		sessions: newSessionStore(),
		log:      log,
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", s.handleHealthz)
	r.Get("/.well-known/jwks.json", s.handleJWKS)
	r.Get("/oauth/authorize", s.handleAuthorizeGet)
	r.Post("/oauth/authorize", s.handleAuthorizePost)
	r.Post("/oauth/token", s.handleToken)
	r.Post("/oauth/logout", s.handleLogout)

	return r
}
