// Package config reads the worker's runtime configuration from environment
// variables, as described in docs/CONTRACT.md section 3 and .env.example.
package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all environment-derived settings for the worker.
type Config struct {
	DatabaseURL      string
	SQLiteMirrorPath string
	PollInterval     time.Duration
	HealthPort       string
}

// Load reads configuration from the environment. It first attempts to load
// a `.env` file from a few likely locations (repo root, one level up from
// the working directory) for local development convenience; a missing file
// is not an error.
func Load() Config {
	// Best-effort local dev convenience: load ../.env (repo root when run
	// from worker/) and ./.env, ignoring errors if they don't exist.
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	return Config{
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://hc:hc_dev_password@localhost:5432/hc?sslmode=disable"),
		SQLiteMirrorPath: getEnv("SQLITE_MIRROR_PATH", "./data/mirror.sqlite"),
		PollInterval:     time.Duration(getEnvInt("POLL_INTERVAL_MS", 3000)) * time.Millisecond,
		HealthPort:       getEnv("WORKER_HEALTH_PORT", "8082"),
	}
}

func getEnv(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
