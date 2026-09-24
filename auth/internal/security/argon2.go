// Package security implements password hashing (argon2id), RSA keypair
// management and RS256 JWT issuance for the auth-service.
package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2 parameters mandated by docs/CONTRACT.md section 1:
// time=1, memory=64MB, threads=4, salt 16 bytes random.
const (
	argonTime    uint32 = 1
	argonMemory  uint32 = 64 * 1024 // KiB -> 64MB
	argonThreads uint8  = 4
	argonKeyLen  uint32 = 32
	saltLen             = 16
)

// HashPassword returns a string of the form:
//
//	argon2id$v=19$m=65536,t=1,p=4$<salt_b64>$<hash_b64>
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hash)

	return fmt.Sprintf("argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory, argonTime, argonThreads, encodedSalt, encodedHash), nil
}

// VerifyPassword checks a plaintext password against an encoded hash
// produced by HashPassword, using a constant-time comparison.
func VerifyPassword(encoded, password string) (bool, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 || parts[0] != "argon2id" {
		return false, fmt.Errorf("invalid encoded hash format")
	}

	var version int
	if _, err := fmt.Sscanf(parts[1], "v=%d", &version); err != nil {
		return false, fmt.Errorf("invalid version segment: %w", err)
	}

	var mem uint32
	var t uint32
	var p uint8
	if _, err := fmt.Sscanf(parts[2], "m=%d,t=%d,p=%d", &mem, &t, &p); err != nil {
		return false, fmt.Errorf("invalid params segment: %w", err)
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false, fmt.Errorf("invalid salt encoding: %w", err)
	}
	wantHash, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("invalid hash encoding: %w", err)
	}

	gotHash := argon2.IDKey([]byte(password), salt, t, mem, p, uint32(len(wantHash)))

	if subtle.ConstantTimeCompare(gotHash, wantHash) == 1 {
		return true, nil
	}
	return false, nil
}
