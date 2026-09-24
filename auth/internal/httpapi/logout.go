package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"hc/auth/internal/store"
)

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// handleLogout revokes the entire refresh-token family associated with the
// given refresh token, effectively signing the user out of every device
// sharing that login session.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	var req logoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.RefreshToken == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "refresh_token is required")
		return
	}

	ctx := r.Context()
	hash := hashToken(req.RefreshToken)

	rt, err := s.store.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// Logging out with an already-invalid token is not an error
			// from the caller's point of view: the end state (no active
			// session for that token) is already true.
			w.WriteHeader(http.StatusNoContent)
			return
		}
		s.log.Error("load refresh token for logout", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	if err := s.store.RevokeFamily(ctx, rt.FamilyID); err != nil {
		s.log.Error("revoke family on logout", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
