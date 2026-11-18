#!/bin/sh
set -e
cd /var/www/html
# Apache must listen on the port the platform provides (Railway/Render set PORT).
if [ -n "$PORT" ]; then
  sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
  sed -i "s/:80>/:${PORT}>/" /etc/apache2/sites-available/000-default.conf
fi
[ -z "$APP_KEY" ] && { echo "APP_KEY is not set (php artisan key:generate --show)"; exit 1; }
php artisan config:clear
php artisan migrate --force
php artisan storage:link 2>/dev/null || true
# Demo users only when explicitly requested (staging). Password comes from SEED_PASSWORD if you set it.
[ "$SEED_DEMO_DATA" = "true" ] && php artisan db:seed --force
exec apache2-foreground
