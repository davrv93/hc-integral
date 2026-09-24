package apiserver

import (
	"net/http"

	"hc/api/internal/httpx"
)

func (s *Server) handleListMedicos(w http.ResponseWriter, r *http.Request) {
	medicos, err := s.Store.ListMedicos(r.Context())
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"data": medicos})
}
