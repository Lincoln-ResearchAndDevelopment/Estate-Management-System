# Post Army Housing Estates (PAHE) Management System

Estate management platform for Post Army Housing Estates, Abuja: a public landing page with approved property
listings, and role-based portals for estate management, property agents and residents. One mobile-friendly
website; no native apps.

> **Status: Phase 1 foundation and first modules written; not yet installed, built or run.**
> This code was written in an environment without access to Composer or npm registries, so `composer install`,
> `npm install`, the test suites and `next build` have **not been run**. Expect a first round of fixes when you
> install dependencies. See [documentation/progress.md](documentation/progress.md) for exactly what is done.

| Folder | Stack |
|---|---|
| [`backend/`](backend) | Laravel 12 REST API, PHP 8.2+, MySQL 8, Sanctum (SPA cookie auth), Laravel Queues & Notifications, OpenAPI via Scramble |
| [`frontend/`](frontend) | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form + Zod, Lucide icons |
| [`documentation/`](documentation) | Architecture, API, database, installation, deployment, progress tracker |
| [`legacy/`](legacy) | The previous merged implementation, kept for reference only. Not built or deployed. |

## Quick start (local)

```bash
# API
cd backend
composer install
cp .env.example .env && php artisan key:generate
# create the MySQL database named in .env, then:
php artisan migrate --seed          # seeds roles + clearly marked TEST data (not in production)
php artisan storage:link
php artisan serve                   # http://localhost:8000
php artisan queue:work              # e-mails and notifications (separate terminal)

# Web
cd ../frontend
npm install
cp .env.example .env.local
npm run dev                         # http://localhost:3000
```

Test accounts (local only): `super.admin@test.pahe.local`, `estate.manager@test.pahe.local`, `agent@test.pahe.local`,
`resident.head@test.pahe.local` … password from `DEMO_USER_PASSWORD` (default `Demo@Pahe2026`).

Full instructions: [documentation/installation-guide.md](documentation/installation-guide.md).

## What works in this release

- **Authentication:** sign-in with lockout after 5 failed attempts, forgot/reset password, invitation links (no shared default passwords), change password, sign-out.
- **RBAC:** 9 roles and permissions seeded from SRS §5.3, enforced on every API route; navigation built from the user's permissions.
- **Public landing page (M16):** approved listings only, search/filters/sort in the URL, listing detail with gallery, enquiry form (CAPTCHA-ready), phone reveal (logged), SEO metadata, JSON-LD and sitemap.
- **Agent portal (M16):** dashboard, create/edit/delete listings, photo upload from phone camera, submit for approval, renew, mark rented/sold, enquiries, profile.
- **Listing approvals (M16):** queue, review page with change diff and checklist, approve / reject / withdraw / delete (with reasons), SA restore within 30 days, feature; agent applications and suspension (withdraws live listings).
- **Residents (M12/M04):** public registration with NIN (encrypted) and photos, approval queue, user management, estate directory (sectors, streets, units).
- **Platform:** append-only audit log and viewer, in-app + e-mail notifications, problem+json errors, security headers, rate limits.

Everything else in the SRS (finance, security, access control, communication, marketplace, staff, reports) is **not built yet**.

## Branching

`main` (production, owner merges only) ← `develop` (integration) ← `feature/<module>` branches. See
[legacy/BRANCHING_STRATEGY.md](legacy/BRANCHING_STRATEGY.md); the rules still apply.
