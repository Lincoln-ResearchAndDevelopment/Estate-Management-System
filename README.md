# Post Army Housing Estates (PAHE) Management System

Estate management platform for Post Army Housing Estates, Abuja: a public landing page with approved property
listings, and role-based portals for estate management, property agents and residents. One mobile-friendly
website; no native apps.

> **Status:** all SRS modules are built and wired end to end. CI runs the backend and frontend test suites and boots
> the full Docker stack for Playwright end-to-end tests on every push. See [documentation/progress.md](documentation/progress.md)
> for exactly what is verified and the known gaps.

## Test it live

**Fastest:** on GitHub choose **Code → Codespaces → Create codespace** on this branch. The stack builds and opens
by itself (about 6–10 minutes the first time). Sign in with `resident.head@test.pahe.local`,
`super.admin@test.pahe.local`, `security.officer@test.pahe.local` … password `Demo@Pahe2026`.
Full account list and production deployment: [documentation/deployment-guide.md](documentation/deployment-guide.md).

**With Docker anywhere:** `./scripts/setup-env.sh && docker compose up -d --build`, then open http://localhost:3000.

| Folder | Stack |
|---|---|
| [`backend/`](backend) | Laravel 12 REST API, PHP 8.2+, MySQL 8, Sanctum (SPA cookie auth), Laravel Queues & Notifications, OpenAPI via Scramble |
| [`frontend/`](frontend) | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, React Hook Form + Zod, Lucide icons |
| [`documentation/`](documentation) | Architecture, API, database, installation, deployment, progress tracker |
| [`legacy/`](legacy) | The previous merged implementation, kept for reference only. Not built or deployed. |

## Local development without Docker

See [documentation/installation-guide.md](documentation/installation-guide.md) (PHP 8.2+, Composer, MySQL 8, Node 22).

## What is in this release

- **Public site:** landing page and approved property listings with search, enquiries and receipt verification.
- **Residents:** dashboard, household members and vehicles, bills and online/transfer payments with receipts,
  visitor passes with gate codes, away notices, panic button, marketplace orders, notices, meetings, feed, messages.
- **Estate administration:** access requests, households, users, estate directory, listing and agent approvals,
  store approvals, staff, reports with CSV exports, settings, audit log.
- **Finance:** service charges with automatic monthly/quarterly/yearly billing, manual bills, Paystack (or test
  checkout), bank-transfer verification, offline payments, outstanding balances, charts.
- **Security:** live HQ dashboard, alert response workflow with escalation, gate control with blacklist/watchlist
  screening, access logs, incident reports.
- **Agents and store owners:** their own portals for listings/enquiries and store/products/orders.
- **Platform:** 9 roles with permissions enforced on every API route, TOTP two-factor sign-in (mandatory for admins
  and finance in production), in-app + e-mail notifications, rate limits, security headers, audit log.

## Branching

`main` (production, owner merges only) ← `develop` (integration) ← `feature/<module>` branches. See
[legacy/BRANCHING_STRATEGY.md](legacy/BRANCHING_STRATEGY.md); the rules still apply.
