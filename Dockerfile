FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite substitutes this public URL into the browser bundle at build time.
# Credentials and private configuration must never be passed as VITE_* values.
ARG VITE_API_URL=/api
ARG VITE_SITE_API_URL=/site-api
ARG VITE_SITE_MEDIA_URL=/site-api
ARG VITE_SITE_PUBLIC_URL=https://hub-net.org
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SITE_API_URL=$VITE_SITE_API_URL
ENV VITE_SITE_MEDIA_URL=$VITE_SITE_MEDIA_URL
ENV VITE_SITE_PUBLIC_URL=$VITE_SITE_PUBLIC_URL
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV NGINX_ENVSUBST_FILTER="^(BACKEND_ORIGIN|SITE_BACKEND_ORIGIN)$"
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
USER root
RUN apk add --no-cache ca-certificates && update-ca-certificates
RUN printf '%s\n' '#!/bin/sh' 'set -eu' ': "${BACKEND_ORIGIN:?BACKEND_ORIGIN must be set to the Back-Hub origin}"' ': "${SITE_BACKEND_ORIGIN:?SITE_BACKEND_ORIGIN must be set to the website content origin}"' 'for origin in "$BACKEND_ORIGIN" "$SITE_BACKEND_ORIGIN"; do printf "%s" "$origin" | grep -Eq "^https?://[A-Za-z0-9.-]+(:[0-9]+)?$" || { echo "Backend origins must be HTTP(S) origins without a path" >&2; exit 1; }; done' > /docker-entrypoint.d/19-require-backend.sh \
    && chmod +x /docker-entrypoint.d/19-require-backend.sh
USER 101
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
