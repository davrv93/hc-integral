package authn

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"hc/api/internal/httpx"
)

type ctxKey int

const (
	ctxUsuarioID ctxKey = iota
	ctxRol
)

type claims struct {
	Rol string `json:"rol"`
	jwt.RegisteredClaims
}

// Middleware validates the Authorization header against the JWKS key set and
// the expected issuer, and injects usuario_id/rol into the request context.
type Middleware struct {
	Keys   *KeySet
	Issuer string
}

func NewMiddleware(keys *KeySet, issuer string) *Middleware {
	return &Middleware{Keys: keys, Issuer: issuer}
}

func (m *Middleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			httpx.Unauthorized(w, "missing bearer token")
			return
		}
		raw := strings.TrimPrefix(header, "Bearer ")

		var parsed claims
		token, err := jwt.ParseWithClaims(raw, &parsed, func(t *jwt.Token) (interface{}, error) {
			if t.Method.Alg() != "RS256" {
				return nil, jwt.ErrTokenSignatureInvalid
			}
			kid, _ := t.Header["kid"].(string)
			return m.Keys.Key(kid)
		}, jwt.WithValidMethods([]string{"RS256"}), jwt.WithIssuer(m.Issuer))
		if err != nil || !token.Valid {
			httpx.Unauthorized(w, "invalid or expired token")
			return
		}
		if parsed.Subject == "" {
			httpx.Unauthorized(w, "token missing sub claim")
			return
		}

		ctx := context.WithValue(r.Context(), ctxUsuarioID, parsed.Subject)
		ctx = context.WithValue(ctx, ctxRol, parsed.Rol)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UsuarioID(ctx context.Context) string {
	v, _ := ctx.Value(ctxUsuarioID).(string)
	return v
}

func Rol(ctx context.Context) string {
	v, _ := ctx.Value(ctxRol).(string)
	return v
}

func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rol := Rol(r.Context())
			if _, ok := allowed[rol]; !ok {
				httpx.Forbidden(w, "insufficient role for this operation")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
