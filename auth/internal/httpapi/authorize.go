package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"time"

	"hc/auth/internal/security"
	"hc/auth/internal/store"
)

type oauthParams struct {
	ClientID            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	State               string
}

// validateOAuthParams reads and validates the Authorization Code + PKCE
// request parameters (works for both the GET query string and the POST
// form body, since http.Request.FormValue reads from either).
func (s *Server) validateOAuthParams(r *http.Request) (oauthParams, *store.OAuthClient, error) {
	p := oauthParams{
		ClientID:            r.FormValue("client_id"),
		RedirectURI:         r.FormValue("redirect_uri"),
		CodeChallenge:       r.FormValue("code_challenge"),
		CodeChallengeMethod: r.FormValue("code_challenge_method"),
		State:               r.FormValue("state"),
	}

	if p.ClientID == "" || p.RedirectURI == "" || p.CodeChallenge == "" {
		return p, nil, fmt.Errorf("client_id, redirect_uri and code_challenge are required")
	}
	if p.CodeChallengeMethod != "S256" {
		return p, nil, fmt.Errorf("code_challenge_method must be S256")
	}

	client, err := s.store.GetClient(r.Context(), p.ClientID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return p, nil, fmt.Errorf("unknown client_id")
		}
		return p, nil, err
	}
	if !slices.Contains(client.RedirectURIs, p.RedirectURI) {
		return p, nil, fmt.Errorf("redirect_uri not registered for this client")
	}

	return p, client, nil
}

func (s *Server) handleAuthorizeGet(w http.ResponseWriter, r *http.Request) {
	if rt := r.URL.Query().Get("response_type"); rt != "" && rt != "code" {
		writeJSONError(w, http.StatusBadRequest, "unsupported_response_type", "only response_type=code is supported")
		return
	}

	params, _, err := s.validateOAuthParams(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	// If there is already a valid session cookie, skip the login form and
	// issue a fresh authorization code immediately.
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		if sess, ok := s.sessions.get(cookie.Value); ok {
			s.issueCodeAndRedirect(w, r, params, sess.UserID)
			return
		}
	}

	renderLogin(w, http.StatusOK, loginPageData{
		ClientID:            params.ClientID,
		RedirectURI:         params.RedirectURI,
		CodeChallenge:       params.CodeChallenge,
		CodeChallengeMethod: params.CodeChallengeMethod,
		State:               params.State,
	})
}

func (s *Server) handleAuthorizePost(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "could not parse form body")
		return
	}

	params, _, err := s.validateOAuthParams(r)
	if err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	email := r.FormValue("email")
	password := r.FormValue("password")

	formData := loginPageData{
		ClientID:            params.ClientID,
		RedirectURI:         params.RedirectURI,
		CodeChallenge:       params.CodeChallenge,
		CodeChallengeMethod: params.CodeChallengeMethod,
		State:               params.State,
		Email:               email,
	}

	ctx := r.Context()
	user, err := s.store.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			formData.Error = "Credenciales inválidas."
			renderLogin(w, http.StatusUnauthorized, formData)
			return
		}
		s.log.Error("get user by email", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	now := time.Now().UTC()
	if user.LockedUntil != nil && user.LockedUntil.After(now) {
		remaining := user.LockedUntil.Sub(now).Round(time.Second)
		writeJSONError(w, http.StatusTooManyRequests, "account_locked",
			fmt.Sprintf("Cuenta bloqueada por demasiados intentos fallidos. Intenta nuevamente en %s.", remaining))
		return
	}

	if !user.Activo {
		formData.Error = "Credenciales inválidas."
		renderLogin(w, http.StatusUnauthorized, formData)
		return
	}

	valid, verr := security.VerifyPassword(user.PasswordHash, password)
	if verr != nil {
		s.log.Warn("password hash could not be verified", "user_id", user.ID, "error", verr)
		valid = false
	}

	if !valid {
		lockedUntil, err := s.store.RegisterFailedLogin(ctx, user.ID, s.cfg.MaxFailedLogins, time.Duration(s.cfg.LockoutMinutes)*time.Minute)
		if err != nil {
			s.log.Error("register failed login", "error", err)
			writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
			return
		}
		if lockedUntil != nil {
			writeJSONError(w, http.StatusTooManyRequests, "account_locked",
				fmt.Sprintf("Cuenta bloqueada por demasiados intentos fallidos. Intenta nuevamente después de %s.", lockedUntil.Format(time.RFC3339)))
			return
		}
		formData.Error = "Credenciales inválidas."
		renderLogin(w, http.StatusUnauthorized, formData)
		return
	}

	if err := s.store.ResetFailedLogins(ctx, user.ID); err != nil {
		s.log.Error("reset failed logins", "error", err)
	}

	sessionID, exp := s.sessions.create(user.ID)
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  exp,
	})

	s.issueCodeAndRedirect(w, r, params, user.ID)
}

// issueCodeAndRedirect creates a fresh, single-use authorization code for
// userID and 302s the browser back to the client's redirect_uri.
func (s *Server) issueCodeAndRedirect(w http.ResponseWriter, r *http.Request, params oauthParams, userID string) {
	code := randomToken(32)

	err := s.store.CreateAuthCode(r.Context(), store.OAuthCode{
		Code:                code,
		ClientID:            params.ClientID,
		UsuarioID:           userID,
		RedirectURI:         params.RedirectURI,
		CodeChallenge:       params.CodeChallenge,
		CodeChallengeMethod: params.CodeChallengeMethod,
		ExpiresAt:           time.Now().UTC().Add(time.Duration(s.cfg.AuthCodeTTLMin) * time.Minute),
	})
	if err != nil {
		s.log.Error("create auth code", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	redirectURL := buildRedirect(params.RedirectURI, code, params.State)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func buildRedirect(base, code, state string) string {
	u, err := url.Parse(base)
	if err != nil {
		return base
	}
	q := u.Query()
	q.Set("code", code)
	if state != "" {
		q.Set("state", state)
	}
	u.RawQuery = q.Encode()
	return u.String()
}
