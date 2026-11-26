# Architecture

## Overview

Two independent applications in one repository, talking only through the documented REST API.

```
Browser (desktop & mobile)
   │  HTTPS, cookies (Sanctum SPA session + XSRF-TOKEN)
   ▼
frontend/  Next.js 16 — public landing page (server-rendered, cached 60 s) + Admin / Agent / Resident portals (client)
   │  /api/v1/*  JSON, problem+json errors
   ▼
backend/   Laravel 12 — controllers → form requests → services (business rules, state machines) → Eloquent → MySQL 8
             ├─ Queues (database driver; Redis in production) for e-mail/notifications
             ├─ Scheduler: listings:expire (hourly), prune failed jobs, clear reset tokens
             └─ Storage: public disk (listing photos), local/private disk (IDs, NIN photos, owner documents)
```

## Backend layout

| Path | Responsibility |
|---|---|
| `app/Http/Controllers/Api/V1/{Public,Auth,Agent,Admin,Estate}` | Thin controllers: validate, call a service, return a resource |
| `app/Http/Requests` | Form-request validation (field rules from SRS §7) |
| `app/Services` | Business logic: `Auth\AuthService`, `Users\UserAccountService`, `Users\AccessRequestService`, `Listings\ListingService` (WF-20 state machine), `Listings\AgentService`, `AuditLogger`, `CodeGenerator`, `CaptchaVerifier` |
| `app/Http/Resources` | JSON shapes (camelCase). `ListingResource` has public / owner / admin variants so private fields never reach the public |
| `app/Http/Middleware` | `permission:<code>` (RBAC), `active` (blocked accounts lose their session), security headers |
| `app/Exceptions/ApiExceptionRenderer` | Every error as RFC 7807 problem+json with a `code` |
| `config/rbac.php` | Roles, permissions and the role→permission matrix (single source of truth, seeded by `RolePermissionSeeder`) |
| `config/estate.php` | Estate name, code prefix, listing rules (photo limits, 90-day publish period), upload limits |

**Authorisation is enforced on the server only.** Each protected route has `auth:sanctum`, `active` and an explicit
`permission:` middleware. Row-level scope (an agent's own listings) is enforced by scoping queries to the signed-in
user, so other agents' records return 404 rather than 403 (no existence leak).

## Frontend layout

| Path | Responsibility |
|---|---|
| `src/app/(public)` | Landing page, search, listing detail, become-an-agent, request-access |
| `src/app/(auth)` | Sign in, forgot/reset password |
| `src/app/(portal)` | Authenticated portals; `layout.tsx` guards sign-in and portal access and renders the `AppShell` |
| `src/components/ui` | Reusable design-system components (Button, form controls, DataTable + Pagination, Modal, Confirm/Reason dialogs, Toast, KpiCard, StatusPill, Tabs, states) |
| `src/components/layout` | `AppShell` (collapsible sidebar, mobile drawer, notification bell, user chip) and permission-driven `nav.ts` |
| `src/modules/<module>` | Module API clients, schemas and components (`auth`, `listings`) |
| `src/lib` | API client (CSRF, credentials, errors), server fetch, formatting |
| `src/hooks` | URL-synced list filters, debouncing |

Front-end permission checks only hide navigation and buttons; the API is the authority.

## Design system

Tokens live in `frontend/src/app/globals.css` (`@theme`): Army Deep Green `#18392B` (sidebar, primary), Forest Green
`#254D38` (active nav), Military Olive `#556B2F` (secondary actions), Khaki `#C3B091`, Sand Beige `#E7DCC7`,
Gold `#C6A04A` (selected/important only), Charcoal `#252B28` (text), white content. Red, amber and green are reserved
for semantic states. No camouflage, no oversized insignia; the logo is a text monogram until an authorised logo is supplied.

## Key decisions and deviations

| Decision | Why |
|---|---|
| **MySQL 8 instead of the SRS's PostgreSQL 16** | Required by the master prompt. Module schemas became table names; partial unique indexes are enforced in services; full-text index is MySQL-only (skipped on SQLite tests). |
| **Laravel instead of the SRS's NestJS** | Required by the master prompt. BullMQ → Laravel Queues; Socket.IO → Laravel Reverb when real-time modules (M07/M08) are built. |
| **Sanctum SPA cookie sessions instead of JWT** | httpOnly session cookie + CSRF is safer in the browser than storing tokens. Requires web and API on the same parent domain. |
| **Auto-increment IDs instead of UUID v7** | Simpler with MySQL/Eloquent; human-readable codes (`PAHE-L-2026-0001`, `PAHE-AR-2026-0001`) are separate unique columns. |
| **Own RBAC tables instead of a package** | Small, auditable, matches SRS §5.3 one-to-one. |
| **Validation errors return 422** (SRS says 400) | Laravel convention; the `code` field is still `VALIDATION_FAILED`. |
| **Listing drafts need the core fields** (SRS: title only) | The table's columns are non-null; submission additionally requires ≥3 photos, owner authorisation and the declaration. |
| **Listing photo upload happens after the first save** | Photos are attached to an existing listing; the form saves a draft, then opens the photo step. |
| **Brand** | "Post Army Housing Estates" from the SRS; the Figma placeholder "LincolnEstate" is not used. |
