# Staging image for the Laravel API (PHP 8.3 + Apache). Not for production use as-is.
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --optimize-autoloader

FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libzip-dev unzip \
    && docker-php-ext-install pdo_mysql bcmath zip \
    && a2enmod rewrite headers \
    && rm -rf /var/lib/apt/lists/*
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
WORKDIR /var/www/html
COPY . .
COPY --from=vendor /app/vendor ./vendor
RUN chown -R www-data:www-data storage bootstrap/cache && chmod +x docker/start.sh
EXPOSE 80
CMD ["docker/start.sh"]
