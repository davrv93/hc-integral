// Package apiserver wires the chi router, auth middleware, and HTTP
// handlers for every endpoint in CONTRACT.md section 2.
package apiserver

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"hc/api/internal/authn"
	"hc/api/internal/store"
)

type Server struct {
	Store *store.Store
	Auth  *authn.Middleware
}

func New(st *store.Store, auth *authn.Middleware) *Server {
	return &Server{Store: st, Auth: auth}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", s.handleHealth)

		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Handler)

			r.Get("/medicos", s.handleListMedicos)

			r.Get("/pacientes", s.handleListPacientes)
			r.Post("/pacientes", s.handleCreatePaciente)
			r.Get("/pacientes/by-dni/{dni}", s.handleGetPacienteByDNI)
			r.Get("/pacientes/{id}", s.handleGetPaciente)

			r.Get("/historias", s.handleListHistorias)
			r.Post("/historias", s.handleCreateHistoria)
			r.Get("/historias/{id}", s.handleGetHistoria)
			r.Patch("/historias/{id}", s.handleUpdateHistoria)
			r.Delete("/historias/{id}", s.handleDeleteHistoria)
			r.Put("/historias/{id}/intervenciones/{disciplina}", s.handleUpsertIntervencion)
			r.Get("/historias/{id}/auditoria", s.handleListAuditoria)

			r.Get("/reportes/resumen", s.handleResumen)
		})
	})

	return r
}
