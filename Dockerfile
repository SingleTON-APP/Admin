FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite substitutes this public URL into the browser bundle at build time.
# Credentials and private configuration must never be passed as VITE_* values.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV NGINX_ENVSUBST_FILTER="^BACKEND_ORIGIN$"
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
USER root
RUN printf '%s\n' '#!/bin/sh' 'set -eu' ': "${BACKEND_ORIGIN:?BACKEND_ORIGIN must be set to the Back-Hub origin}"' 'printf "%s" "$BACKEND_ORIGIN" | grep -Eq "^https?://[A-Za-z0-9.-]+(:[0-9]+)?$" || { echo "BACKEND_ORIGIN must be an HTTP(S) origin without a path" >&2; exit 1; }' > /docker-entrypoint.d/19-require-backend.sh \
    && chmod +x /docker-entrypoint.d/19-require-backend.sh
USER 101
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
