# Development progress

Last updated: 25 Nov 2026 · Branch `rebuild/pahe-v2` · PR #1 → `develop`

## How things are verified

Every push runs three CI jobs (`.github/workflows/ci.yml`):

1. **Backend** — `composer install`, Pint (report only), PHPUnit feature + unit tests.
2. **Frontend** — ESLint, TypeScript type check, Vitest, `next build`.
3. **End-to-end** — builds the Docker images, starts the full stack (MySQL, API, worker, scheduler, web, Mailpit) with
   seeded test data, and drives it with Playwright: every portal is signed into and its main pages opened, plus two
   real flows (resident pays a bill through the test checkout; resident creates a visitor pass and the gate checks the
   visitor in). Screenshots are published to the `ci/e2e-screenshots` branch for review.

At commit `f668d4c` all three jobs pass: 55 backend tests (326 assertions), frontend lint/types/tests/build,
11 E2E tests. Screens were reviewed from the CI screenshots at 1366 px desktop width.

**"Complete" below means:** built, wired to the real API, covered by backend tests, opened in the E2E run with real
data, and screenshots reviewed. It does **not** yet mean client acceptance (UAT) or a check at mobile width.

| Module | Frontend | Backend | Database | API integration | Permissions | Testing | Final review |
|---|---|---|---|---|---|---|---|
| Foundation (auth, RBAC, shell, audit, errors) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M01 Auth & onboarding (incl. MFA/TOTP) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M02 Dashboards (admin, agent, resident, security, store, finance) | Complete | Complete | — | Complete | Complete | Complete | Pending UAT |
| M03 Residents & households (profile, members, vehicles) | Complete | Complete | Complete | Complete | Complete | In Progress (no dedicated household test) | Pending UAT |
| M04 Property & units | Complete | Complete | Complete | Complete | Complete | In Progress | Pending UAT |
| M05 Finance & billing (services, auto-billing, Paystack + test checkout, transfers, receipts) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT; live Paystack not exercised |
| M06 Marketplace (stores, products, orders, approvals) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M07 Communication (notices, meetings, feed, messages) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M08 Security & emergency (panic, alert lifecycle, escalation, incidents) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M09 Access control (passes, gate, logs, away notices) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M10 Blacklist & watchlist | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M11 Staff | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M12 Users & approvals | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M13 Notifications (in-app + e-mail) | Complete | Complete | Complete | Complete | Complete | In Progress | Pending UAT |
| M14 Reports & CSV exports | Complete | Complete | — | Complete | Complete | Complete | Pending UAT |
| M15 Administration (audit log, settings) | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| M16 Listings & landing page | Complete | Complete | Complete | Complete | Complete | Complete | Pending UAT |
| Deployment (Docker, Codespaces, VPS + HTTPS) | — | — | — | — | — | Complete (CI boots the stack) | Pending first real server deploy |

## Known gaps (not built or not verified)

- **Mobile width not checked.** Layouts are responsive (tables become cards below 768 px) but no 390 px screenshots
  have been reviewed yet.
- **SMS and Web Push** notifications are not implemented; notifications are in-app and e-mail.
- **Real-time** features (alerts, messages, gate) use polling every 5–30 s, not WebSockets.
- **Live Paystack** has not been tested; the test checkout and HMAC webhook verification are tested.
- **Store logos and product images**: the API accepts uploads; the store portal screens do not yet offer the upload.
- **Accessibility audit (axe)** not yet run.
- **Logo**: text monogram until an authorised logo is supplied. No official insignia is used.
- Pint style fixes are reported but not yet applied (`vendor/bin/pint` once locally).
