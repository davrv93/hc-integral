// Package config loads process configuration from the environment,
// optionally from a local .env file for developer convenience.
package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	APIPort     string
	AuthJWKSURL string
	JWTIssuer   string
}

func Load() Config {
	// Best-effort local dev convenience; never fails if the file is missing.
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	return Config{
		DatabaseURL: getenv("DATABASE_URL", "postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable"),
		APIPort:     getenv("API_PORT", "8081"),
		AuthJWKSURL: getenv("AUTH_JWKS_URL", "http://localhost:8080/.well-known/jwks.json"),
		JWTIssuer:   getenv("JWT_ISSUER", "hc-auth"),
	}
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
