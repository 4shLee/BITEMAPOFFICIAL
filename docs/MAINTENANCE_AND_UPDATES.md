# BITEMAP — Maintenance Controls & Secure Update Runbook

This runbook defines the standard operating procedures for routine maintenance, dependency updates, production deployments, migration safety, health verification, and incident response for **BITEMAP** (GIS-Based Animal Bite Incident Tracking & Anti-Rabies Vaccination Monitoring System).

> **Core Security Principle:** Production maintenance must be deliberate, verifiable, and fail-safe. Secrets, credentials, and tokens must never be written to Git or logs; updates must be tested in an isolated environment first; and backups must precede any structural or schema changes.

---

## 1. Automated vs. Manual vs. Provider-Dependent Controls

To prevent false assumptions during operations, the table below clarifies the exact operational state of each maintenance control in BITEMAP:

| Control | Type | Mechanism / Details |
| :--- | :--- | :--- |
| **Production Health Check (`/up`)** | Automated Endpoint | Built into Laravel (`bootstrap/app.php` line 16). Monitored automatically by Railway via `railway.json`. |
| **System Readiness Check (`bitemap:maintenance-check`)** | Manual CLI Command | Built-in read-only Artisan command (`php artisan bitemap:maintenance-check`). Evaluates configuration, database, migrations, token expiration, and secret protection without exposing credentials. |
| **Scheduled Logical Backup** | Conditional Automated | Defined in `backend/routes/console.php` (`02:00` daily). Executes **only if** a worker runs `php artisan schedule:work` (e.g. `bitemap-scheduler`). Local container storage is ephemeral on Railway. |
| **Off-Site Logical Backup** | **Manual Operator Action** | Operator triggers `bitemap:backup-db --encrypt` and transfers the ciphertext file off-site. |
| **Infrastructure Volume Snapshots** | **Provider-Dependent (Manual Setup)** | Configured manually in the Railway dashboard (`MySQL` service → Backups tab). Not automatically enabled by the codebase. |
| **Pre-Deploy Database Backup** | **Manual Operator Action** | Operator must take an encrypted logical backup (`bitemap:backup-db --encrypt`) and/or Railway volume snapshot before applying migrations. |
| **Pre-Deploy Migration Application** | Semi-Automated / Manual | Configured as Railway's **Pre-deploy Command** (`php artisan migrate --force`), which stops deployment if a migration fails. |
| **Dependency Vulnerability Scanning** | **Manual Developer Action** | Executed manually prior to releases via `composer audit` and `npm audit`. |
| **Frontend Production Build** | Automated at Build Time | Vite builds static assets (`npm run build` / Vercel deployment pipeline). |

---

## 2. Dependency Management & Security Updates

### PHP / Laravel Backend Dependencies
1. **Audit for Known Vulnerabilities**:
   ```bash
   cd backend
   composer audit
   ```
   Address any reported advisory before deploying.

2. **Update Safe Patch/Minor Versions**:
   ```bash
   composer update --with-all-dependencies
   ```
   - Review changes in `composer.lock`.
   - Never use `--ignore-platform-reqs` in production.
   - Run the automated test suite locally to verify backwards compatibility:
     ```bash
     php artisan test
     ```

3. **Adding New Packages**:
   - Assess package maintenance, security history, and minimal dependency footprint.
   - Do not install packages that request unneeded system permissions or duplicate core functionality.
   - Production Docker image (`backend/Dockerfile`) installs production dependencies only (`composer install --no-dev`).

### React / Node Frontend Dependencies
1. **Audit for Known Vulnerabilities**:
   ```bash
   cd frontend
   npm audit
   ```
   For fixable semver vulnerabilities: `npm audit fix` (review diffs carefully).

2. **Update Packages**:
   ```bash
   npm update
   ```

3. **Verify Build & Local Tests**:
   ```bash
   npm test
   npm run build
   ```

---

## 3. Safe Deployment Sequence

When releasing updates to production (Railway backend + Vercel frontend), adhere strictly to this sequence:

```
[1. Local Validation]  -->  [2. Pre-Deploy Backup]  -->  [3. Pre-Deploy Migration]  -->  [4. Service Start]  -->  [5. Verification Checklist]
  - composer audit            - bitemap:backup-db          - php artisan migrate          - Docker start.sh         - GET /up
  - npm test & build            --encrypt                    --force (Railway hook)         - Apache on $PORT        - bitemap:maintenance-check
  - php artisan test          - Railway Snapshot                                                                    - Admin verification
```

### Step 1: Pre-Deployment Validation (Local / CI)
Before pushing commits to `main`:
1. Ensure working tree is clean.
2. Confirm backend test suite passes:
   ```bash
   php artisan test
   ```
3. Confirm frontend build succeeds without TypeScript or bundler errors:
   ```bash
   cd frontend && npm run build
   ```

### Step 2: Mandatory Backup Before Migration
MySQL DDL statements (e.g., `ALTER TABLE`, `DROP COLUMN`) are non-transactional and cannot be rolled back automatically if interrupted.
1. Take an on-demand encrypted logical backup:
   ```bash
   php artisan bitemap:backup-db --encrypt --keep=14
   ```
2. In Railway, trigger a manual snapshot under `MySQL` → **Backups**.

