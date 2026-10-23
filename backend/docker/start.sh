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

# Clear any stale cached manifests first, then build fresh caches at runtime
# so they always reflect the deployed routes/views and Railway's live environment variables.
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
    echo "RUN_MIGRATIONS_ON_START=true -> running 'php artisan migrate --force' (aborts startup on failure)"
    php artisan migrate --force
fi

# Caches were written as root; Apache runs as www-data.
chown -R www-data:www-data storage bootstrap/cache

# mod_php requires exactly one MPM (prefork). Enforce it at runtime, immediately before
# Apache starts, and fail with diagnostics (module/config names only, no secrets) otherwise.
a2dismod -f mpm_event mpm_worker
a2enmod mpm_prefork
mpm_count="$(find /etc/apache2/mods-enabled -maxdepth 1 -name 'mpm_*.load' | wc -l)"
if [ "$mpm_count" -ne 1 ] || [ ! -e /etc/apache2/mods-enabled/mpm_prefork.load ]; then
    echo "FATAL: expected exactly one enabled Apache MPM (mpm_prefork), found ${mpm_count}." >&2
    ls -l /etc/apache2/mods-enabled | grep -i mpm >&2 || true
    grep -rn -i 'LoadModule mpm_' /etc/apache2 >&2 || true
    apache2ctl -M >&2 || true
    exit 1
fi

echo "Starting Apache on 0.0.0.0:${PORT}"
exec apache2-foreground
