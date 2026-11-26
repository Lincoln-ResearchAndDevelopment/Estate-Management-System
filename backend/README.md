# PAHE API (Laravel 12)

REST API for the Post Army Housing Estates Management System. See the root [README](../README.md) and
[documentation/](../documentation) for setup, architecture and endpoints.

```bash
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed && php artisan storage:link
php artisan serve        # http://localhost:8000 · docs at /docs/api
php artisan test         # SQLite in-memory test suite
```
