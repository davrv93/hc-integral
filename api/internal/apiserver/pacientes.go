package apiserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"hc/api/internal/httpx"
	"hc/api/internal/store"
)

func (s *Server) handleListPacientes(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	page, pageSize := httpx.ParsePaging(r)

	pacientes, total, err := s.Store.ListPacientes(r.Context(), q, page, pageSize)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteList(w, pacientes, page, pageSize, total)
}

type createPacienteRequest struct {
	DNI       string  `json:"dni"`
	Nombres   string  `json:"nombres"`
	Apellidos string  `json:"apellidos"`
	FechaNac  *string `json:"fecha_nac"`
	Sexo      *string `json:"sexo"`
	Telefono  *string `json:"telefono"`
}

func validateCreatePacienteRequest(req createPacienteRequest) error {
	if !validDNI(req.DNI) {
		return errors.New("dni must be exactly 8 digits")
	}
	if req.Nombres == "" || req.Apellidos == "" {
		return errors.New("nombres and apellidos are required")
	}
	if req.FechaNac == nil || strings.TrimSpace(*req.FechaNac) == "" {
		return errors.New("fecha_nac is required")
	}
	if _, err := time.Parse("2006-01-02", *req.FechaNac); err != nil {
		return errors.New("fecha_nac must use YYYY-MM-DD format")
	}
	if req.Sexo == nil || strings.TrimSpace(*req.Sexo) == "" {
		return errors.New("sexo is required")
	}
	return nil
}

func (s *Server) handleCreatePaciente(w http.ResponseWriter, r *http.Request) {
	var req createPacienteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}

	req.DNI = strings.TrimSpace(req.DNI)
	req.Nombres = strings.TrimSpace(req.Nombres)
	req.Apellidos = strings.TrimSpace(req.Apellidos)
	if req.FechaNac != nil {
		fechaNac := strings.TrimSpace(*req.FechaNac)
		req.FechaNac = &fechaNac
	}
	if req.Sexo != nil {
		sexo := strings.TrimSpace(*req.Sexo)
		req.Sexo = &sexo
	}

	if err := validateCreatePacienteRequest(req); err != nil {
		httpx.UnprocessableEntity(w, err.Error())
		return
	}

	p, err := s.Store.CreatePaciente(r.Context(), store.CreatePacienteInput{
		DNI:       req.DNI,
		Nombres:   req.Nombres,
		Apellidos: req.Apellidos,
		FechaNac:  req.FechaNac,
		Sexo:      req.Sexo,
		Telefono:  req.Telefono,
	})
	if err != nil {
		if pgErr, ok := store.PgError(err); ok && pgErr.Code == "23505" {
			httpx.Conflict(w, "a paciente with that dni already exists")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, p)
}

func (s *Server) handleGetPaciente(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := s.Store.GetPaciente(r.Context(), id)
	if err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "paciente not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}

func (s *Server) handleGetPacienteByDNI(w http.ResponseWriter, r *http.Request) {
	dni := chi.URLParam(r, "dni")
	p, err := s.Store.GetPacienteByDNI(r.Context(), dni)
	if err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "paciente not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, p)
}
