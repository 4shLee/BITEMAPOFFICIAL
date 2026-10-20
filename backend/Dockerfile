# syntax=docker/dockerfile:1

# =============================================================================
# Stage "dev"  -  LOCAL DOCKER COMPOSE ONLY (php-fpm, code is bind-mounted).
# Identical to the previous image. docker-compose.yml selects it with
# `target: dev`. It is NOT what Railway builds.
# =============================================================================
FROM php:8.5-fpm AS dev

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    sqlite3 \
    libsqlite3-dev

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

CMD ["php-fpm"]


# =============================================================================
# Stage "production"  -  self-contained image for Railway (LAST stage, so it is
# the default build target). Apache + mod_php serves Laravel directly over HTTP
# on $PORT, bound to 0.0.0.0. No bind mounts, no separate web container.
# =============================================================================
FROM php:8.5-apache AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
        unzip \
        libpng-dev \
        libonig-dev \
        libxml2-dev \
        libzip-dev \
        libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Production php.ini (display_errors off, etc.) + hide PHP version header
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && printf 'expose_php=Off\n' > "$PHP_INI_DIR/conf.d/zz-bitemap.ini"

# Apache: serve /var/www/public, listen on ${PORT} (set at runtime by Railway)
COPY docker/apache-laravel.conf /etc/apache2/conf-available/laravel.conf
RUN a2dismod -f mpm_event mpm_worker \
    && a2enmod mpm_prefork rewrite headers \
    && a2enconf laravel \
    && test "$(ls /etc/apache2/mods-enabled/mpm_*.load | wc -l)" -eq 1 \
    && test -e /etc/apache2/mods-enabled/mpm_prefork.load \
    && sed -ri 's!/var/www/html!/var/www/public!g' /etc/apache2/sites-available/000-default.conf \
    && sed -ri 's/^Listen 80$/Listen ${PORT}/' /etc/apache2/ports.conf \
    && sed -ri 's/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/' /etc/apache2/sites-available/000-default.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1

WORKDIR /var/www

# Dependencies first (layer cache). Production dependencies only.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist --no-progress --optimize-autoloader

# Application source (see .dockerignore for what is excluded)
COPY . .

RUN composer dump-autoload --no-dev --optimize --no-interaction \
    && mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
                storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

COPY docker/start.sh /usr/local/bin/start.sh
# Normalise line endings in case the file was checked out with CRLF on Windows
RUN sed -i 's/\r$//' /usr/local/bin/start.sh && chmod +x /usr/local/bin/start.sh

# Safe defaults; Railway service variables override these.
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    PORT=8080

EXPOSE 8080

CMD ["/usr/local/bin/start.sh"]
