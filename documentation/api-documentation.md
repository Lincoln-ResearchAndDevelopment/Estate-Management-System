# API documentation

Base URL: `{API_URL}/api/v1`. The machine-readable OpenAPI 3.1 document is generated from the code by
[Scramble](https://scramble.dedoc.co): **`/docs/api`** (UI) and **`/docs/api.json`** (spec) in local and staging.

## Conventions

| Topic | Rule |
|---|---|
| Format | JSON, camelCase response fields, snake_case request fields; `multipart/form-data` for uploads |
| Authentication | Sanctum SPA cookies: `GET /sanctum/csrf-cookie`, then `POST /auth/login`; send `X-XSRF-TOKEN` on every mutating request and `credentials: include` |
| Authorisation | `permission:<code>` middleware per route (see `backend/config/rbac.php`); out-of-scope records return 404 |
| Pagination | `?page=1&pageSize=10` (max 100) → `{ data: [...], meta: { page, pageSize, total, totalPages, ... } }` |
| Money | `{ "amount": "2500000.00", "currency": "NGN" }` |
| Dates | ISO-8601 UTC |
| Errors | `application/problem+json`: `{ type, title, status, code, detail, errors: [{ field, message }], traceId }` |
| Rate limits | 100/min per user; login 10/min per IP; public forms 10/hour per IP; enquiries 5/hour per IP |
| Multipart edits | `POST` with `_method=PATCH` |

### Error codes

| HTTP | code | When |
|---|---|---|
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` | Not signed in / wrong email or password |
| 403 | `FORBIDDEN`, `ACCOUNT_PENDING`, `ACCOUNT_BLOCKED`, `ACCOUNT_INACTIVE` | Missing permission or account state |
| 404 | `NOT_FOUND` | Missing or outside your scope |
| 409 | `INVALID_STATE`, `DUPLICATE`, `HTTP_409` | Illegal status transition, duplicate request, stale version |
| 422 | `VALIDATION_FAILED`, `LISTING_INCOMPLETE`, `TOO_MANY_PHOTOS`, `CAPTCHA_FAILED`, … | Field errors or business rules |
| 423 | `ACCOUNT_LOCKED` | 5 failed sign-ins → 15-minute lock |
| 429 | `RATE_LIMITED` | Throttled |

## Endpoints

### Public (no sign-in)

| Method | Path | Purpose |
|---|---|---|
| GET | `/public/estate` | Estate name, property types, amenities, sectors, live counts |
| GET | `/public/listings` | Approved listings. Filters: `type`, `property_type`, `bedrooms` (5 = 5+), `min_price`, `max_price`, `sector_id`, `q`, `sort` (`newest`, `price_asc`, `price_desc`) |
| GET | `/public/listings/featured` | Up to 6 featured approved listings |
| GET | `/public/listings/{slug}` | Listing detail + 3 similar; 404 unless approved and in its publish window |
| POST | `/public/listings/{id}/enquiries` | `name, phone (+234…), email?, message, preferred_viewing_date?, captcha_token?` |
| POST | `/public/listings/{id}/contact-reveal` | Agent phone/email; logged in the audit trail |
| GET | `/public/sitemap-listings.xml` | Sitemap of approved listings |
| GET | `/public/units/lookup?q=` | Registration autocomplete (code + street only) |
| GET | `/public/streets?sector_id=` | Streets for forms |

### Auth

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `email, password, remember` → session (user, permissions, portal) |
| GET | `/auth/session` | Current session |
| POST | `/auth/logout` | End the session |
| POST | `/auth/password/forgot` | Always 200 (no account enumeration); link valid 60 min |
| POST | `/auth/password/reset` | `token, email, password, password_confirmation`; also activates invited accounts |
| POST | `/auth/password/change` | `current_password, password, password_confirmation` |
| POST | `/auth/access-requests` | Resident registration (multipart; SCR-AUTH-02 fields + `profile_photo`, `face_capture`) |
| POST | `/auth/agent-applications` | Become an Agent (multipart; `id_document`, optional `profile_photo`) |

### Notifications (any signed-in user)

`GET /notifications?unread=1`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.

### Estate registry

| Method | Path | Permission |
|---|---|---|
| GET | `/sectors`, `/streets`, `/units` | `estate.view` or `estate.manage` |
| POST | `/sectors`, `/streets`, `/units` | `estate.manage` |
| PATCH | `/units/{id}` | `estate.manage` |

### Agent portal (`listings.manage_own`, own records only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/agent/dashboard` | KPIs, recent admin decisions, latest enquiries |
| GET / PATCH | `/agent/profile` | Agency name, registration number, bio |
| GET | `/agent/listings?status=&q=` | Own listings with status counts |
| POST | `/agent/listings` | Create draft (multipart; optional `owner_authorisation`) |
| GET / PATCH / DELETE | `/agent/listings/{id}` | Detail / edit (live → pending, with field diff) / soft delete |
| POST | `/agent/listings/{id}/submit` | `declaration=true`; needs ≥3 photos and owner authorisation |
| POST | `/agent/listings/{id}/mark-closed`, `/renew` | Rented/sold; extend publish window 90 days |
| GET | `/agent/listings/{id}/history` | Status history with reasons |
| POST / PUT / DELETE | `/agent/listings/{id}/media`, `/media/order`, `/media/{mediaId}` | Upload `photos[]`, reorder (`order[]`, first = cover), delete |
| GET / PATCH | `/agent/enquiries`, `/agent/enquiries/{id}` | Enquiry list; `status`, `agent_note` |

### Administration

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/dashboard` | `dashboard.admin` |
| GET | `/admin/audit-logs?entity=&action=&actor_id=&from=&to=` | `audit.view` |
| GET | `/admin/roles`, `/admin/users`, `/admin/users/{id}` | `users.view` |
| POST / PATCH / DELETE | `/admin/users`, `/admin/users/{id}`; POST `/admin/users/{id}/invite` | `users.manage` |
| POST | `/admin/users/{id}/block`, `/unblock` | `users.block` |
| GET | `/admin/access-requests`, `/{id}`, `/{id}/files/{photo\|face}` | `access_requests.view` |
| POST | `/admin/access-requests/{id}/approve`, `/reject`, `/request-info` (reason 10–500) | `access_requests.decide` |
| GET | `/admin/agents`, `/admin/agents/{id}/id-document` | `agents.view` |
| POST | `/admin/agents/{id}/approve`, `/reject`, `/suspend`, `/reinstate` | `agents.decide` |
| GET | `/admin/listings`, `/options`, `/{id}`, `/{id}/owner-authorisation` | `listings.review` |
| POST | `/admin/listings/{id}/approve` (`version`), `/reject`, `/withdraw` (reason) | `listings.approve` |
| PATCH, POST/DELETE media | `/admin/listings/{id}` (`version` optimistic lock) | `listings.edit_any` |
| DELETE | `/admin/listings/{id}` (reason) | `listings.delete_any` |
| POST | `/admin/listings/{id}/restore` (≤30 days) | `listings.restore` (Super Admin) |
| POST | `/admin/listings/{id}/feature` (`featured`) | `listings.feature` |
