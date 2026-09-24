# syntax=docker/dockerfile:1
# Construye el SPA (Vite) y lo sirve con nginx. Sin variables VITE_* en build:
# el cliente usa rutas relativas (mismo origen), y el nginx del borde
# distribuye /oauth, /.well-known y /api/v1 a los servicios Go; todo lo demás
# cae al index.html (enrutado del lado del cliente).
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
