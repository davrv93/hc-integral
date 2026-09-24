// Package config loads auth-service configuration from environment
// variables, optionally pre-populated from a root .env file for local dev.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the auth-service.
type Config struct {
	DatabaseURL        string
	AuthPort           string
	OAuthClientID      string
	OAuthRedirectURI   string
	JWTIssuer          string
	KeysDir            string
	AccessTokenTTLMin  int
	AuthCodeTTLMin     int
	RefreshTokenTTLHr  int
	MaxFailedLogins    int
	LockoutMinutes     int
	CORSAllowedOrigins []string
}

// Load reads configuration from the environment. It first attempts to load
// a `.env` file located one directory above the auth module (repo root),
// which is convenient for local development; missing files are ignored.
func Load() (*Config, error) {
	// Best-effort: load ../.env relative to the working directory of the
	// auth module (repo root .env) for local dev convenience. Never fails
	// if the file is missing.
	if wd, err := os.Getwd(); err == nil {
		candidate := filepath.Join(wd, "..", ".env")
		_ = godotenv.Load(candidate)
	}
	// Also try plain ".env" in case the binary runs from repo root.
	_ = godotenv.Load(".env")

	cfg := &Config{
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable"),
		AuthPort:           getEnv("AUTH_PORT", "8080"),
		OAuthClientID:      getEnv("OAUTH_CLIENT_ID", "hc-web"),
		OAuthRedirectURI:   getEnv("OAUTH_REDIRECT_URI", "http://localhost:5173/callback"),
		JWTIssuer:          getEnv("JWT_ISSUER", "hc-auth"),
		KeysDir:            getEnv("AUTH_KEYS_DIR", "keys"),
		AccessTokenTTLMin:  15,
		AuthCodeTTLMin:     10,
		RefreshTokenTTLHr:  24 * 30, // 30 days
		MaxFailedLogins:    5,
		LockoutMinutes:     15,
		CORSAllowedOrigins: splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func splitCSV(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
