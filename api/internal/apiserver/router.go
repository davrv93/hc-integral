// Package apiserver wires the chi router, auth middleware, and HTTP
// handlers for every endpoint in CONTRACT.md section 2.
package apiserver

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"hc/api/internal/authn"
	"hc/api/internal/httpx"
	"hc/api/internal/store"
)

type Server struct {
	Store              *store.Store
	Auth               *authn.Middleware
	CORSAllowedOrigins []string
}

func New(st *store.Store, auth *authn.Middleware) *Server {
	return &Server{Store: st, Auth: auth}
}

var disciplinaRoles = map[string]string{
	"medicina":       "medico",
	"psicologia":     "psicologia",
	"terapia_fisica": "terapia_fisica",
	"nutricion":      "nutricion",
}

func (s *Server) requireIntervencionRole(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		disciplina := chi.URLParam(r, "disciplina")
		required, ok := disciplinaRoles[disciplina]
		if !ok {
			httpx.BadRequest(w, "disciplina must be one of medicina, psicologia, terapia_fisica, nutricion")
			return
		}

		rol := authn.Rol(r.Context())
		if rol != "admin" && rol != required {
			httpx.Forbidden(w, "insufficient role for this discipline")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) requireAtencionRole(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Disciplina string `json:"disciplina"`
		}
		var buf bytes.Buffer
		if _, err := buf.ReadFrom(r.Body); err != nil {
			httpx.BadRequest(w, "could not read request body")
			return
		}
		r.Body.Close()
		r.Body = io.NopCloser(bytes.NewReader(buf.Bytes()))
		if err := json.Unmarshal(buf.Bytes(), &body); err != nil {
			httpx.BadRequest(w, "invalid JSON body")
			return
		}
		required, ok := disciplinaRoles[body.Disciplina]
		if !ok {
			httpx.BadRequest(w, "disciplina must be one of medicina, psicologia, terapia_fisica, nutricion")
			return
		}
		rol := authn.Rol(r.Context())
		if rol != "admin" && rol != required {
			httpx.Forbidden(w, "insufficient role for this discipline")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.CORSAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", s.handleHealth)

		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Handler)

			r.Get("/medicos", s.handleListMedicos)

			r.Get("/pacientes", s.handleListPacientes)
			r.Get("/pacientes/by-dni/{dni}", s.handleGetPacienteByDNI)
			r.Get("/pacientes/{id}", s.handleGetPaciente)
			r.With(authn.RequireRoles("admin", "medico")).Post("/pacientes", s.handleCreatePaciente)

			r.Get("/historias", s.handleListHistorias)
			r.Get("/historias/{id}", s.handleGetHistoria)
			r.Get("/historias/{id}/auditoria", s.handleListAuditoria)
			r.Get("/historias/{id}/atenciones", s.handleListAtenciones)
			r.With(authn.RequireRoles("admin", "medico")).Post("/historias", s.handleCreateHistoria)
			r.With(authn.RequireRoles("admin", "medico")).Patch("/historias/{id}", s.handleUpdateHistoria)
			r.With(authn.RequireRoles("admin", "medico")).Delete("/historias/{id}", s.handleDeleteHistoria)
			r.With(s.requireIntervencionRole).Put("/historias/{id}/intervenciones/{disciplina}", s.handleUpsertIntervencion)
			r.With(s.requireAtencionRole).Post("/historias/{id}/atenciones", s.handleCreateAtencion)

			r.Get("/reportes/resumen", s.handleResumen)
		})
	})

	return r
}
