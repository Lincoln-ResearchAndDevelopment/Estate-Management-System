# Test install on shared Plesk hosting

For a **test** install on a shared Plesk account (no Docker). For the real launch, a small VPS with the
Docker setup is recommended (see `deployment-guide.md`): it is faster, more reliable, and it is the exact
setup the automated tests run against.

**What you need in Plesk:** PHP 8.2 or newer, Node.js 20 or newer, SSH Terminal, Git, Scheduled Tasks,
Databases, SSL/TLS (Let's Encrypt). You do **not** need to build anything on the server: GitHub builds a
ready-to-run package on the `deploy/plesk` branch.

The install uses two subdomains of your existing domain (your current website is not touched):

| Subdomain (example) | Runs | Plesk setting |
|---|---|---|
| `estate.yourdomain.com` | The web app people visit (Next.js) | Node.js app, root `pahe/web`, startup file `server.js` |
| `estate-api.yourdomain.com` | The backend (Laravel API) | PHP site, document root `pahe/api/public` |

> Before step 1, tell the developer the two subdomain names. They are written into `deploy/plesk.json` and
> the package is rebuilt for them (the web app needs to know the API address when it is built).

---

## 1. Create the two subdomains

1. **Websites & Domains → Add Subdomain** → `estate` (or the name you chose). Document root: `pahe/web/public`.
2. **Add Subdomain** again → `estate-api`. Document root: `pahe/api/public`.
3. On **each** subdomain: **SSL/TLS Certificates → Install** a free **Let's Encrypt** certificate, and turn on
   **Permanent SEO-safe 301 redirect from HTTP to HTTPS** in Hosting Settings.

## 2. Get the package with Git

1. On the `estate-api` subdomain open **Git → Add Repository**.
   - Remote repository: `git@github.com:Lincoln-ResearchAndDevelopment/Estate-Management-System.git`
   - If the repository is private, Plesk shows an **SSH public key**: copy it, then on GitHub open the
     repository → **Settings → Deploy keys → Add deploy key**, paste it, leave *write access* unticked.
   - Branch: **`deploy/plesk`**
   - Deployment mode: **Automatic**, Deployment path: **`pahe`** (the folder both subdomains point into).
2. Click **Pull updates** (or **Deploy**). You should now see `pahe/api` and `pahe/web` in **Files**.

## 3. Create the database

**Databases → Add Database**: name it (e.g. `pahe_test`), create a user with a strong password. Note the
database name, user, password and host (usually `localhost`).

## 4. Configure the backend

Open **SSH Terminal** and run (adjust the folder if your subscription's home differs):

```bash
cd ~/pahe/api
cp .env.plesk.example .env
nano .env
```

Replace every `CHANGE_ME` and every `yourdomain.com`: the web address, the database details, your mailbox
(SMTP) details and the server's IP address for `TRUSTED_PROXIES` (Plesk shows it on the subscription's
dashboard). Laravel will not start while a value contains spaces, so keep each value on one line without spaces
(or wrap it in double quotes).
Save with `Ctrl+O`, `Enter`, `Ctrl+X`. Then:

```bash
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --class=RolePermissionSeeder --force
php artisan db:seed --class=DemoDataSeeder --force      # TEST accounts and data (only while APP_ENV=staging)
php artisan storage:link
php artisan config:cache && php artisan route:cache
```

If `php` is an older version in the terminal, use the full path Plesk shows for PHP 8.2, for example
`/opt/plesk/php/8.2/bin/php artisan …`.

On the `estate-api` subdomain open **PHP** (PHP Settings) and pick **8.2 or newer** with FPM.

Check: `https://estate-api.yourdomain.com/up` should show a green "Application up" page.

## 5. Start the web app

On the `estate` subdomain open **Node.js**:

| Setting | Value |
|---|---|
| Node.js version | 20 or newer (22 if offered) |
| Package manager | npm (do **not** click "NPM install"; the package already contains everything) |
| Document root | `/pahe/web/public` |
| Application mode | production |
| Application root | `/pahe/web` |
| Application startup file | `server.js` |
| Custom environment variables | `API_INTERNAL_URL` = `https://estate-api.yourdomain.com`, `HOSTNAME` = `0.0.0.0`, `NODE_ENV` = `production` |

Click **Enable Node.js**, then **Restart App**. Open `https://estate.yourdomain.com`: you should see the
landing page with the TEST listings, and **Sign in** works with e.g. `resident.head@test.pahe.local` /
`Demo@Pahe2026`.

## 6. Scheduled task (billing, alerts, e-mails)

**Scheduled Tasks → Add Task** on the `estate-api` subdomain:

- Task type: **Run a command**
- Command: `cd ~/pahe/api && php artisan schedule:run` (use the PHP 8.2 full path if needed)
- Run: **Cron style** `* * * * *` (every minute)
- Notify: on errors only

This runs monthly billing, overdue marking, panic-alert escalation, visitor-pass expiry and sends queued
e-mails, once a minute. (Panic alerts themselves appear on the security dashboard straight away; only the
e-mail copies and escalations wait for the next minute.)

## Updating

New code merged into `rebuild/pahe-v2` rebuilds the package automatically. With Git deployment mode
**Automatic**, Plesk pulls it when GitHub notifies it (or click **Pull updates**). After an update run:

```bash
cd ~/pahe/api && php artisan migrate --force && php artisan config:cache && php artisan route:cache
```

and **Restart App** on the Node.js page.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Web page shows "Property listings are temporarily unavailable" | `API_INTERNAL_URL` is wrong, or the API subdomain is not on HTTPS yet. Open `https://estate-api…/up`. |
| Sign in returns to the login page | `SANCTUM_STATEFUL_DOMAINS` must be the web host exactly (no `https://`), then `php artisan config:cache`. |
| 500 error on the API | `tail -n 50 ~/pahe/api/storage/logs/laravel-*.log` |
| E-mails never arrive | Check the Scheduled Task runs (its log in Plesk) and the `MAIL_*` settings. |
| Camera does not open on the gate page | It needs HTTPS (Let's Encrypt) and camera permission in the browser. |

Never commit `api/.env`; it stays only on the server.
