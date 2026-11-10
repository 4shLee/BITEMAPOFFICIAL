# BITEMAP — Backup and Recovery Security Runbook

This runbook defines the backup, integrity verification, and disaster recovery procedures for **BITEMAP** (GIS-Based Animal Bite Incident Tracking & Anti-Rabies Vaccination Monitoring System).

> **Important Security Rule:** BITEMAP backups contain confidential clinical and patient personally identifiable information (PII). Never commit backup files to Git, never store unencrypted production backups on shared/public folders, and never run destructive restore commands directly against the production database without first verifying the backup in an isolated recovery database.

---

## 1. Architecture & Data Scope

BITEMAP stores all operational, clinical, GIS, and security state in its relational database (MySQL in Railway production; MariaDB 10.11 in local Docker; SQLite in automated tests). PDF/Excel reports and CSV audit exports are generated dynamically in memory—no user-uploaded clinical files are stored on the web server filesystem.

### Protected Tables (`DatabaseBackupManager::BACKUP_TABLES`)

| Order | Table | Data Protected | Sensitivity |
| :---: | --- | --- | --- |
| 1 | `barangays` | Digos City barangay reference records and validated GIS coordinates | Reference |
| 2 | `users` | Staff accounts, RBAC roles, approval status, active flags, bcrypt/argon2 password hashes | High (Auth) |
| 3 | `settings` | System security policies (`session_timeout_minutes`, lockout rules) and clinic configuration | Medium |
| 4 | `patients` | Patient demographics, structured names, contact numbers, barangay, SMS consent | **Critical (Patient PII)** |
| 5 | `incidents` | Animal bite exposure records, WHO Categories I–III, bite site, animal status, GIS coordinates | **Critical (Clinical PII)** |
| 6 | `inventory` | Anti-rabies vaccine and RIG item catalog and stock thresholds | Operational |
| 7 | `inventory_batches` | Vaccine lot/batch numbers, expiration dates, and remaining quantities | Operational |
| 8 | `pep_schedules` | Post-Exposure Prophylaxis Day 0 / 3 / 7 / 14 / 28 schedules and administered dose records | **Critical (Clinical PII)** |
| 9 | `inventory_transactions` | Vaccine stock movement history linked to batches and administered PEP doses | Operational |
| 10 | `notifications` | SMS/email vaccination reminder logs and delivery status | **High (Patient Contact)** |
| 11 | `audit_logs` | Append-only security and operational audit trail | **High (Security Evidence)** |

### Explicitly Excluded Data

1. **Sanctum Bearer Tokens (`personal_access_tokens`)**: Excluded during backup and purged during restore so restoring a snapshot never resurrects old, expired, or revoked session tokens. All users must sign in freshly after a restore.
2. **Ephemeral Runtime Tables (`password_reset_tokens`, `sessions`, `cache`, `jobs`, `failed_jobs`)**: Excluded to prevent stale locks or replay of queued jobs.
3. **SMS Gateway Secrets (`twilio_account_sid`, `twilio_auth_token`, `twilio_from_number`)**: Automatically stripped from `settings` rows during both backup creation and restoration. Production SMS credentials must only be supplied via environment variables (`TWILIO_*`).

---

## 2. Two-Tier Backup Strategy

BITEMAP uses a defense-in-depth, two-tier backup architecture:

### Tier 1 — Infrastructure Volume Backups (Railway MySQL)
- **What it is:** Railway's managed Volume Backups / Snapshots attached to the `MySQL` database service.
- **Role in BITEMAP:** Provides fast block-level point-in-time recovery of the entire MySQL data volume in the event of Railway container failure or failed DDL migrations.
- **Limitation:** Provider volume snapshots are tied to the Railway project account and do not protect against accidental account deletion or logical table corruption unless paired with application-level logical backups.
- **Configuration (manual, provider-dependent):** Railway does **not** enable this automatically for BITEMAP, and the repository cannot configure it. Availability, schedule options, and retention depend on the Railway plan and dashboard at the time; do not assume a snapshot exists until you have seen it listed.
  1. Open the Railway project → select the **`MySQL`** service → **Backups** tab (if offered on your plan).
  2. Enable the scheduled volume backups that your plan provides, and note the retention shown.
  3. Before any deployment that includes database migrations (`php artisan migrate --force`), trigger a manual on-demand backup and confirm it appears in the list.

