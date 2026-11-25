# Development progress

Last updated: 25 Nov 2026 · Branch `rebuild/pahe-v2`

**Nothing is marked Complete yet.** The code below was written without access to Composer or npm, so it has not been
installed, built, run or tested. "In Progress" for Testing means the tests are written but have not been run.
A module moves to Complete only after its tests pass and the flow is checked in a browser at 1280 and 390 px.

| Module | Figma analysis | Frontend | Backend | Database | API integration | Permissions | Testing | Final review |
|---|---|---|---|---|---|---|---|---|
| Foundation (auth, RBAC, shell, audit, errors) | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | Pending |
| M16 Listings & landing page | Pending (no Figma frames; built from SRS §7.17) | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | Pending |
| M12 Users & approvals | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | Pending |
| M04 Property & units | In Progress | In Progress (directory only) | In Progress | In Progress | In Progress | In Progress | Pending | Pending |
| M01 Auth & onboarding | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | In Progress | Pending |
| M13 Notifications | In Progress | In Progress (bell + page) | In Progress (in-app + e-mail) | In Progress | In Progress | In Progress | Pending | Pending |
| M02 Dashboards | In Progress | In Progress (admin, agent) | In Progress | — | In Progress | In Progress | Pending | Pending |
| M15 Administration | Pending | In Progress (audit log viewer) | In Progress (audit log) | In Progress | In Progress | In Progress | Pending | Pending |
| M03 Residents & households | Pending | Pending | Pending (tables only) | In Progress | Pending | Pending | Pending | Pending |
| M05 Finance & billing | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M09 Access control | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M10 Blacklist | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M08 Security & emergency | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M07 Communication | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M11 Staff | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M06 Marketplace | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| M14 Reports | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Tests written

Backend (`php artisan test`): `AuthTest` (8), `AuthorizationMatrixTest` (7 roles × 3 endpoints + 3), `ListingWorkflowTest` (11, covering AT-25–AT-30, AT-32 and expiry),
`AccessRequestTest` (5, AT-01), `UserManagementTest` (4), `ListingStatusTest` (unit, 2).

Frontend (`npm test`): formatting and API helpers, StatusPill, Pagination, Button.

Not yet written: Playwright end-to-end tests at 1280/390 px, accessibility (axe) checks.

## Next steps

1. Install dependencies, run both test suites and `next build`; fix what fails.
2. Check every screen in a browser against SRS §7.17 at desktop and mobile widths.
3. MFA (TOTP) for Super Admin, Estate Manager and Finance Officer (FR-AUTH-12) — not implemented.
4. Phase 3 of the roadmap: resident profile, household, vehicles (M03) and resident dashboard.

## Known gaps in this release

- **MFA is not implemented** (FR-AUTH-12). Sign-in lockout and rate limits are.
- **SMS and Web Push channels are not implemented**; notifications are in-app and e-mail.
- **CAPTCHA**: the Turnstile widget and server check are wired, but inactive until keys are set.
- **Estate office contact details** in the site footer are placeholders until the client supplies them.
- **Logo**: text monogram until an authorised logo is supplied.
- On edit, clearing an optional listing field (e.g. size) or all amenities does not clear the stored value.
