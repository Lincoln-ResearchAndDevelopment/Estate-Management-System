# Staging deployment (separate from production)

Branch `deploy/staging` adds Dockerfiles and a compose file. It never touches `main`.
**Untested:** these files were written without being able to build them; expect small fixes on first run.

## Option A: one Docker host (VPS, e.g. a $5 droplet)
1. `git clone` the repo, `git checkout deploy/staging`.
2. `cp .env.staging.example .env.staging`, fill in values (APP_KEY from `php artisan key:generate --show`).
3. `docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build`
4. API on :8000, site on :3000. Put Caddy/nginx with HTTPS in front (browsers need https for both).

## Option B: Vercel (front end) + Railway (API + MySQL)
- Vercel: import repo, branch `deploy/staging`, Root Directory `frontend`, env `NEXT_PUBLIC_API_URL=https://<api>/api/v1`.
- Railway: new project from repo, root `backend` (uses `backend/Dockerfile`), add MySQL plugin, set the variables from `docker-compose.staging.yml` (DB_* from the plugin).

## Updating
Push to `deploy/staging` (or merge `develop` into it); Vercel/Railway redeploy automatically. On Docker: `git pull && docker compose ... up -d --build`.

## Safety
Use a separate database, `ESTATE_ENFORCE_AUTH=true`, change the seeded passwords, no live Paystack keys, and restrict access (basic-auth proxy or IP allow-list) while testing.
