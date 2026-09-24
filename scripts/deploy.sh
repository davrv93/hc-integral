#!/usr/bin/env bash
# Deploy de HC Integral a producción.
#
# Uso:
#   ./scripts/deploy.sh              # despliega la rama main actual
#   ./scripts/deploy.sh mi-rama      # despliega otra rama
#
# Qué hace:
#   1. Sube tus commits locales a GitHub (origin).
#   2. Por SSH, en el servidor: git fetch + reset --hard al remoto,
#      reconstruye las imágenes Docker que cambiaron y reinicia los
#      contenedores (docker compose up -d sólo recrea lo que cambió).
#   3. Corre un healthcheck contra https://syshc.duckdns.org.
#
# Requiere: la variable SSH_KEY apuntando a tu llave (o pásala como
# variable de entorno), y que el repo ya esté clonado en el servidor en
# /home/ubuntu/hc con el remoto origin apuntando a este mismo repo (ya
# está así en el servidor actual — ver docs/DEPLOY.md).
set -euo pipefail

BRANCH="${1:-main}"
SSH_KEY="${SSH_KEY:-$HOME/Downloads/cur4.pem}"
SERVER="ubuntu@3.130.244.177"
REMOTE_DIR="/home/ubuntu/hc"
HEALTH_URL="https://syshc.duckdns.org/api/v1/health"

log() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

[ -f "$SSH_KEY" ] || die "no encuentro la llave SSH en $SSH_KEY (pasa SSH_KEY=/ruta/a/tu.pem)"

cd "$(dirname "$0")/.."

log "Verificando estado del repo local..."
if [ -n "$(git status --porcelain)" ]; then
  die "tienes cambios sin commitear. Commitea o descarta antes de desplegar (git status)."
fi

log "Subiendo $BRANCH a GitHub..."
git push origin "$BRANCH"

log "Actualizando código en el servidor ($SERVER:$REMOTE_DIR)..."
ssh -i "$SSH_KEY" "$SERVER" bash -s "$BRANCH" "$REMOTE_DIR" <<'REMOTE_SCRIPT'
set -euo pipefail
BRANCH="$1"
DIR="$2"
cd "$DIR"

echo "-- git fetch + reset --hard origin/$BRANCH --"
git fetch origin "$BRANCH"
# checkout -B falla si hay restos sin trackear en rutas que el commit
# destino ya trackea (p.ej. un despliegue viejo por rsync); reset --hard ya
# alcanza cuando el branch local existe, y no tiene ese problema.
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -B "$BRANCH" "origin/$BRANCH"
fi
git reset --hard "origin/$BRANCH"

echo "-- docker compose build (solo reconstruye lo que cambio) --"
docker compose --env-file .env.prod -f docker-compose.prod.yml build

echo "-- docker compose up -d (recrea solo los contenedores cuya imagen cambio) --"
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

echo "-- estado de los contenedores --"
docker ps --filter "name=hc_" --format "table {{.Names}}\t{{.Status}}"
REMOTE_SCRIPT

log "Esperando a que el stack levante..."
sleep 3

log "Healthcheck: $HEALTH_URL"
if curl -fsS -o /dev/null -w 'status=%{http_code}\n' "$HEALTH_URL"; then
  log "Deploy OK ✅  https://syshc.duckdns.org"
else
  die "el healthcheck falló — revisa los logs: ssh -i $SSH_KEY $SERVER 'docker logs hc_api --tail 50'"
fi
