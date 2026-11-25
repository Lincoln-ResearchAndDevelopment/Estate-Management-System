# Deployment guide

The whole system runs from one `docker-compose.yml`: MySQL, the Laravel API, a queue worker, the scheduler,
the Next.js web app and (for testing) Mailpit. The browser only ever talks to the web app; it proxies
`/api`, `/sanctum` and `/storage` to Laravel, so session cookies are first-party on whatever URL serves the app.

No secret is committed. `scripts/setup-env.sh` generates `APP_KEY` and database passwords into a git-ignored `.env`.

## Option 1 — Test it live in GitHub Codespaces (no server needed)

1. On GitHub, open the repository, switch to the branch you want to test (e.g. `rebuild/pahe-v2`).
2. **Code → Codespaces → Create codespace on rebuild/pahe-v2.** Choose a 4-core machine if offered.
3. Wait for the build (first time about 6–10 minutes). The codespace runs `scripts/setup-env.sh` and
   `docker compose up -d --build` automatically, then opens the app on port 3000.
4. If the browser tab does not open, open the **Ports** tab and click the globe icon next to port 3000.
   To let someone else test it, right-click port 3000 → **Port visibility → Public** and share the URL.
5. Test e-mails (invitations, password resets) are caught by Mailpit on port 8025.

Sign in with the seeded **test accounts** (password `Demo@Pahe2026`, or `DEMO_USER_PASSWORD` if you set it):

| Role | Email |
|---|---|
| Super Administrator | `super.admin@test.pahe.local` |
| Estate Manager | `estate.manager@test.pahe.local` |
| Finance Officer | `finance.officer@test.pahe.local` |
| Security Officer | `security.officer@test.pahe.local` |
| Resident (head of household) | `resident.head@test.pahe.local` |
| Resident (household member) | `resident.member@test.pahe.local` |
| Second resident household | `resident.neighbour@test.pahe.local` |
| Store owner | `store.owner@test.pahe.local` |
| Estate staff | `staff@test.pahe.local` |
| Property agent | `agent@test.pahe.local` |

All seeded records are test data: e-mails end in `@test.pahe.local` and names/titles start with `TEST`.
Online payments use a built-in **test checkout** (no money moves) until `PAYSTACK_SECRET_KEY` is set.

Codespaces stop after inactivity; restarting the codespace brings the stack back with its data.

## Option 2 — Any machine with Docker

```bash
git clone https://github.com/Lincoln-ResearchAndDevelopment/Estate-Management-System.git
cd Estate-Management-System
./scripts/setup-env.sh                 # or: ./scripts/setup-env.sh --url http://<server-ip>:3000
docker compose up -d --build
```

Open `http://localhost:3000` (or the URL you passed). Logs: `docker compose logs -f api web`.

## Option 3 — Production on a VPS with HTTPS

Requirements: a Linux server with Docker, a domain whose DNS A record points at the server, ports 80/443 open.

```bash
DOMAIN=estate.example.ng ./scripts/setup-env.sh --production
# edit .env: MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS,
#            PAYSTACK_SECRET_KEY, INITIAL_ADMIN_EMAIL, (optional) TURNSTILE_SECRET_KEY
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production mode sets `APP_ENV=production`, turns off test data and the test checkout, enforces two-factor
sign-in for administrators and finance staff, and puts Caddy in front with automatic Let's Encrypt certificates.
The first Super Administrator receives an invitation e-mail at `INITIAL_ADMIN_EMAIL` to set a password.

Paystack: in the Paystack dashboard set the webhook URL to `https://<domain>/api/v1/webhooks/paystack`.

## What runs where

| Service | Role |
|---|---|
| `db` | MySQL 8.4, data in the `db-data` volume |
| `api` | Laravel on PHP-FPM/Nginx (port 8080, internal). On start: waits for the database, migrates, syncs roles/permissions, seeds test data when `SEED_DEMO_DATA=true` (never in production), caches config/routes |
| `worker` | `queue:work` — e-mail and notification jobs |
| `scheduler` | `schedule:work` — recurring billing and overdue marking (01:00 daily), alert escalation (every minute), visitor-pass expiry (every 15 min), listing expiry (hourly) |
| `web` | Next.js standalone server (port 3000), proxies API calls |
| `mailpit` | Test mailbox (port 8025); disabled by the production overlay |
| `caddy` | HTTPS reverse proxy (production overlay only) |

Uploaded files live in the `storage` volume. Back up `db-data` and `storage` regularly
(`docker compose exec db mysqldump -u root -p pahe_estate > backup.sql`).

## Updating

```bash
git pull
docker compose up -d --build    # migrations run automatically on api start
```

## Split-domain deployments

If the API must live on its own domain (e.g. `api.example.ng`), build the web image with
`NEXT_PUBLIC_API_URL=https://api.example.ng` and no `API_PROXY_TARGET`, set `SESSION_DOMAIN=.example.ng`,
`SANCTUM_STATEFUL_DOMAINS=example.ng` and `CORS_ALLOWED_ORIGINS=https://example.ng` on the API.
