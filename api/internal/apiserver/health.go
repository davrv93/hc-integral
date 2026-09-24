package apiserver

import (
	"net/http"

	"hc/api/internal/httpx"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.Pool.Ping(r.Context()); err != nil {
		httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status": "degraded",
			"db":     "down",
		})
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"db":     "up",
	})
}
