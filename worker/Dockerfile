# syntax=docker/dockerfile:1

# ---- build stage ----------------------------------------------------------
FROM golang:1.27-alpine AS build
WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# modernc.org/sqlite is pure Go (no cgo), so we can build a static,
# from-scratch-friendly binary with CGO disabled.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
    -o /out/worker ./cmd/server

# ---- runtime stage ----------------------------------------------------------
FROM alpine:3.20
RUN adduser -D -u 10001 worker \
    && apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/worker /app/worker

# Default mirror path lives under /app/data; mount a volume here to persist
# the SQLite mirror across container restarts.
RUN mkdir -p /app/data && chown -R worker:worker /app
VOLUME ["/app/data"]

USER worker
ENV SQLITE_MIRROR_PATH=/app/data/mirror.sqlite \
    WORKER_HEALTH_PORT=8082 \
    POLL_INTERVAL_MS=3000

EXPOSE 8082

ENTRYPOINT ["/app/worker"]
