package httpapi

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleJWKS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=600")
	_ = json.NewEncoder(w).Encode(s.keys.JWKS())
}