### Step 3: Deployment & Migration Execution
- In Railway, migrations should run via the **Pre-deploy Command**:
  ```bash
  php artisan migrate --force
  ```
  *Benefit:* If a migration fails, Railway halts deployment and leaves the previous container release online.
- Alternatively, if `RUN_MIGRATIONS_ON_START=true` is set, container startup aborts immediately upon failure.

### Step 4: Maintenance Mode (For Major Breaking Updates)
For structural maintenance where user writes must be temporarily paused:
1. Enable maintenance mode:
   ```bash
   php artisan down --secret="bitemap-admin-bypass" --render="errors::503"
   ```
   *(Authorized administrators can navigate using `https://<api-domain>/bitemap-admin-bypass` to verify system health).*
2. Perform required database updates or maintenance tasks.
3. Disable maintenance mode once validated:
   ```bash
   php artisan up
   ```

---

## 4. Post-Deployment Verification Checklist

Immediately following deployment to Railway and Vercel:

1. **Service Health Check**:
   ```bash
   curl -i https://<api-domain>.up.railway.app/up
   ```
   *Expected:* HTTP 200 `{"status":"up"}` or plain `OK`.

2. **Read-Only Maintenance & Security Audit**:
   Execute the built-in diagnostic tool in a one-off Railway container shell:
   ```bash
   php artisan bitemap:maintenance-check
   ```
   *Expected Output:*
   - `APP_ENV=production`, `APP_DEBUG=false` (PASS)
   - `APP_KEY` valid, unique, and not matching the development key (PASS)
   - `APP_URL` uses `https://` (PASS)
   - `TRUSTED_PROXIES` configured (PASS)
   - `CORS_ALLOWED_ORIGINS` has no wildcard (PASS)
   - `sanctum.expiration` within 720 minutes & `sanctum.last_used_at=false` (PASS)
   - Database connected and all migrations applied (PASS)
   - Active system administrator account verified (PASS)

3. **Public Endpoint Check**:
   - `GET /api/barangays` returns Digos City barangays.
   - `GET /api/dev/status` returns HTTP 404 (opaque response in production).

4. **Authentication & Session Test**:
   - Sign in via frontend as an approved user.
   - Verify bearer token is issued, idle timeout is active, and session metadata is accurate.

5. **Audit Log Inspection**:
   - Navigate to `/audit-logs` as `system_admin`.
   - Confirm user sign-in and system maintenance events are logged with client IP (via trusted proxy).

---

## 5. Rollback and Disaster Recovery Procedures

### Scenario A: Failed Migration or Code Deployment
1. Railway will automatically stop the deployment if the Pre-deploy Command fails.
2. If the new release is already serving but exhibits defects:
   - In Railway dashboard, navigate to **Deployments** → select the previous stable deployment → click **Redeploy**.
   - If database schema changes need reversal:
     - Check if the migration has a safe `down()` method:
       ```bash
       php artisan migrate:rollback --step=1 --force
       ```
     - If the schema or data is corrupted, execute database restore from the pre-deploy backup (Scenario B).

### Scenario B: Database Restoration from Backup
Follow the verified runbook in [`docs/BACKUP_AND_RECOVERY.md`](BACKUP_AND_RECOVERY.md):
1. Verify backup integrity first:
   ```bash
   php artisan bitemap:verify-backup <backup-file>
   ```
2. Test restore against an isolated recovery connection (`--connection=<recovery>`).
3. Restore to target database with safety override:
   ```bash
   php artisan bitemap:restore-db <backup-file> --force
   ```
4. Verify all 11 core tables and ensure all users re-authenticate (tokens are flushed).

---

## 6. Incident Response & Secret Compromise Handling

### 1. Compromised `APP_KEY`
- **Impact:** Encryption tokens, encrypted backups, and cookies can be decrypted/forged.
- **Remediation Procedure:**
  1. Generate a new key:
     ```bash
     php artisan key:generate --show
     ```
  2. Update `APP_KEY` in Railway service variables.
  3. Re-encrypt any off-site backups or retain the old key in a secure vault solely for legacy backup recovery.
  4. Invalidate all active user sessions by purging `personal_access_tokens`.

### 2. Compromised Database Credentials (`DB_PASSWORD`)
1. In Railway MySQL service, navigate to **Variables** and generate a new password.
2. Update `DB_PASSWORD` on the `bitemap-api` service.
3. Redeploy `bitemap-api`.
4. Inspect `audit_logs` for unauthorized database access or unexpected role changes.

### 3. Compromised SMS Gateway Credentials (`TWILIO_*` / `PHILSMS_*`)
1. Immediately revoke and regenerate API tokens in the SMS provider console.
2. Update the environment variables in Railway (`TWILIO_AUTH_TOKEN`, etc.).
3. Check `notifications` and `audit_logs` to ensure SMS credits were not abused.

### 4. Account Takeover / Compromised Staff Account
1. An administrator immediately revokes access via the User Management interface by deactivating the account (`is_active = false`).
2. Backend automatically deletes all active `personal_access_tokens` for the deactivated user.
3. Reset user password enforcing strong password policy rules.
4. Review the user's action history in `audit_logs` to assess clinical/patient record impact.
