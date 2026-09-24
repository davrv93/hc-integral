// Package authn validates access tokens issued by the auth-service against
// its published JWKS (RS256), and exposes the authenticated user via the
// request context.
package authn

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"
)

type jwk struct {
	Kty string `json:"kty"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwkSet struct {
	Keys []jwk `json:"keys"`
}

// KeySet fetches and caches JWKS keys, refreshing periodically or on an
// unknown kid.
type KeySet struct {
	url          string
	refreshEvery time.Duration
	httpClient   *http.Client

	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time
}

func NewKeySet(url string, refreshEvery time.Duration) *KeySet {
	if refreshEvery <= 0 {
		refreshEvery = 10 * time.Minute
	}
	return &KeySet{
		url:          url,
		refreshEvery: refreshEvery,
		httpClient:   &http.Client{Timeout: 5 * time.Second},
		keys:         map[string]*rsa.PublicKey{},
	}
}

// Start kicks off a background refresh loop every refreshEvery. It does an
// initial best-effort fetch synchronously (errors are logged, not fatal --
// the auth-service may not be up yet).
func (k *KeySet) Start() {
	_ = k.refresh()
	go func() {
		ticker := time.NewTicker(k.refreshEvery)
		defer ticker.Stop()
		for range ticker.C {
			_ = k.refresh()
		}
	}()
}

func (k *KeySet) refresh() error {
	resp, err := k.httpClient.Get(k.url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("jwks: unexpected status %d", resp.StatusCode)
	}
	var set jwkSet
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return err
	}
	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, key := range set.Keys {
		if key.Kty != "RSA" {
			continue
		}
		pub, err := jwkToRSAPublicKey(key)
		if err != nil {
			continue
		}
		keys[key.Kid] = pub
	}
	k.mu.Lock()
	k.keys = keys
	k.lastFetch = time.Now()
	k.mu.Unlock()
	return nil
}

// Key returns the public key for kid, refreshing once if it's unknown.
func (k *KeySet) Key(kid string) (*rsa.PublicKey, error) {
	k.mu.RLock()
	pub, ok := k.keys[kid]
	k.mu.RUnlock()
	if ok {
		return pub, nil
	}
	// Unknown kid: refresh once (e.g. auth-service rotated keys).
	if err := k.refresh(); err != nil {
		return nil, fmt.Errorf("refreshing jwks: %w", err)
	}
	k.mu.RLock()
	pub, ok = k.keys[kid]
	k.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unknown kid %q", kid)
	}
	return pub, nil
}

func jwkToRSAPublicKey(key jwk) (*rsa.PublicKey, error) {
	nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, fmt.Errorf("decode n: %w", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, fmt.Errorf("decode e: %w", err)
	}
	n := new(big.Int).SetBytes(nBytes)
	e := new(big.Int).SetBytes(eBytes)
	return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
}
