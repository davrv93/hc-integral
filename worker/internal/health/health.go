// Package health exposes the worker's GET /healthz endpoint as specified
// in docs/CONTRACT.md section 3.
package health

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

// Source is implemented by *syncer.Syncer; kept as an interface here so
// this package doesn't need to import syncer and stays independently
// testable.
type Source interface {
	Pendientes(ctx context.Context) (int64, error)
	LastSync() *time.Time
}

type response struct {
	Pendientes           int64   `json:"pendientes"`
	UltimaSincronizacion *string `json:"ultima_sincronizacion"`
}

// NewServer builds an *http.Server exposing GET /healthz on addr (e.g.
// ":8082"). Call ListenAndServe on the result and Shutdown for graceful
// termination.
func NewServer(addr string, src Source) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		pendientes, err := src.Pendientes(ctx)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		var ultima *string
		if t := src.LastSync(); t != nil {
			s := t.Format(time.RFC3339)
			ultima = &s
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response{Pendientes: pendientes, UltimaSincronizacion: ultima})
	})

	return &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}
}
