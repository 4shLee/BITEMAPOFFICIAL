# BITEMAP backend — Railway deployment guide

Backend: Laravel 13 (`backend/`), MySQL/MariaDB-compatible database, Vercel frontend.
**Test with dummy/fictional data first. This system is designed for confidential patient records.**

## Architecture

| Railway service | Source | Notes |
| --- | --- | --- |
| `bitemap-api` | GitHub repo, **Root Directory `backend`** | Builds `backend/Dockerfile` (final `production` stage). Health check `/up` (set by `backend/railway.json`). |
| `MySQL` | Railway MySQL database | Persistent volume is attached by Railway; data survives redeploys. |
| `bitemap-scheduler` *(optional)* | same repo/root dir | Start command `php artisan schedule:work`. Needed only for the daily missed-schedule marking and SMS reminder jobs. |

No queue worker is required: nothing in the code base dispatches queued jobs.

Local development is unchanged: `docker-compose.yml` builds the `dev` stage (php-fpm + bind mount + nginx).

## Environment variables (`bitemap-api`)

Never commit values. Use Railway's variables UI (mark secrets as sealed where available).

```
APP_NAME=BITEMAP
APP_ENV=production
APP_KEY=                      # php artisan key:generate --show  (generate a NEW one; never reuse a dev key)
APP_DEBUG=false               # container refuses to start if true in production
APP_URL=https://<api-domain>.up.railway.app
APP_TIMEZONE=Asia/Manila      # choose before any real data exists; changing later shifts stored timestamps
TRUSTED_PROXIES=*             # real client IP in audit logs / rate limits behind Railway's proxy

LOG_CHANNEL=stderr            # also the image default; logs appear in Railway
LOG_LEVEL=info

CORS_ALLOWED_ORIGINS=https://<your-app>.vercel.app          # exact origins, comma-separated, no trailing slash
# CORS_ALLOWED_ORIGIN_PATTERNS=#^https://<project>-[a-z0-9-]+\.vercel\.app$#   # optional: Vercel previews

DB_CONNECTION=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_DATABASE=${{MySQL.MYSQLDATABASE}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

# SMS stays OFF until deliberately enabled
SMS_SERVICE_ENABLED=false
SMS_PROVIDER=Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
BITEMAP_FACILITY_NAME="Animal Bite Treatment Center"
```

The reference names `${{MySQL.…}}` assume the database service is called `MySQL`; adjust to your service name.

Frontend (Vercel, done by you, not by this repo): `VITE_API_BASE_URL=https://<api-domain>.up.railway.app/api`, then redeploy (Vite bakes it at build time).

## Startup behaviour (`backend/docker/start.sh`)

On every start: validate `APP_KEY` and `APP_DEBUG`, build config/route/view caches from the live environment, fix permissions, start Apache on `0.0.0.0:$PORT`.
It **never seeds** and **never runs `migrate:fresh` / `migrate:refresh` / `db:wipe`**.

### Migrations

Default: **not** run at startup. Recommended: Railway service → Settings → **Pre-deploy Command**:

```
php artisan migrate --force
```

A failed pre-deploy command aborts the deployment and the previous release keeps serving. MySQL DDL is not transactional, so a migration that fails midway can leave a half-applied schema: take a database backup before deploys that include new migrations, and review them first (one existing migration, `2026_07_14_000001_repair_stale_pep_schedule_dates`, rewrites `pep_schedules.scheduled_date` data).

Opt-in alternative: set `RUN_MIGRATIONS_ON_START=true`; a failing migration then stops the container instead of serving a half-migrated schema (Railway will retry/restart).

`php artisan migrate --force` only applies migrations not yet recorded in the `migrations` table; existing rows are not deleted.

## First-time initialisation (once, per database)

Use the Railway CLI (`railway link`, then `railway run …` with the service/db variables) or a one-off shell:

```bash
# 1. Required reference data (barangays + default settings). Insert-only; safe to re-run;
#    creates NO users, NO passwords, NO inventory. SMS reminders seeded as disabled.
php artisan db:seed --class=ProductionReferenceSeeder --force

# 2. First administrator, with your own strong password (hidden prompt + confirmation).
php artisan bitemap:create-admin you@yourdomain.example --name="Your Name"
```

Password rules: ≥ 12 chars with upper, lower, digit, symbol; not a project default; must not contain the e-mail name. The command refuses to touch an existing account and never prints the password.
Non-interactive alternative: set `BITEMAP_ADMIN_PASSWORD` for that single command, then delete it.

Then sign in from the Vercel frontend and create the clinic's other users through the normal sign-up + approval flow. Enter real inventory through the app (nothing is pre-filled in production).

### What is blocked in production

* `UserSeeder`, `InventorySeeder`, `SettingSeeder` throw outside `local`/`testing` (they use hardcoded passwords / placeholder stock / overwrite via `updateOrCreate`).
* `DatabaseSeeder` outside `local`/`testing` runs only `ProductionReferenceSeeder`.
* `DemoDataSeeder` / `DemoUserSeeder` were already restricted to local Docker.
* `bitemap:reset-admin` (hardcoded password) refuses to run.
* `GET /api/dev/status` returns an opaque `404` outside `local`/`testing`, without running any query.
* Twilio credentials saved through the Settings screen (plaintext in the DB) are rejected with 403 and ignored unless `SMS_ALLOW_DB_CREDENTIALS=true`; use the `TWILIO_*` variables.

## Verification checklist (dummy data only)

1. `GET https://<api>/up` → 200.
2. `GET https://<api>/api/barangays` → JSON list of Digos barangays.
3. `GET https://<api>/api/dev/status` → 404.
4. Browser at the Vercel URL: sign in as the admin you created; no CORS errors in the console.
5. Create a fictional patient + incident; confirm PEP schedule is generated; audit log shows your real IP (not a Railway-internal one).
6. Reminders: confirm they are recorded as `Pending` (simulation mode) while `SMS_SERVICE_ENABLED=false`.
7. Only after approval: set `SMS_SERVICE_ENABLED=true` with `TWILIO_*` and send to a **verified** test number (Twilio trial accounts can only message verified numbers).

## Costs to verify

Railway (Trial credit vs. Hobby plan, usage-based compute/volume/egress), Twilio (per-SMS charges, upgraded vs. trial account), Vercel (existing). Check current pricing pages before enabling anything paid.
