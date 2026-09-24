# syntax=docker/dockerfile:1

FROM golang:1.27-alpine AS build
WORKDIR /src

# Cache module downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/auth-server ./cmd/server
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/auth-seed ./cmd/seed

FROM alpine:3.20 AS runtime
RUN apk add --no-cache ca-certificates && \
    addgroup -S hc && adduser -S hc -G hc
WORKDIR /app

COPY --from=build /out/auth-server /app/auth-server
COPY --from=build /out/auth-seed /app/auth-seed

# Persisted RSA keypair lives here; mount a volume in production so the key
# survives container recreation.
RUN mkdir -p /app/keys && chown -R hc:hc /app
VOLUME ["/app/keys"]

USER hc
ENV AUTH_PORT=8080
EXPOSE 8080

ENTRYPOINT ["/app/auth-server"]
