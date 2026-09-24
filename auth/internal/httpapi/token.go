package httpapi

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"hc/auth/internal/store"
)

type tokenRequest struct {
	GrantType    string `json:"grant_type"`
	Code         string `json:"code"`
	RedirectURI  string `json:"redirect_uri"`
	ClientID     string `json:"client_id"`
	CodeVerifier string `json:"code_verifier"`
	RefreshToken string `json:"refresh_token"`
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// s256Challenge computes the PKCE S256 code_challenge for a given
// code_verifier: BASE64URL-ENCODE(SHA256(ASCII(code_verifier))), no padding.
func s256Challenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	var req tokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "malformed JSON body")
		return
	}

	switch req.GrantType {
	case "authorization_code":
		s.handleAuthorizationCodeGrant(w, r, req)
	case "refresh_token":
		s.handleRefreshTokenGrant(w, r, req)
	default:
		writeJSONError(w, http.StatusBadRequest, "unsupported_grant_type", "grant_type must be authorization_code or refresh_token")
	}
}

func (s *Server) handleAuthorizationCodeGrant(w http.ResponseWriter, r *http.Request, req tokenRequest) {
	if req.Code == "" || req.RedirectURI == "" || req.ClientID == "" || req.CodeVerifier == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "code, redirect_uri, client_id and code_verifier are required")
		return
	}

	ctx := r.Context()

	oc, err := s.store.ConsumeAuthCode(ctx, req.Code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSONError(w, http.StatusBadRequest, "invalid_grant", "code is invalid or already used")
			return
		}
		s.log.Error("consume auth code", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	if oc.ClientID != req.ClientID || oc.RedirectURI != req.RedirectURI {
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "client_id or redirect_uri mismatch")
		return
	}

	if time.Now().UTC().After(oc.ExpiresAt) {
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "code has expired")
		return
	}

	// Only S256 is supported/stored, but double-check defensively.
	if oc.CodeChallengeMethod != "S256" {
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "unsupported code_challenge_method")
		return
	}
	expected := s256Challenge(req.CodeVerifier)
	if subtle.ConstantTimeCompare([]byte(expected), []byte(oc.CodeChallenge)) != 1 {
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "PKCE verification failed")
		return
	}

	user, err := s.store.GetUserByID(ctx, oc.UsuarioID)
	if err != nil {
		s.log.Error("load user for code exchange", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	s.issueTokenPair(w, ctx, user, oc.ClientID, uuid.NewString())
}

func (s *Server) handleRefreshTokenGrant(w http.ResponseWriter, r *http.Request, req tokenRequest) {
	if req.RefreshToken == "" || req.ClientID == "" {
		writeJSONError(w, http.StatusBadRequest, "invalid_request", "refresh_token and client_id are required")
		return
	}

	ctx := r.Context()
	hash := hashToken(req.RefreshToken)

	rt, err := s.store.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSONError(w, http.StatusBadRequest, "invalid_grant", "refresh_token is invalid")
			return
		}
		s.log.Error("load refresh token", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	if rt.ClientID != req.ClientID {
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "client_id mismatch")
		return
	}

	if rt.Revoked {
		// Reuse of an already-rotated/revoked refresh token: treat the
		// whole family as compromised and revoke it.
		if err := s.store.RevokeFamily(ctx, rt.FamilyID); err != nil {
			s.log.Error("revoke family on reuse", "error", err)
		}
		s.log.Warn("refresh token reuse detected; family revoked", "family_id", rt.FamilyID, "user_id", rt.UsuarioID)
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "refresh_token has been revoked (reuse detected); session terminated")
		return
	}

	if time.Now().UTC().After(rt.ExpiresAt) {
		writeJSONError(w, http.StatusBadRequest, "invalid_grant", "refresh_token has expired")
		return
	}

	user, err := s.store.GetUserByID(ctx, rt.UsuarioID)
	if err != nil {
		s.log.Error("load user for refresh", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	newPlainToken := randomToken(32)
	newHash := hashToken(newPlainToken)
	err = s.store.RotateRefreshToken(ctx, hash, store.RefreshToken{
		TokenHash: newHash,
		UsuarioID: rt.UsuarioID,
		ClientID:  rt.ClientID,
		FamilyID:  rt.FamilyID,
		Revoked:   false,
		ExpiresAt: time.Now().UTC().Add(time.Duration(s.cfg.RefreshTokenTTLHr) * time.Hour),
	})
	if err != nil {
		s.log.Error("rotate refresh token", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	accessToken, exp, err := s.keys.IssueAccessToken(s.cfg.JWTIssuer, user.ID, user.Email, user.Nombre, user.Rol, time.Duration(s.cfg.AccessTokenTTLMin)*time.Minute)
	if err != nil {
		s.log.Error("issue access token", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newPlainToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(time.Until(exp).Seconds()),
	})
}

// issueTokenPair mints a brand-new access+refresh token pair for a fresh
// login (new family_id), used by the authorization_code grant.
func (s *Server) issueTokenPair(w http.ResponseWriter, ctx context.Context, user *store.User, clientID string, familyID string) {
	accessToken, exp, err := s.keys.IssueAccessToken(s.cfg.JWTIssuer, user.ID, user.Email, user.Nombre, user.Rol, time.Duration(s.cfg.AccessTokenTTLMin)*time.Minute)
	if err != nil {
		s.log.Error("issue access token", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	refreshPlain := randomToken(32)
	err = s.store.CreateRefreshToken(ctx, store.RefreshToken{
		TokenHash: hashToken(refreshPlain),
		UsuarioID: user.ID,
		ClientID:  clientID,
		FamilyID:  familyID,
		Revoked:   false,
		ExpiresAt: time.Now().UTC().Add(time.Duration(s.cfg.RefreshTokenTTLHr) * time.Hour),
	})
	if err != nil {
		s.log.Error("create refresh token", "error", err)
		writeJSONError(w, http.StatusInternalServerError, "server_error", "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshPlain,
		TokenType:    "Bearer",
		ExpiresIn:    int(time.Until(exp).Seconds()),
	})
}
