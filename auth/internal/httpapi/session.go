package httpapi

import (
	"crypto/rand"
	"encoding/base64"
	"sync"
	"time"
)

// sessionData is the minimal server-side session record kept in memory so
// that a user who already authenticated in this browser does not need to
// re-enter credentials while their session cookie is valid (per
// CONTRACT.md: "Si no hay sesión, sirve un formulario de login").
//
// This is intentionally process-local and non-persistent: the auth-service
// is a single dev-mode instance and sessions are short-lived (8h).
type sessionData struct {
	UserID    string
	ExpiresAt time.Time
}

const sessionCookieName = "hc_session"
const sessionTTL = 8 * time.Hour

type sessionStore struct {
	mu       sync.Mutex
	sessions map[string]sessionData
}

func newSessionStore() *sessionStore {
	return &sessionStore{sessions: make(map[string]sessionData)}
}

func (s *sessionStore) create(userID string) (string, time.Time) {
	id := randomToken(24)
	exp := time.Now().UTC().Add(sessionTTL)
	s.mu.Lock()
	s.sessions[id] = sessionData{UserID: userID, ExpiresAt: exp}
	s.mu.Unlock()
	return id, exp
}

func (s *sessionStore) get(id string) (sessionData, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, ok := s.sessions[id]
	if !ok {
		return sessionData{}, false
	}
	if time.Now().UTC().After(data.ExpiresAt) {
		delete(s.sessions, id)
		return sessionData{}, false
	}
	return data, true
}

func randomToken(nBytes int) string {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand.Read failing is effectively fatal for a security
		// service; panic surfaces it loudly instead of issuing a weak token.
		panic("security: failed to read random bytes: " + err.Error())
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
