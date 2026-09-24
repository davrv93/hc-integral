package apiserver

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"hc/api/internal/authn"
	"hc/api/internal/httpx"
	"hc/api/internal/store"
)

type createAtencionRequest struct {
	Disciplina          string  `json:"disciplina"`
	Motivo              string  `json:"motivo"`
	Detalle             string  `json:"detalle"`
	PlanTrabajoEstado   *string `json:"plan_trabajo_estado"`
	ObjetivosEstado     *string `json:"objetivos_estado"`
	Necesidades         *string `json:"necesidades"`
	ObjetivosPropuestos *string `json:"objetivos_propuestos"`
	PlanActual          *string `json:"plan_actual"`
	Observaciones       *string `json:"observaciones"`
}

func (s *Server) handleListAtenciones(w http.ResponseWriter, r *http.Request) {
	historiaID := chi.URLParam(r, "id")
	if _, err := s.Store.GetHistoria(r.Context(), historiaID); err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "historia not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	rows, err := s.Store.ListAtenciones(r.Context(), historiaID)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": rows})
}

func (s *Server) handleCreateAtencion(w http.ResponseWriter, r *http.Request) {
	historiaID := chi.URLParam(r, "id")
	var req createAtencionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}
	req.Disciplina = strings.TrimSpace(req.Disciplina)
	req.Motivo = strings.TrimSpace(req.Motivo)
	req.Detalle = strings.TrimSpace(req.Detalle)
	if !validDisciplinas[req.Disciplina] {
		httpx.BadRequest(w, "disciplina must be one of medicina, psicologia, terapia_fisica, nutricion")
		return
	}
	if req.Motivo == "" || req.Detalle == "" {
		httpx.UnprocessableEntity(w, "motivo and detalle are required")
		return
	}
	if req.PlanTrabajoEstado != nil && !validEvalEstado[*req.PlanTrabajoEstado] {
		httpx.UnprocessableEntity(w, "plan_trabajo_estado must be one of SI, NO, PARCIAL")
		return
	}
	if req.ObjetivosEstado != nil && !validEvalEstado[*req.ObjetivosEstado] {
		httpx.UnprocessableEntity(w, "objetivos_estado must be one of SI, NO, PARCIAL")
		return
	}

	if _, err := s.Store.GetHistoria(r.Context(), historiaID); err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "historia not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}

	usuarioID := authn.UsuarioID(r.Context())
	atencion, err := s.Store.CreateAtencion(r.Context(), store.CreateAtencionInput{
		HistoriaID:          historiaID,
		Disciplina:          req.Disciplina,
		Motivo:              req.Motivo,
		Detalle:             req.Detalle,
		PlanTrabajoEstado:   req.PlanTrabajoEstado,
		ObjetivosEstado:     req.ObjetivosEstado,
		Necesidades:         req.Necesidades,
		ObjetivosPropuestos: req.ObjetivosPropuestos,
		PlanActual:          req.PlanActual,
		Observaciones:       req.Observaciones,
		ResponsableID:       usuarioID,
	})
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "create", "atenciones", atencion.ID, nil, atencion, clientIP(r)); err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, atencion)
}

