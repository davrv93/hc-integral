package apiserver

import (
	"net/http"
	"time"

	"hc/api/internal/httpx"
	"hc/api/internal/store"
)

func (s *Server) handleResumen(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.ResumenFilters{MedicoID: q.Get("medico_id")}

	if v := q.Get("desde"); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			httpx.BadRequest(w, "desde must be an ISO 8601 date (YYYY-MM-DD)")
			return
		}
		f.Desde = &t
	}
	if v := q.Get("hasta"); v != "" {
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			httpx.BadRequest(w, "hasta must be an ISO 8601 date (YYYY-MM-DD)")
			return
		}
		// hasta is inclusive of the whole day.
		t = t.AddDate(0, 0, 1)
		f.Hasta = &t
	}

	res, err := s.Store.Resumen(r.Context(), f)
	if err != nil {
		httpx.InternalError(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}
