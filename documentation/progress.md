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

## Client feedback round 1 (26 Nov 2026) — PR #2

| Change | Status |
|---|---|
| Visitor passes are QR codes (share link, PNG download, public pass page); gate scans with the camera | Complete (E2E: pass created with QR, gate check-in) |
| Resident estate pass (QR) shows Cleared / Not cleared; updates when finance confirms payment; gate sees it on scan | Complete (backend tests cover transfer → approve → cleared) |
| Residents pick months to pay, including up to 12 months ahead; monthly charge from finance shown on dashboard | Complete (E2E: pay a month via test checkout) |
| Finance "Mark paid" (approve as paid) on bills | Complete |
| PANIC button at the foot of the resident sidebar above Sign out | Complete (E2E) |
| Only security officers acknowledge/dispatch/resolve alerts; management and super admin watch read-only | Complete (backend test + E2E) |
| Resident menu exactly as Figma node 295:2443: Dashboard, Finance, Marketplace, Messages, Report, Direction | Complete (E2E asserts the menu) |
| Report page (resident → security incidents) and Direction page (gate pin, directions, street directory, print ID card) | Complete |
| Registration: profile picture optional, face verification photo removed | Complete (backend test) |

Notes:
- Camera scanning needs HTTPS (Codespaces and the production setup both use HTTPS) and a browser camera permission; the 6-character backup code still works everywhere.
- Paystack online payments are confirmed by Paystack itself and count as paid immediately; bank transfers and offline payments wait for finance approval.
- The gate map pin appears once an administrator sets the gate latitude/longitude in Settings.

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
