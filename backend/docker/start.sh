#!/bin/sh
# Production entrypoint for Railway.
#
# Deliberately does NOT: seed the database, run migrate:fresh/refresh, or create users.
# Migrations only run if RUN_MIGRATIONS_ON_START=true (default: false). Prefer Railway's
# "Pre-deploy command" (`php artisan migrate --force`) so a failed migration aborts the
# deploy and the previous release keeps serving. See docs/RAILWAY_DEPLOYMENT.md.
set -eu

: "${PORT:=8080}"
export PORT

cd /var/www

if [ -z "${APP_KEY:-}" ]; then
    echo "FATAL: APP_KEY is not set. Generate one with 'php artisan key:generate --show' and add it as a service variable." >&2
    exit 1
fi

debug_flag="$(printf '%s' "${APP_DEBUG:-false}" | tr '[:upper:]' '[:lower:]')"
if [ "${APP_ENV:-production}" = "production" ] && [ "$debug_flag" = "true" ]; then
    echo "FATAL: APP_DEBUG=true is not allowed when APP_ENV=production." >&2
    exit 1
fi

# Build caches at runtime so they use Railway's real environment variables.
php artisan config:cache
php artisan route:cache
php artisan view:cache

if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
    echo "RUN_MIGRATIONS_ON_START=true -> running 'php artisan migrate --force' (aborts startup on failure)"
    php artisan migrate --force
fi

# Caches were written as root; Apache runs as www-data.
chown -R www-data:www-data storage bootstrap/cache

echo "Starting Apache on 0.0.0.0:${PORT}"
exec apache2-foreground
