# PAHE web — Next.js standalone server on port 3000.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked in at build time. Empty NEXT_PUBLIC_API_URL + API_PROXY_TARGET = single-origin mode (recommended).
ARG NEXT_PUBLIC_API_URL=""
ARG API_PROXY_TARGET="http://api:8080"
ARG NEXT_PUBLIC_ESTATE_NAME="Post Army Housing Estates"
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    API_PROXY_TARGET=$API_PROXY_TARGET \
    NEXT_PUBLIC_ESTATE_NAME=$NEXT_PUBLIC_ESTATE_NAME \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
