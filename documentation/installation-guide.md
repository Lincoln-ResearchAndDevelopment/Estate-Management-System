# Installation guide (local development)

> **Quickest way to run everything:** Docker — see [deployment-guide.md](deployment-guide.md). This guide covers running the API and web app directly for development.

## Requirements

- PHP 8.2+ with `pdo_mysql`, `mbstring`, `intl`, `gd`, `fileinfo`; Composer 2
- MySQL 8
- Node.js 20 or 22, npm 10
- A mail catcher for local e-mail (optional; default `MAIL_MAILER=log` writes e-mails to `storage/logs`)

## 1. API (`backend/`)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Create the database and user named in `.env` (`DB_DATABASE=pahe_estate`, `DB_USERNAME=pahe`), then:

```bash
php artisan migrate --seed     # roles + clearly marked test data
php artisan storage:link       # serves listing photos from /storage
php artisan serve              # http://localhost:8000
```

In two more terminals:

```bash
php artisan queue:work         # sends e-mails and notifications
php artisan schedule:work      # hourly listing expiry
```

API docs: http://localhost:8000/docs/api

Run the tests (SQLite in memory, no MySQL needed):

```bash
php artisan test
```

## 2. Web (`frontend/`)

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                    # http://localhost:3000
```

Checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 3. Sign in

| Account | Portal |
|---|---|
| `super.admin@test.pahe.local` | Admin (all permissions, can restore deleted listings) |
| `estate.manager@test.pahe.local` | Admin (approvals, users, estate) |
| `agent@test.pahe.local` | Agent portal |
| `resident.head@test.pahe.local` | Resident portal |

Password: the `DEMO_USER_PASSWORD` value (default `Demo@Pahe2026`). These accounts exist only in non-production seeds.

## Cookie / CORS checklist (Sanctum)

If sign-in succeeds but the next request returns 401 or 419:

- `SANCTUM_STATEFUL_DOMAINS` must include the web origin's host and port (`localhost:3000`).
- `SESSION_DOMAIN=localhost` locally; `.your-domain.ng` in production.
- `CORS_ALLOWED_ORIGINS` must list the web origin exactly; `supports_credentials` is already `true`.
- Use `localhost` for both apps (not a mix of `localhost` and `127.0.0.1`).
