package apiserver

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"hc/api/internal/authn"
	"hc/api/internal/httpx"
	"hc/api/internal/store"
)

func (s *Server) handleListHistorias(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, pageSize := httpx.ParsePaging(r)

	f := store.HistoriaFilters{
		Q:                 q.Get("q"),
		MedicoID:          q.Get("medico_id"),
		PlanTrabajoEstado: q.Get("plan_trabajo_estado"),
		ObjetivosEstado:   q.Get("objetivos_estado"),
		EstadoRevision:    q.Get("estado_revision"),
	}
	if f.PlanTrabajoEstado != "" && !validEvalEstado[f.PlanTrabajoEstado] {
		httpx.UnprocessableEntity(w, "plan_trabajo_estado must be one of SI, NO, PARCIAL")
		return
	}
	if f.ObjetivosEstado != "" && !validEvalEstado[f.ObjetivosEstado] {
		httpx.UnprocessableEntity(w, "objetivos_estado must be one of SI, NO, PARCIAL")
		return
	}
	if f.EstadoRevision != "" && !validEstadoRevision[f.EstadoRevision] {
		httpx.UnprocessableEntity(w, "estado_revision must be one of en_revision, requiere_propuesta, completo")
		return
	}

	rows, total, err := s.Store.ListHistorias(r.Context(), f, page, pageSize)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteList(w, rows, page, pageSize, total)
}

type createHistoriaRequest struct {
	PacienteID  string `json:"paciente_id"`
	MedicoID    string `json:"medico_id"`
	Diagnostico string `json:"diagnostico"`
}

func (s *Server) handleCreateHistoria(w http.ResponseWriter, r *http.Request) {
	var req createHistoriaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}
	if req.PacienteID == "" || req.MedicoID == "" || req.Diagnostico == "" {
		httpx.UnprocessableEntity(w, "paciente_id, medico_id and diagnostico are required")
		return
	}

	usuarioID := authn.UsuarioID(r.Context())
	h, err := s.Store.CreateHistoria(r.Context(), store.CreateHistoriaInput{
		PacienteID:  req.PacienteID,
		MedicoID:    req.MedicoID,
		Diagnostico: req.Diagnostico,
		CreatedBy:   usuarioID,
	})
	if err != nil {
		if pgErr, ok := store.PgError(err); ok {
			switch pgErr.Code {
			case "23503":
				httpx.UnprocessableEntity(w, "paciente_id or medico_id does not exist")
				return
			case "22P02":
				httpx.BadRequest(w, "invalid id format")
				return
			}
		}
		httpx.InternalError(w, err)
		return
	}

	if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "create", "historias", h.ID, nil, h, clientIP(r)); err != nil {
		httpx.InternalError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, h)
}

func (s *Server) handleGetHistoria(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	h, err := s.Store.GetHistoria(r.Context(), id)
	if err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "historia not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}

	paciente, err := s.Store.GetPaciente(r.Context(), h.PacienteID)
	if err != nil && !store.IsNoRows(err) {
		httpx.InternalError(w, err)
		return
	}
	if err == nil {
		h.Paciente = &paciente
	}

	medico, err := s.Store.GetMedico(r.Context(), h.MedicoID)
	if err != nil && !store.IsNoRows(err) {
		httpx.InternalError(w, err)
		return
	}
	if err == nil {
		h.Medico = &medico
	}

	intervenciones, err := s.Store.ListIntervenciones(r.Context(), h.ID)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	h.Intervenciones = intervenciones

	httpx.WriteJSON(w, http.StatusOK, h)
}

// patchableHistoriaRequest mirrors the historias columns PATCH may touch.
// Pointer fields distinguish "not provided" (nil) from an explicit null,
// which matters for nullable columns like plan_trabajo_estado.
type patchableHistoriaRequest struct {
	Diagnostico         *string `json:"diagnostico"`
	MedicoID            *string `json:"medico_id"`
	PlanTrabajoEstado   *string `json:"plan_trabajo_estado"`
	ObjetivosEstado     *string `json:"objetivos_estado"`
	Necesidades         *string `json:"necesidades"`
	ObjetivosPropuestos *string `json:"objetivos_propuestos"`
	PlanActual          *string `json:"plan_actual"`
	Plazo               *string `json:"plazo"`
	Observaciones       *string `json:"observaciones"`
	EstadoRevision      *string `json:"estado_revision"`
}