// handleDeleteAtencion borra una atencion. No hay borrado logico para
// atenciones (son un registro de visita, no la historia clinica en si);
// queda auditado en la tabla auditoria antes de borrarse.
func (s *Server) handleDeleteAtencion(w http.ResponseWriter, r *http.Request) {
	atencionID := chi.URLParam(r, "atencionId")

	atencion, err := s.Store.GetAtencion(r.Context(), atencionID)
	if err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "atencion not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	if atencion.HistoriaID != chi.URLParam(r, "id") {
		httpx.NotFound(w, "atencion not found")
		return
	}

	rol := authn.Rol(r.Context())
	required := disciplinaRoles[atencion.Disciplina]
	if rol != "admin" && rol != required {
		httpx.Forbidden(w, "insufficient role for this discipline")
		return
	}

	usuarioID := authn.UsuarioID(r.Context())
	if err := s.Store.DeleteAtencion(r.Context(), atencionID); err != nil {
		if store.IsNoRows(err) {
			httpx.NotFound(w, "atencion not found")
			return
		}
		httpx.InternalError(w, err)
		return
	}
	if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "delete", "atenciones", atencionID, atencion, nil, clientIP(r)); err != nil {
		httpx.InternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Importacion masiva ---

type importAtencionRow struct {
	DNI                 string  `json:"dni"`
	Disciplina          string  `json:"disciplina"`
	Motivo              string  `json:"motivo"`
	Detalle             string  `json:"detalle"`
	PlanTrabajoEstado   *string `json:"plan_trabajo_estado"`
	ObjetivosEstado     *string `json:"objetivos_estado"`
	Necesidades         *string `json:"necesidades"`
	ObjetivosPropuestos *string `json:"objetivos_propuestos"`
	PlanActual          *string `json:"plan_actual"`
	Observaciones       *string `json:"observaciones"`
}

type importAtencionesRequest struct {
	Rows []importAtencionRow `json:"rows"`
}

type importRowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type importAtencionesResponse struct {
	Imported int              `json:"imported"`
	Errors   []importRowError `json:"errors"`
}

// handleImportAtenciones crea atenciones en lote a partir de un CSV/Excel
// ya parseado a JSON por el frontend. Cada fila se referencia por DNI del
// paciente (se usa su historia activa mas reciente); las filas invalidas o
// sin coincidencia no detienen el resto de la importacion.
func (s *Server) handleImportAtenciones(w http.ResponseWriter, r *http.Request) {
	var req importAtencionesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.BadRequest(w, "invalid JSON body")
		return
	}
	if len(req.Rows) == 0 {
		httpx.UnprocessableEntity(w, "rows must not be empty")
		return
	}
	if len(req.Rows) > 2000 {
		httpx.UnprocessableEntity(w, "at most 2000 rows per import")
		return
	}

	usuarioID := authn.UsuarioID(r.Context())
	rol := authn.Rol(r.Context())
	resp := importAtencionesResponse{Errors: []importRowError{}}

	for i, row := range req.Rows {
		n := i + 1
		dni := strings.TrimSpace(row.DNI)
		disciplina := strings.TrimSpace(row.Disciplina)
		motivo := strings.TrimSpace(row.Motivo)
		detalle := strings.TrimSpace(row.Detalle)

		if dni == "" {
			resp.Errors = append(resp.Errors, importRowError{n, "falta el DNI del paciente"})
			continue
		}
		if !validDisciplinas[disciplina] {
			resp.Errors = append(resp.Errors, importRowError{n, "disciplina invalida: " + disciplina})
			continue
		}
		if rol != "admin" && rol != disciplinaRoles[disciplina] {
			resp.Errors = append(resp.Errors, importRowError{n, "sin permiso para importar en " + disciplina})
			continue
		}
		if motivo == "" || detalle == "" {
			resp.Errors = append(resp.Errors, importRowError{n, "faltan motivo o detalle"})
			continue
		}
		if row.PlanTrabajoEstado != nil && *row.PlanTrabajoEstado != "" && !validEvalEstado[*row.PlanTrabajoEstado] {
			resp.Errors = append(resp.Errors, importRowError{n, "plan_trabajo_estado invalido"})
			continue
		}
		if row.ObjetivosEstado != nil && *row.ObjetivosEstado != "" && !validEvalEstado[*row.ObjetivosEstado] {
			resp.Errors = append(resp.Errors, importRowError{n, "objetivos_estado invalido"})
			continue
		}

		paciente, err := s.Store.GetPacienteByDNI(r.Context(), dni)
		if err != nil {
			if store.IsNoRows(err) {
				resp.Errors = append(resp.Errors, importRowError{n, fmt.Sprintf("no existe paciente con DNI %s", dni)})
				continue
			}
			httpx.InternalError(w, err)
			return
		}
		historia, err := s.Store.GetLatestHistoriaByPaciente(r.Context(), paciente.ID)
		if err != nil {
			if store.IsNoRows(err) {
				resp.Errors = append(resp.Errors, importRowError{n, fmt.Sprintf("el paciente %s no tiene una historia activa", dni)})
				continue
			}
			httpx.InternalError(w, err)
			return
		}

		atencion, err := s.Store.CreateAtencion(r.Context(), store.CreateAtencionInput{
			HistoriaID:          historia.ID,
			Disciplina:          disciplina,
			Motivo:              motivo,
			Detalle:             detalle,
			PlanTrabajoEstado:   emptyToNil(row.PlanTrabajoEstado),
			ObjetivosEstado:     emptyToNil(row.ObjetivosEstado),
			Necesidades:         emptyToNil(row.Necesidades),
			ObjetivosPropuestos: emptyToNil(row.ObjetivosPropuestos),
			PlanActual:          emptyToNil(row.PlanActual),
			Observaciones:       emptyToNil(row.Observaciones),
			ResponsableID:       usuarioID,
		})
		if err != nil {
			resp.Errors = append(resp.Errors, importRowError{n, "error al guardar: " + err.Error()})
			continue
		}
		if err := s.Store.InsertAuditoria(r.Context(), usuarioID, "create", "atenciones", atencion.ID, nil, atencion, clientIP(r)); err != nil {
			httpx.InternalError(w, err)
			return
		}
		resp.Imported++
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}

func emptyToNil(s *string) *string {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return s
}
