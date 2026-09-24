package httpapi

import (
	"encoding/json"
	"net/http"
)

// writeJSONError writes a small, self-describing JSON error body. The
// auth-service is OAuth2-flavored, so `error` carries an OAuth2-style short
// code (e.g. "invalid_grant") while `message` is a human-readable string
// safe to display to a developer or end user.
func writeJSONError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   code,
		"message": message,
	})
}
