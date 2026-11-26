#!/bin/sh
# Runs on container start (serversideup entrypoint.d). Only the container with RUN_MIGRATIONS=true
# migrates and seeds, so the worker and scheduler never race the web container.
set -e
cd /var/www/html

if [ -z "$APP_KEY" ]; then
  echo "[pahe] APP_KEY is not set. Generate one with: php artisan key:generate --show" >&2
  exit 1
fi

php artisan storage:link --force >/dev/null 2>&1 || true

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[pahe] waiting for the database..."
  i=0
  until php artisan db:show >/dev/null 2>&1; do
    i=$((i+1))
    if [ "$i" -ge 60 ]; then echo "[pahe] database not reachable after 120s" >&2; exit 1; fi
    sleep 2
  done
  php artisan migrate --force
  # Roles and permissions are always kept in sync with config/rbac.php.
  php artisan db:seed --class=RolePermissionSeeder --force
  if [ "$SEED_DEMO_DATA" = "true" ]; then
    if [ "$APP_ENV" = "production" ]; then
      echo "[pahe] refusing to seed test data with APP_ENV=production" >&2
    else
      php artisan db:seed --class=DemoDataSeeder --force
    fi
  fi
  if [ -n "$INITIAL_ADMIN_EMAIL" ]; then
    php artisan db:seed --class=InitialAdminSeeder --force
  fi
fi

php artisan config:cache
php artisan route:cache
php artisan event:cache
