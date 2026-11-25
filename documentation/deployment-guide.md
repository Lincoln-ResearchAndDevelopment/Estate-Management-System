# Deployment guide

## Topology

| Host | Serves |
|---|---|
| `www.<domain>` / `app.<domain>` | Next.js (`next build && next start`, or a Node host such as a container) |
| `api.<domain>` | Laravel behind Nginx + PHP-FPM |
| Worker | `php artisan queue:work --tries=3` under Supervisor/systemd |
| Scheduler | cron: `* * * * * cd /var/www/api && php artisan schedule:run` |
| MySQL 8 | Managed instance with automated daily backups and point-in-time recovery |
| Redis (recommended) | `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis` |

Web and API **must share a parent domain** so Sanctum's session cookie works (`SESSION_DOMAIN=.<domain>`).

## Backend production `.env` essentials

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.<domain>
FRONTEND_URL=https://www.<domain>
SESSION_DOMAIN=.<domain>
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=www.<domain>
CORS_ALLOWED_ORIGINS=https://www.<domain>
QUEUE_CONNECTION=redis
MAIL_MAILER=smtp            # or ses
TURNSTILE_SECRET_KEY=...    # enables CAPTCHA on enquiries
INITIAL_ADMIN_EMAIL=...     # first Super Administrator
```

Secrets come from the host's secret store; never commit `.env`.

## Release steps

```bash
# API
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan db:seed --class=RolePermissionSeeder --force
php artisan db:seed --class=InitialAdminSeeder --force   # first deploy only
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan event:cache
php artisan queue:restart

# Web
npm ci && npm run build && npm start
```

`DemoDataSeeder` never runs in production (`DatabaseSeeder` checks the environment).

## Hardening checklist

- HTTPS everywhere (HSTS is sent by the API on secure requests).
- Restrict `/docs/api` to non-production (Scramble default) or behind auth.
- Private disk (`storage/app/private`) must not be web-served; only `storage/app/public` is linked.
- Nightly database backup + weekly restore test (NFR-BR-01/04).
- Rate limits are per-IP: put the API behind a proxy that forwards the real client IP and configure `TrustProxies`.
- Error monitoring (e.g. Sentry) and log shipping to be added (not yet configured).