func (s *Server) handleUpdateHistoria(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		httpx.BadRequest(w, "could not read request body")
		return
	}

	// Decode into a raw map first so we only touch fields explicitly present
	// in the body (partial update semantics).
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}

	var req patchableHistoriaRequest
	if err := json.Unmarshal(body, &req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}

	fields := map[string]any{}
	if _, ok := raw["diagnostico"]; ok {
		fields["diagnostico"] = req.Diagnostico
	}
	if _, ok := raw["medico_id"]; ok {
		fields["medico_id"] = req.MedicoID
	}
	if _, ok := raw["plan_trabajo_estado"]; ok {
		if req.PlanTrabajoEstado != nil && !validEvalEstado[*req.PlanTrabajoEstado] {
			httpx.UnprocessableEntity(w, "plan_trabajo_estado must be one of SI, NO, PARCIAL")
			return
		}
		fields["plan_trabajo_estado"] = req.PlanTrabajoEstado
	}
	if _, ok := raw["objetivos_estado"]; ok {
		if req.ObjetivosEstado != nil && !validEvalEstado[*req.ObjetivosEstado] {
			httpx.UnprocessableEntity(w, "objetivos_estado must be one of SI, NO, PARCIAL")
			return
		}
		fields["objetivos_estado"] = req.ObjetivosEstado
	}
	if _, ok := raw["necesidades"]; ok {
		fields["necesidades"] = req.Necesidades
	}
	if _, ok := raw["objetivos_propuestos"]; ok {
		fields["objetivos_propuestos"] = req.ObjetivosPropuestos
	}
	if _, ok := raw["plan_actual"]; ok {
		fields["plan_actual"] = req.PlanActual
	}
	if _, ok := raw["plazo"]; ok {
		fields["plazo"] = req.Plazo
	}
	if _, ok := raw["observaciones"]; ok {
		fields["observaciones"] = req.Observaciones
	}
	if _, ok := raw["estado_revision"]; ok {
		if req.EstadoRevision == nil || !validEstadoRevision[*req.EstadoRevision] {
			httpx.UnprocessableEntity(w, "estado_revision must be one of en_revision, requiere_propuesta, completo")
			return
		}
		fields["estado_revision"] = req.EstadoRevision
	}

	if len(fields) == 0 {
		httpx.BadRequest(w, "no updatable fields provided")
		return
	}

	usuarioID := authn.UsuarioID(r.Context())
	before, after, err := s.Store.UpdateHistoria(r.Context(), id, usuarioID, fields)
	if err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "historia not found")
			return
		}
		if pgErr, ok := store.PgError(err); ok {
			switch pgErr.Code {
			case "23503":
				httpx.UnprocessableEntity(w, "medico_id does not exist")
				return
			case "22P02":
				httpx.BadRequest(w, "invalid id format")
				return
			}
		}
		httpx.InternalError(w, err)
		return
	}

	if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "update", "historias", id, before, after, clientIP(r)); err != nil {
		httpx.InternalError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, after)
}

func (s *Server) handleDeleteHistoria(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	usuarioID := authn.UsuarioID(r.Context())

	before, err := s.Store.SoftDeleteHistoria(r.Context(), id, usuarioID)
	if err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "historia not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}

	if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "delete", "historias", id, before, nil, clientIP(r)); err != nil {
		httpx.InternalError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": id, "deleted": true})
}

type upsertIntervencionRequest struct {
	Detalle string `json:"detalle"`
}

func (s *Server) handleUpsertIntervencion(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	disciplina := chi.URLParam(r, "disciplina")
	if !validDisciplinas[disciplina] {
		httpx.BadRequest(w, "disciplina must be one of medicina, psicologia, terapia_fisica, nutricion")
		return
	}

	var req upsertIntervencionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}

	// Confirm the historia exists (and is not soft-deleted) before writing.
	if _, err := s.Store.GetHistoria(r.Context(), id); err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "historia not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}

	usuarioID := authn.UsuarioID(r.Context())
	iv, err := s.Store.UpsertIntervencion(r.Context(), id, disciplina, req.Detalle, usuarioID)
	if err != nil {
		if pgErr, ok := store.PgError(err); ok && pgErr.Code == "23503" {
			httpx.NotFound(w, "historia not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}

	if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "update", "intervenciones", iv.ID, nil, iv, clientIP(r)); err != nil {
		httpx.InternalError(w, err)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, iv)
}

func (s *Server) handleListAuditoria(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	page, pageSize := httpx.ParsePaging(r)

	rows, total, err := s.Store.ListAuditoria(r.Context(), "historias", id, page, pageSize)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteList(w, rows, page, pageSize, total)
}
