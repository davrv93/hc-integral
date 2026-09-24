// Package config loads process configuration from the environment,
// optionally from a local .env file for developer convenience.
package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL        string
	APIPort            string
	AuthJWKSURL        string
	JWTIssuer          string
	CORSAllowedOrigins []string
}

func Load() Config {
	// Best-effort local dev convenience; never fails if the file is missing.
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	return Config{
		DatabaseURL:        getenv("DATABASE_URL", "postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable"),
		APIPort:            getenv("API_PORT", "8081"),
		AuthJWKSURL:        getenv("AUTH_JWKS_URL", "http://localhost:8080/.well-known/jwks.json"),
		JWTIssuer:          getenv("JWT_ISSUER", "hc-auth"),
		CORSAllowedOrigins: splitCSV(getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")),
	}
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

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
