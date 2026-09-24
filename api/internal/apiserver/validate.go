package apiserver

import (
	"net"
	"net/http"
	"regexp"
)

var dniRe = regexp.MustCompile(`^\d{8}$`)

func validDNI(dni string) bool {
	return dniRe.MatchString(dni)
}

var validDisciplinas = map[string]bool{
	"medicina":       true,
	"psicologia":     true,
	"terapia_fisica": true,
	"nutricion":      true,
}

var validEvalEstado = map[string]bool{
	"SI":      true,
	"NO":      true,
	"PARCIAL": true,
}

var validEstadoRevision = map[string]bool{
	"en_revision":        true,
	"requiere_propuesta": true,
	"completo":           true,
}

// clientIP extracts a best-effort client IP for the auditoria.ip column.
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return fwd
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
