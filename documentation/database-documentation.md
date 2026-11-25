# Database documentation

MySQL 8 (utf8mb4). Migrations: `backend/database/migrations`. Tables for modules not yet built are added with those
modules. Money is `DECIMAL(14,2)` in naira; never floating point. Sensitive values (NIN) are encrypted with the
application key and looked up by a keyed hash.

## Tables in this release

### Identity and platform

| Table | Purpose | Notes |
|---|---|---|
| `users` | Every login identity | `status` pending/active/inactive/blocked; `primary_role`; lockout fields `failed_login_count`, `locked_until`; soft deletes |
| `roles`, `permissions`, `permission_role`, `role_user` | RBAC | Seeded from `config/rbac.php` |
| `password_reset_tokens` | Reset and invitation links | 60-minute expiry |
| `sessions` | Sanctum SPA sessions | Deleted when an account is blocked |
| `personal_access_tokens` | API tokens (gate devices later) | — |
| `audit_logs` | Append-only audit trail | Model refuses update/delete; indexes on (entity_type, entity_id, occurred_at) and (actor_user_id, occurred_at) |
| `notifications` | In-app inbox | Laravel database notifications |
| `system_settings` | Key/value settings | For M15 |
| `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs` | Framework | — |

### Estate and residents (M04, M03 core, M12)

| Table | Purpose | Key constraints |
|---|---|---|
| `sectors` | Sectors / blocks | `name`, `code` unique |
| `streets` | Streets per sector | unique (sector_id, name) |
| `units` | Houses / plots | `unit_code` unique; `occupancy_status` occupied/vacant/under_watch |
| `households` | Household per unit | `head_user_id`; access-permission flags for later modules |
| `residents` | People in a household | `user_id` unique (nullable for members without login) |
| `access_requests` | Resident registration requests | `reference` unique; `nin_encrypted` + `nin_hash`; photos on private disk; one open request per email/NIN (enforced in service) |

### Property listings (M16)

| Table | Purpose | Key constraints |
|---|---|---|
| `agent_profiles` | Agent account details | one per user; status pending/approved/rejected/suspended |
| `property_listings` | Listings | `listing_code`, `slug` unique; status enum (8 values); `version` optimistic lock; `published_until`; soft deletes; indexes for public search and agent views; FULLTEXT(title, description) on MySQL |
| `listing_media` | Photos | `is_cover`, `sort_order`; files on the public disk |
| `listing_status_history` | Every status change and edit | `changed_fields` JSON diff; append-only |
| `listing_enquiries` | Public enquiries | IP stored only as a SHA-256 hash |

## Relationships

```
users 1─* role_user *─1 roles 1─* permission_role *─1 permissions
sectors 1─* streets 1─* units 1─* households 1─* residents *─1 users
units 1─* access_requests
users 1─1 agent_profiles
users(agent) 1─* property_listings *─1 sectors / streets / units(optional)
property_listings 1─* listing_media | listing_status_history | listing_enquiries
```

## Seeders

| Seeder | Runs | Content |
|---|---|---|
| `RolePermissionSeeder` | Always (safe to repeat) | Roles, permissions, matrix |
| `DemoDataSeeder` | Non-production only | **Test data**: 3 sectors, 6 streets, 48 units, one account per role (`*@test.pahe.local`), sample listings titled "TEST – …" |
| `InitialAdminSeeder` | Production only | First Super Administrator from `INITIAL_ADMIN_EMAIL`, invited by e-mail |

## Retention (to confirm with legal — SRS Q31)

Audit logs 7 years (financial) / 2 years otherwise; listing enquiries 12 months; deleted listings restorable for 30 days.
Retention jobs are not implemented yet.