### Tier 2 — Application Logical Backups (`bitemap:backup-db`)
- **What it is:** A portable, database-agnostic Laravel Artisan backup command (`php artisan bitemap:backup-db`) implemented in `App\Support\DatabaseBackupManager`.
- **Why it is needed:** The production `backend/Dockerfile` (`php:8.5-apache`) minimizes attack surface and image size by omitting `mysqldump` / `mariadb-client`. `bitemap:backup-db` runs natively over PHP PDO in local environments, Docker containers, the automated feature tests, and Railway shells without extra system binaries.
- **Features:**
  - Exports all 11 BITEMAP tables in foreign-key dependency order.
  - Generates a deterministic **SHA-256 integrity checksum** over the canonical payload.
  - Supports **AES-256 encryption at rest** (`--encrypt`) using Laravel's `Crypt` (`APP_KEY`).
  - Stores backups in `storage/app/private/backups/` (outside `public/`, file mode `0600` on Linux containers, and gitignored).
  - Automatically prunes older backups beyond the retention count (`--keep=14`).
  - Records an append-only `Create backup` entry in `audit_logs` without exposing any PII.

---

## 3. Backup Frequency & Retention Policy

| Backup Type | Trigger / Schedule | Automation status | Encryption | Storage Location | Retention Policy |
| --- | --- | --- | --- | --- | --- |
| **Daily Logical Backup** | `02:00` via `routes/console.php` scheduler | **Conditional:** runs only while a scheduler process (`php artisan schedule:work`, e.g. the optional `bitemap-scheduler` Railway service or local Docker `scheduler`) is running | AES-256 (`--encrypt`) | `storage/app/private/backups/` **inside that container** — ephemeral on Railway, lost on redeploy; copying off-site is **manual** | **14 files** (`--keep=14`) |
| **Railway Volume Backup** | Provider schedule | **Provider-dependent, must be enabled manually** in the Railway dashboard | Provider-managed | Railway managed storage | Per Railway plan |
| **Pre-Migration / Pre-Deploy Backup** | Before running `php artisan migrate --force` | **Manual** | AES-256 (`--encrypt`) | Off-site administrator encrypted storage | **30 days** |
| **Weekly Off-Site Archive** | Weekly | **Manual** (`railway run … bitemap:backup-db --encrypt`, see §5A) | AES-256 (`--encrypt`) | Off-site restricted administrator storage | **90 days** |

> [!IMPORTANT]
> Only the scheduled logical backup is automated by BITEMAP itself, and only while a scheduler process is running. Every off-site copy is a manual operator task. Run `php artisan bitemap:maintenance-check` to see whether recent backup files exist on the machine/container you are inspecting.

---

## 4. Security Protections for Backup Data

1. **Encryption at Rest (`--encrypt`)**:
   - Production backups must always use `--encrypt`, which encrypts the JSON payload using AES-256-CBC + HMAC-SHA-256 (`Crypt::encryptString`). Even if a backup file is inspected on disk, patient names, phone numbers, bite details, and password hashes remain unreadable ciphertext.
2. **Integrity Verification (`SHA-256` + HMAC)**:
   - Every backup envelope records a 64-character SHA-256 digest of the canonical payload. Both `bitemap:verify-backup` and `bitemap:restore-db` recompute and compare this digest with `hash_equals()` before trusting any row.
3. **Access Control & File Permissions**:
   - Backups written to `storage/app/private/backups/` are never reachable via `/storage` (which only links `storage/app/public`) and are created with `0600` permissions on Linux (the chmod is a no-op on Windows hosts).
4. **Git Exclusion**:
   - `.gitignore`, `backend/.gitignore`, and `backend/storage/app/private/.gitignore` explicitly ignore `*.sql`, `*.sql.gz`, `*.bak`, `bitemap-backup-*.json`, and `storage/app/private/backups/`.
5. **Audit Trail Accountability**:
   - Creating or restoring a backup writes an immutable `System Maintenance` audit log entry (`Create backup` / `Restore backup`) recording the filename, row count, and 12-character SHA-256 prefix.

---

