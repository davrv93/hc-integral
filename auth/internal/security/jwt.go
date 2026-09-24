package security

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AccessClaims mirrors the claim set mandated by docs/CONTRACT.md section 1.
type AccessClaims struct {
	Email  string `json:"email"`
	Nombre string `json:"nombre"`
	Rol    string `json:"rol"`
	jwt.RegisteredClaims
}

// IssueAccessToken creates a signed RS256 access token for the given user.
func (kp *KeyPair) IssueAccessToken(issuer, subjectUserID, email, nombre, rol string, ttl time.Duration) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(ttl)

	claims := AccessClaims{
		Email:  email,
		Nombre: nombre,
		Rol:    rol,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Subject:   subjectUserID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = kp.KID

	signed, err := token.SignedString(kp.Private)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}
