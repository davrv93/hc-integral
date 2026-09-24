# Deploy a producción

Repo: https://github.com/davrv93/hc-integral (privado — pásalo a público
desde Settings → General → Danger Zone → Change visibility si quieres
minutos de GitHub Actions ilimitados; no hay secretos en el historial).

Servidor: `3.130.244.177` (EC2 compartido con otros proyectos), stack
aislado en la red Docker `hc_net`, dominio `syshc.duckdns.org` vía el
nginx de borde del servidor (`app_nginx`), certificado Let's Encrypt ya
emitido.

## Uso normal

```bash
./scripts/deploy.sh          # despliega main
./scripts/deploy.sh mi-rama  # o cualquier otra rama
```

Hace: push a GitHub → SSH al servidor → `git reset --hard` a esa rama →
`docker compose build` + `up -d` (solo recrea contenedores cuya imagen
cambió) → healthcheck contra `https://syshc.duckdns.org/api/v1/health`.

Por defecto usa la llave `~/Downloads/cur4.pem`; para usar otra:
`SSH_KEY=/ruta/a/tu.pem ./scripts/deploy.sh`.

## Setup ya hecho en el servidor (referencia, no repetir)

1. **Deploy key de solo lectura** para que el servidor pueda clonar el
   repo privado sin usar tu token personal:
   ```bash
   ssh -i cur4.pem ubuntu@3.130.244.177 \
     "ssh-keygen -t ed25519 -f ~/.ssh/hc_deploy_key -N '' -C hc-integral-deploy-prod"
   # copiar ~/.ssh/hc_deploy_key.pub y agregarla en:
   # github.com/davrv93/hc-integral → Settings → Deploy keys → Add (solo lectura)
   ```
   Y en el servidor, `~/.ssh/config`:
   ```
   Host github.com
     HostName github.com
     User git
     IdentityFile ~/.ssh/hc_deploy_key
     IdentitiesOnly yes
   ```
2. **`/home/ubuntu/hc`** es un clon git normal (`git remote -v` → origin
   apunta a este repo por SSH).
3. **`.env.prod`** vive solo en el servidor (gitignored, nunca se sube).
   Si falta una variable nueva del `.env.example`, agrégala ahí a mano:
   ```bash
   ssh -i cur4.pem ubuntu@3.130.244.177
   sudoedit /home/ubuntu/hc/.env.prod   # o nano
   ```
4. **nginx de borde**: el bloque de `syshc.duckdns.org` (puertos 80/443,
   proxy a `hc_auth`, `hc_api`, `hc_web` por nombre de contenedor en
   `hc_net`) ya está insertado en `/home/ubuntu/app/nginx/edge.conf` del
   servidor — no vive en este repo porque ese nginx es compartido con
   otros proyectos del mismo servidor.

## Primer arranque en un servidor nuevo (si algún día migras)

```bash
git clone git@github.com:davrv93/hc-integral.git /home/ubuntu/hc
cd /home/ubuntu/hc
cp .env.example .env.prod && nano .env.prod   # completar con valores reales
docker compose --env-file .env.prod -f docker-compose.prod.yml build
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
docker exec hc_auth /app/auth-seed   # usuarios de ejemplo
```

Falta además: apuntar el DNS (DuckDNS o el que uses), obtener el
certificado TLS, y agregar el bloque de nginx del borde para ese dominio.
