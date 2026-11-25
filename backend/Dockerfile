# PAHE API — Laravel on PHP-FPM + Nginx (serversideup/php, listens on 8080, runs as www-data).
# One image serves three roles: web (default), queue worker and scheduler (override the command).

FROM serversideup/php:8.4-fpm-nginx AS base
USER root
RUN install-php-extensions intl bcmath
ENV PHP_OPCACHE_ENABLE=1 \
    NGINX_WEBROOT=/var/www/html/public \
    LOG_CHANNEL=stderr

FROM base AS vendor
WORKDIR /var/www/html
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

FROM base AS app
WORKDIR /var/www/html
COPY --from=vendor /var/www/html/vendor ./vendor
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative \
    && rm -f .env \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/public bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache
COPY --chmod=755 docker/entrypoint.d/ /etc/entrypoint.d/
USER www-data