## 5. Standard Operating Procedures (Commands)

### A. Create an Encrypted Backup
```bash
# Inside backend/ or via Docker (docker exec bitemap-backend ...)
php artisan bitemap:backup-db --encrypt --keep=14
```

To save an off-site encrypted backup of Railway data onto your own machine (read-only towards production data apart from one appended `Create backup` audit entry):
```bash
# From backend/ on your machine. `railway run` executes LOCALLY with the service's variables injected,
# so the file is written to your local backend/storage/app/private/backups/ and encrypted with the
# production APP_KEY. Your machine must be able to reach the database: Railway's private host
# (*.railway.internal) is NOT reachable from outside Railway, so this only works if the MySQL service
# exposes a public TCP proxy and DB_HOST/DB_PORT point to it for this command.
railway run --service bitemap-api php artisan bitemap:backup-db --encrypt --output=storage/app/private/backups/pre-deploy.encrypted.json
```

### B. Optional MariaDB / MySQL Native Dump (Local Docker only)
For local Docker (`bitemap-mariadb`), you can also take a native SQL dump. Run from the repository root; `-p` prompts for the password instead of placing it on the command line. A plain `.sql` dump is **not encrypted** — keep it local, never commit it (`*.sql` is gitignored), and delete it when done:
```bash
docker exec -it bitemap-mariadb mariadb-dump -u bitemap -p --single-transaction --routines --triggers bitemap_db > backend/storage/app/private/backups/local-dump.sql
```

### C. Verify Backup Integrity Before Relying On It
Always verify a backup file immediately after creation and before any restore:
```bash
php artisan bitemap:verify-backup bitemap-backup-YYYYMMDD-HHMMSS.encrypted.json
```
- **Exit code `0`**: Backup is readable, decryptable, passes SHA-256 checksum verification, contains all 11 BITEMAP tables, and matches declared row counts.
- **Exit code `1`**: Backup is corrupted, tampered with, missing required tables, or encrypted with a different `APP_KEY`.

---

## 6. Step-by-Step Recovery / Restore Procedure

> **Warning:** Never restore directly over the live production database without first testing the restore against an isolated recovery/test database connection.

### Step 1 — Verify the Backup File
```bash
php artisan bitemap:verify-backup <backup-file>
```
If verification fails, **abort immediately** and select the previous verified backup snapshot.

### Step 2 — Dry-Run Restore into an Isolated Test/Recovery Database
1. Configure a separate test/recovery database connection (e.g., `sqlite_recovery` or a staging MySQL schema) and run migrations on that isolated connection:
   ```bash
   php artisan migrate --database=<recovery_connection> --force
   ```
2. Restore the backup into the isolated connection:
   ```bash
   php artisan bitemap:restore-db <backup-file> --connection=<recovery_connection>
   ```
   *(Note: `bitemap:restore-db` automatically refuses to overwrite a non-empty database unless `--force` is explicitly provided).*

### Step 3 — Execute Production Recovery (Disaster Recovery Only)
Only during an authorized disaster recovery event:
1. Put the application into maintenance mode or pause incoming traffic.
2. Take a final snapshot of the current database state before overwriting.
3. Ensure schema migrations match the backup version (`php artisan migrate --force`).
4. Run the restore with `--force`:
   ```bash
   php artisan bitemap:restore-db <backup-file> --force
   ```
   *(Note: In `APP_ENV=production`, `bitemap:restore-db` always refuses to execute unless `--force` is explicitly supplied).*

### Step 4 — Post-Restore Verification Checklist
1. **Reference Data Check**: Verify `GET /api/barangays` returns the 28 Digos City barangays with coordinates.
2. **Authentication & Session Check**: Confirm old Bearer tokens are invalidated (`personal_access_tokens` is empty) and sign in freshly as `system_admin` and `clinic_admin`.
3. **Clinical Records Check**: Verify patient counts, incident records, PEP schedules, and vaccine batch balances match the backup manifest's `table_counts`.
4. **Audit Log Check**: Confirm the `Restore backup` event appears in the `System Maintenance` audit log with the matching SHA-256 prefix.
5. **SMS Safety Check**: Verify `SMS_SERVICE_ENABLED` remains in its intended state before resuming scheduled reminder jobs.
