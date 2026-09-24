package apiserver

import (
	"net/http"
	"strconv"

	"hc/api/internal/httpx"
)

func (s *Server) handleAuditoriaReciente(w http.ResponseWriter, r *http.Request) {
	limit := 12
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 50 {
			httpx.BadRequest(w, "limit must be a number between 1 and 50")
			return
		}
		limit = parsed
	}

	rows, err := s.Store.ListAuditoriaReciente(r.Context(), limit)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": rows})
}
