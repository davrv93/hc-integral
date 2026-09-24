package httpapi

import (
	"html/template"
	"net/http"
)

// loginPageData feeds the server-rendered login form. All OAuth params are
// carried as hidden fields so the POST back to /oauth/authorize can
// complete the Authorization Code + PKCE exchange.
type loginPageData struct {
	ClientID            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	State               string
	Email               string
	Error               string
}

// loginTemplate is a minimal, dependency-free HTML login form styled with
// the palette from docs/design-system.md (primary #0E6E66, bg #F3F6F5).
var loginTemplate = template.Must(template.New("login").Parse(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresar — HC Integral</title>
<style>
  :root {
    --primary: #0E6E66;
    --primary-hover: #0B5952;
    --bg: #F3F6F5;
    --surface: #FFFFFF;
    --border: #DCE4E2;
    --text: #1C2B2E;
    --text-muted: #5A6B6F;
    --danger: #A9392A;
    --danger-soft-bg: #FBE6E2;
    --danger-soft-fg: #9E3322;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    font-family: 'Figtree', system-ui, -apple-system, sans-serif;
    color: var(--text);
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 32px 28px;
    box-shadow: 0 12px 30px rgba(15,40,38,.08);
  }
  h1 {
    font-family: 'Source Serif 4', Georgia, serif;
    font-weight: 600;
    font-size: 22px;
    margin: 0 0 4px;
  }
  p.subtitle {
    margin: 0 0 24px;
    color: var(--text-muted);
    font-size: 14px;
  }
  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text);
  }
  input[type=text], input[type=password] {
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    margin-bottom: 18px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 15px;
    font-family: inherit;
    color: var(--text);
    background: var(--surface);
  }
  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(14,110,102,.15);
  }
  button {
    width: 100%;
    min-height: 44px;
    background: var(--primary);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 150ms ease-out;
  }
  button:hover { background: var(--primary-hover); }
  .error {
    background: var(--danger-soft-bg);
    color: var(--danger-soft-fg);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    margin-bottom: 18px;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>HC Integral</h1>
    <p class="subtitle">Ingresa con tu cuenta para continuar</p>
    {{if .Error}}<div class="error">{{.Error}}</div>{{end}}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="{{.ClientID}}">
      <input type="hidden" name="redirect_uri" value="{{.RedirectURI}}">
      <input type="hidden" name="code_challenge" value="{{.CodeChallenge}}">
      <input type="hidden" name="code_challenge_method" value="{{.CodeChallengeMethod}}">
      <input type="hidden" name="state" value="{{.State}}">
      <label for="email">Usuario</label>
      <input type="text" id="email" name="email" value="{{.Email}}" required autofocus>
      <label for="password">Contraseña</label>
      <input type="password" id="password" name="password" required>
      <button type="submit">Ingresar</button>
    </form>
  </div>
</body>
</html>`))

func renderLogin(w http.ResponseWriter, status int, data loginPageData) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_ = loginTemplate.Execute(w, data)
}
