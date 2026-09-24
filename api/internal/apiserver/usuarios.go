package apiserver

import (
	"encoding/json"
	"net/http"
	"strings"

	"hc/api/internal/httpx"
	"hc/api/internal/security"
	"hc/api/internal/store"
)

var validRoles = map[string]bool{
	"admin":          true,
	"medico":         true,
	"psicologia":     true,
	"terapia_fisica": true,
	"nutricion":      true,
	"revisor":        true,
}

type createUsuarioRequest struct {
	Email        string  `json:"email"`
	Nombre       string  `json:"nombre"`
	Password     string  `json:"password"`
	Rol          string  `json:"rol"`
	Titulo       string  `json:"titulo"`
	Especialidad *string `json:"especialidad"`
}

func (s *Server) handleListUsuarios(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Store.ListUsuarios(r.Context())
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": rows})
}

func (s *Server) handleCreateUsuario(w http.ResponseWriter, r *http.Request) {
	var req createUsuarioRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Rol = strings.TrimSpace(req.Rol)
	req.Titulo = strings.TrimSpace(req.Titulo)
	if req.Email == "" || req.Nombre == "" || req.Password == "" || req.Rol == "" {
		httpx.UnprocessableEntity(w, "email, nombre, password and rol are required")
		return
	}
	if len(req.Password) < 8 {
		httpx.UnprocessableEntity(w, "password must have at least 8 characters")
		return
	}
	if !validRoles[req.Rol] {
		httpx.UnprocessableEntity(w, "rol is invalid")
		return
	}

	hash, err := security.HashPassword(req.Password)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	u, err := s.Store.CreateUsuario(r.Context(), store.CreateUsuarioInput{
		Email:        req.Email,
		Nombre:       req.Nombre,
		PasswordHash: hash,
		Rol:          req.Rol,
		Titulo:       req.Titulo,
		Especialidad: req.Especialidad,
	})
	if err != nil {
		if pgErr, ok := store.PgError(err); ok && pgErr.Code == "23505" {
			httpx.Conflict(w, "a user with that email already exists")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, u)
}
