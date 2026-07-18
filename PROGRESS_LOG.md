# BITEMAP Codex Progress Log

Last updated: June 29, 2026

This file tracks the completed changes made through Codex for the BITEMAP project. Keep this updated whenever a feature, fix, or configuration change is completed.

## Completed Work

### 1. Login Page Routing Fix

Status: Completed

Files updated:
- `frontend/src/app/App.tsx`

Summary:
- Fixed the issue where the sidebar appeared on the login page.
- Moved `/login` outside the dashboard `MainLayout`.
- Changed `/` to redirect to `/login`.
- Kept sidebar only for dashboard/application pages such as `/dashboard`, `/incidents`, `/patients`, `/inventory`, and `/gis-map`.

Expected behavior:
- Opening `localhost:5173` redirects to `/login`.
- Login page displays without sidebar navigation.
- Dashboard pages still display with sidebar navigation.

### 2. Inventory Stock Adjustment Fix

Status: Completed

Files updated:
- `frontend/src/app/components/Inventory/StockAdjustmentModal.tsx`

Summary:
- Fixed stock adjustment logic.
- `Restock` and `Received` now add to current stock.
- `Used`, `Dispensed`, `Damaged`, and `Expired` now subtract from current stock.
- `Adjustment` now clearly means setting the exact stock amount.
- Updated helper text so staff can see whether the action adds, subtracts, or replaces stock.

Expected behavior:
- If current stock is `121` and staff restocks `10`, new stock becomes `131`.
- Damaged and expired stock now correctly decrease inventory.

### 3. GIS Heatmap Backend Enhancement

Status: Completed

Files updated:
- `backend/app/Http/Controllers/Api/BitemapApiController.php`

Endpoint updated:
- `GET /api/public/heatmap`

Summary:
- Updated the heatmap API to use live database incident records.
- Aggregates incidents by barangay.
- Filters out incidents with missing coordinates.
- Filters out coordinates outside Digos City bounds.
- Calculates total incident count per barangay.
- Calculates top animal type.
- Calculates PEP compliance rate.
- Calculates risk level based on incident count.

Risk rules:
- `0-10` incidents = `LOW RISK`
- `11-20` incidents = `MODERATE RISK`
- `21+` incidents = `HIGH RISK`

Digos City map restriction:
- Center: `[6.7497, 125.3572]`
- Bounds southwest: `[6.63, 125.25]`
- Bounds northeast: `[6.88, 125.48]`

### 4. GIS Heatmap Frontend Upgrade

Status: Completed

Files updated:
- `frontend/src/app/pages/GISMap.tsx`
- `frontend/src/lib/services/api.ts`

Summary:
- Replaced the previous iframe/static GIS display with a Leaflet map.
- Added OpenStreetMap tile layer.
- Added heatmap visualization using `leaflet.heat`.
- Added color-coded circle markers by risk level.
- Marker size now increases based on incident count.
- Marker popup displays barangay name, total incidents, risk level, top animal type, and PEP compliance rate.
- Preserved the existing layout:
  - left filter panel
  - center GIS map
  - right barangay analysis panel

Expected behavior:
- GIS map loads live incident data from the database.
- Refreshing the page after incident add/edit/delete reflects updated hotspot data.
- If no valid incident data exists, the page shows `No incident data available yet.`

### 5. Local Leaflet Setup

Status: Completed

Files updated:
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/app/pages/GISMap.tsx`

Summary:
- Added local `leaflet` dependency.
- Uses existing `leaflet.heat` dependency.
- Updated GIS map to import Leaflet locally instead of loading Leaflet scripts from CDN.

Local imports used:

```ts
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
await import('leaflet.heat');
```

Note:
- OpenStreetMap map tiles still load from OpenStreetMap tile servers, which is normal for Leaflet + OpenStreetMap.

### 6. GIS Coordinate Fallback Fix

Status: Completed

Files updated:
- `backend/app/Http/Controllers/Api/BitemapApiController.php`
- `frontend/src/app/components/Incidents/IncidentFormModal.tsx`

Summary:
- Fixed the issue where GIS showed `No incident data available yet.` even when incidents existed.
- Root cause: incidents were saved without `location_lat` and `location_lng`.
- Backend GIS API now falls back to barangay center coordinates when exact incident coordinates are missing.
- Incident create/update modal now automatically sends barangay center coordinates based on the selected barangay.
- Existing records with valid barangay but missing coordinates now appear on the GIS heatmap.

Expected behavior:
- Incidents assigned to barangays such as Zone 2, Zone 3, and San Miguel appear on the GIS map even if older records had no exact pin coordinates.
- New incidents created from the incident modal include coordinates automatically.

Testing notes:
- `GET /api/public/heatmap` returned 3 barangay heat points after the fix.

### 7. GIS Barangay Choropleth Map Fix

Status: Completed

Files updated:
- `frontend/src/app/pages/GISMap.tsx`
- `frontend/src/data/digos-barangays.ts`
- `frontend/src/styles/index.css`

Summary:
- Changed the GIS visualization from mostly marker-based display to a barangay boundary choropleth map.
- Expanded the local Digos barangay GeoJSON from 8 simplified barangays to all 26 Digos barangays.
- Added Leaflet polygon overlay for each Digos barangay.
- Barangay polygons are color-coded by risk level:
  - green for low risk
  - yellow for moderate risk
  - red for high risk
- Added permanent barangay labels on the map.
- Barangay polygons are clickable and update the right-side Barangay Analysis panel.
- Heatmap and circle markers remain as secondary overlays, but barangay polygons are now the primary GIS display.

Expected behavior:
- The GIS map should look like a barangay risk map, similar to a choropleth GIS output.
- Only Digos City barangays are drawn as polygons.
- Existing valid incident/barangay data colors the matching barangay areas.

Testing notes:
- Frontend parse check passed.
- Local GeoJSON now contains 26 Digos barangay polygons.

### 8. GIS Barangay Border Visibility Fix

Status: Completed

Files updated:
- `frontend/src/app/pages/GISMap.tsx`
- `frontend/src/styles/index.css`

Summary:
- Made Digos barangay boundaries clearer on the GIS map.
- Moved the heat layer below the barangay polygon layer.
- Added a separate dark boundary overlay above polygons so barangay borders remain visible.
- Increased polygon stroke width and selected-barangay stroke emphasis.
- Added hover highlight for barangay polygons.
- Improved barangay label readability with stronger text shadow.

Expected behavior:
- Borders between barangays are visibly separated.
- Barangay names remain readable over the map.
- Heatmap no longer blurs over the barangay boundary lines.

### 9. GIS Choropleth Rollback

Status: Completed

Files updated:
- `frontend/src/app/pages/GISMap.tsx`
- `frontend/src/styles/index.css`

Summary:
- Removed the barangay polygon/border choropleth display from the active GIS page.
- Restored the simpler GIS visualization that uses the live heatmap and color-coded circle markers only.
- Removed unused barangay label and polygon CSS styles.

Expected behavior:
- The GIS page no longer draws barangay boundary shapes over the map.
- The map shows live hotspot intensity and clickable risk markers for barangays with incident data.

Testing notes:
- Verified the GIS component no longer imports or renders the barangay GeoJSON overlay.

### 10. Action Icon Visibility Improvement

Status: Completed

Files updated:
- `frontend/src/app/components/Incidents/IncidentListPage.tsx`
- `frontend/src/app/pages/Patients.tsx`
- `frontend/src/app/pages/Inventory.tsx`
- `frontend/src/app/pages/AnimalRegistry.tsx`

Summary:
- Added visible button layers behind table action icons.
- Increased action icon size from 16px to 20px.
- Added light colored background, border, and shadow for clearer View/Edit/Delete controls.
- Kept Delete visually red while View/Edit remain primary green.

Expected behavior:
- Users can clearly see and click action buttons in table rows.
- View, Edit, and Delete actions are easier to identify without changing the table layout.

Testing notes:
- Syntax parse check completed for updated React files.

### 11. Live Notifications Page

Status: Completed

Files updated:
- `frontend/src/app/pages/Notifications.tsx`

Summary:
- Removed hardcoded notification and upcoming reminder mock data.
- Loaded notification logs from the Laravel `/api/notifications` endpoint.
- Built upcoming reminders from live PEP schedule rows.
- Connected SMS and Email reminder buttons to backend notification endpoints.
- Updated statistics to use live notification records.

Expected behavior:
- Notifications page only shows records from the database.
- Upcoming reminders only show real PEP doses due within the next 7 days.
- Sending reminders creates notification log records through the backend.

Testing notes:
- React syntax parse check completed for the updated Notifications page.

### 12. Role-Based Access Control

Status: Completed

Files updated:
- `frontend/src/lib/auth/roleAccess.ts`
- `frontend/src/app/App.tsx`
- `frontend/src/app/pages/Login.tsx`
- `frontend/src/app/components/Layout/Sidebar.tsx`
- `frontend/src/app/components/Layout/Header.tsx`

Summary:
- Added shared role permissions for Admin, Health Officer, Doctor, Nurse, Vaccinator, and BHW.
- Added route guards so direct URLs redirect users away from unauthorized pages.
- Filtered sidebar navigation based on the logged-in user role.
- Updated login redirect to send each role to its first allowed page.
- Updated sidebar and header to show the actual logged-in user instead of demo user text.
- Logout now clears the stored auth token and user data.

Expected behavior:
- Admin can see all modules.
- Health Officer sees monitoring/reporting modules but not Users or Settings.
- Nurse sees incident, patient, PEP, inventory, and notification workflows.
- BHW sees barangay-facing incident, patient, GIS, and notification workflows.
- Vaccinator sees patient, PEP, inventory, and notification workflows.

Testing notes:
- React syntax parse check completed for the updated role access files.

### 13. Live Report Generation

Status: Completed

Files updated:
- `backend/routes/api.php`
- `backend/app/Http/Controllers/Api/BitemapApiController.php`
- `frontend/src/lib/services/api.ts`
- `frontend/src/app/pages/Reports.tsx`

Summary:
- Replaced the mock Reports page flow with live backend report generation.
- Added `/api/reports/summary` for live preview totals and sample rows.
- Added `/api/reports/download` for downloadable report files.
- Reports now query live incidents, patients, PEP schedules, inventory, barangays, and inventory transactions depending on report type.
- Excel export is generated as an Excel-readable `.xls` file.
- PDF export is generated server-side without adding new packages.
- Removed hardcoded recent report mock data from the active Reports page.

Expected behavior:
- Generate From Database shows live totals and preview rows.
- Download PDF saves a report file generated by the backend.
- Download Excel saves an Excel-readable spreadsheet generated by the backend.
- Barangay filter options load from the database.

Testing notes:
- React syntax checks completed for modified report files.
- Local API probe confirmed `/api/reports/summary` returns live JSON.
- Local API probe confirmed PDF and Excel download endpoints return downloadable file responses.

### 14. Report Output Readability Fix

Status: Completed

Files updated:
- `backend/app/Http/Controllers/Api/BitemapApiController.php`
- `frontend/src/app/pages/Reports.tsx`

Summary:
- Reworked report PDF output from pipe-delimited text into a landscape report layout.
- Added a branded green report header, metadata, summary cards, table grid, alternating row backgrounds, and page footer.
- Added explicit Download PDF and Download Excel buttons after generating a report.
- Kept Excel downloads backed by the existing backend Excel-readable export.

Expected behavior:
- PDF reports are easier to read and look like formal system reports.
- Users can clearly choose PDF or Excel download without hunting through a format dropdown.

Testing notes:
- React syntax check completed for Reports page.
- Local API probe confirmed improved PDF and Excel endpoints return downloadable files.

### 15. Excel Export Warning Fix

Status: Completed

Files updated:
- `backend/app/Http/Controllers/Api/BitemapApiController.php`
- `frontend/src/lib/services/api.ts`
- `frontend/src/app/pages/Reports.tsx`

Summary:
- Changed Excel export from HTML-in-.xls to real CSV output.
- Updated response content type to `text/csv` and filename extension to `.csv`.
- Updated frontend fallback filename and button label to make the Excel CSV format clear.

Expected behavior:
- Excel should open the downloaded report without the file-format mismatch warning.
- The report still opens in Microsoft Excel and contains the full live report data.

Testing notes:
- Local API probe confirmed Excel export now returns `.csv` with `text/csv` content type.

### 16. Styled Excel Workbook Export

Status: Completed

Files updated:
- `backend/app/Http/Controllers/Api/BitemapApiController.php`
- `frontend/src/lib/services/api.ts`
- `frontend/src/app/pages/Reports.tsx`

Summary:
- Replaced raw CSV-looking Excel output with a real `.xlsx` workbook generator.
- Added workbook styling: merged title row, green header, summary section, formatted table headers, borders, alternating row fills, column widths, and frozen panes.
- Updated frontend labels back to Download Excel because the file is now a true workbook.
- Kept CSV fallback only if the server lacks PHP ZipArchive support.

Expected behavior:
- Excel reports open as clean, formatted workbooks instead of raw rows.
- Excel should no longer show a file extension/content mismatch warning when ZipArchive is available.

Testing notes:
- React syntax check completed for Reports page and API service.
- Local API probe confirmed Excel export returns a downloadable workbook response when supported.

## Testing Checklist

- Open `localhost:5173`.
- Confirm it redirects to `/login`.
- Confirm login page has no sidebar.
- Login and open `/dashboard`.
- Confirm dashboard has sidebar.
- Open `/inventory`.
- Test stock adjustment using `Restock`, `Used`, `Damaged`, and `Adjustment`.
- Open `/gis-map`.
- Confirm Leaflet map loads.
- Add an incident with Digos City coordinates.
- Refresh GIS map and confirm marker/heatmap appears.

## Update Rule

Whenever Codex completes another task, add a new numbered section under `Completed Work` with:
- status
- files updated
- summary
- expected behavior
- testing notes

### 17. Reports Excel Workbook Readability Fix
**Status:** Completed

**Concern:** The Excel download opened as a confusing plain worksheet and earlier formats could show Excel warnings because the file content did not match a true workbook format.

**Fix implemented:**
- Updated the Reports Excel export to generate a real .xlsx workbook package.
- Added workbook styling for readable title, summary, headers, table rows, frozen header area, and sensible column widths.
- Kept CSV fallback only for servers without PHP ZipArchive support.
- Fixed PHP 8.4 temp-file warning by creating the workbook inside Laravel storage instead of the system temp fallback path.

**Verification:**
- Reports summary API returned live report data successfully.
- PDF download still returns a valid %PDF file.
- Excel download now returns content type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet and .xlsx filename.
- Downloaded workbook has valid ZIP/XLSX signature and required workbook entries.

### 18. Public Portal Live Statistics
**Status:** Completed

**Concern:** The public portal home showed fixed sample values such as total bite cases, high-risk barangays, and vaccination rate. The public statistics page also had static chart data.

**Fix implemented:**
- Connected the public portal cards to the live public statistics API.
- Updated the backend public statistics endpoint to calculate current-year totals from MySQL records.
- Added live high-risk barangay count, vaccination/PEP completion rate, monthly cases, animal-type distribution, and age-group distribution.
- Updated the public barangay statistics endpoint to use current-year incident counts.
- Updated the public statistics charts and key insights to use live database data instead of mock values.

**Verification:**
- React parsing passed for PublicPortal and PublicStatistics.
- GET /api/public/statistics returned live data successfully.
- GET /api/public/barangay-stats returned current-year barangay counts successfully.

### 19. Staff Signup With Admin Approval
**Status:** Completed in code. Pending local migration run.

**Concern:** ABC staff needed a way to request an account from the login area, while administrators should remain in control of who can access the system.

**Fix implemented:**
- Added a new signup/account request page at /signup.
- Kept the account request workflow available at /signup, while the visible login footer was restored to "Contact your system administrator."
- Added approval_status to users through a new migration: pending, approved, rejected.
- Updated public signup so requested accounts are inactive and pending by default.
- Updated login logic to block pending or rejected accounts.
- Added admin approve/reject API endpoints for user account requests.
- Updated User Management with pending request count, approval badges, and Approve/Reject buttons.
- Admin-created accounts remain approved by default.

**Verification:**
- React parsing passed for Signup, Login, Users, App, and API service files.
- Backend controller loaded successfully through /api/dev/status.
- Migration command could not be run from Codex sandbox; run php artisan migrate in the backend folder before testing the workflow in browser.

### 20. Capstone Pilot Readiness Foundation Pass
**Status:** Completed in code. Pending local migration and scheduler run.

**Concern:** The system demo checklist needed stronger role control, auditability, PEP schedule automation foundation, Twilio-ready SMS reminders, and admin-only audit log visibility without rebuilding the existing project.

**Fix implemented:**
- Added backend role middleware and protected API routes by role using Sanctum.
- Added the Encoder role across backend validation, frontend role access, user management, and signup request options.
- Added migration support for approval_status, expanded user roles, expanded PEP schedule statuses, and richer audit log fields.
- Made default admin repair and audit queries schema-safe so the app still logs in before the new migrations are run.
- Added live audit log API with search, date range, user, role, module, action filters, plus PDF/Excel export.
- Added audit writes for login/logout, patient and incident changes, user approval/rejection, inventory changes, notification sending, vaccination schedule updates, settings, and report exports.
- Added scheduled backend commands for missed PEP detection and Twilio-ready SMS reminders for today, upcoming, and missed schedules.
- Updated Twilio service config keys for SMS integration.
- Added frontend Audit Logs page and Admin-only sidebar route.

**Files updated:**
- backend/bootstrap/app.php
- backend/routes/api.php
- backend/routes/console.php
- backend/config/services.php
- backend/app/Http/Middleware/EnsureUserHasRole.php
- backend/app/Http/Controllers/Api/BitemapApiController.php
- backend/app/Models/AuditLog.php
- backend/app/Support/DefaultAdminAccount.php
- backend/database/migrations/2026_07_01_000001_add_approval_status_to_users_table.php
- backend/database/migrations/2026_07_01_000002_add_encoder_role_audit_fields_and_pep_statuses.php
- frontend/src/lib/auth/roleAccess.ts
- frontend/src/lib/services/api.ts
- frontend/src/app/App.tsx
- frontend/src/app/components/Layout/Sidebar.tsx
- frontend/src/app/pages/AuditLog.tsx
- frontend/src/app/pages/Users.tsx
- frontend/src/app/pages/Signup.tsx

**Verification:**
- Backend malformed namespace/import scan passed.
- GET /api/dev/status returned 200 and database connected.
- Admin login with admin@bitemap.local / Bitemap@2026 returned 200.
- Admin Audit Logs endpoint returned live audit data.
- Latest login audit now records the actual admin user, role, and user ID.
- Protected endpoints return 401 without a token.
- React parsing passed for roleAccess, App, Sidebar, API service, Users, Signup, AuditLog, and Login.
- Migration command was blocked by the Codex sandbox, so run it locally before testing new DB-backed fields.

**Commands to run locally:**
- cd backend
- php artisan migrate
- php artisan schedule:work

**Twilio environment keys:**
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER
- BITEMAP_FACILITY_NAME

### 21. Approval-Only User Account Flow
**Status:** Completed

**Concern:** Admin should not manually create staff accounts from the Users page. Staff should request/register their own account from the login page, then Admin only approves, rejects, edits role/status, or deactivates accounts.

**Fix implemented:**
- Restored the login page account request link to /signup with the label Request account approval.
- Removed the visible Add User button from the Admin Users page.
- Renamed the Users page header to Account Approval to match the new workflow.
- Removed the frontend usersAPI create helper so the admin page no longer calls manual account creation.
- Removed the backend POST /users route so manual user creation is not available through the API route.
- Kept edit, approve, reject, activate, and deactivate actions for Admin.
- Hardened signup, users list, approve, reject, and user payload logic so pending requests still behave safely around the approval_status migration.
- Fixed rejectUser to receive the request object before writing audit logs.

**Verification:**
- React parsing passed for Login, Users, and API service.
- GET /api/dev/status returned 200.
- Admin login returned 200.
- GET /api/users returned 200 with admin token.
- POST /api/users now returns 405 because manual user creation route was removed.
- Users page no longer contains Add User or Add New User text.
- Login page contains the /signup account request link.

### 22. Login Account Request Modal
**Status:** Completed

**Concern:** The account request on the login page should not look like a plain text link. Staff should click a clear button and fill out their account information in a popup.

**Fix implemented:**
- Replaced the login page account request text link with a full-width Request Account Approval button.
- Added a popup modal directly on the login page for staff account requests.
- The modal collects full name, email, phone, requested role, password, and password confirmation.
- The modal submits to the existing signup API, so requests still appear as pending for Admin approval.
- Added success state after submission and kept Admin approval as the next step.

**Verification:**
- React parsing passed for Login.tsx.
- Login page no longer contains a /signup route link.
- Login page now contains the request button, modal form, and authAPI.signUp submission call.

### 23. Today PEP Schedule User Notifications
**Status:** Completed

**Concern:** Logged-in users should be aware when there are PEP vaccination schedules due today instead of needing to manually open the schedule page.

**Fix implemented:**
- Added backend API endpoint GET /api/schedule-alerts/today.
- The endpoint returns today's non-completed PEP schedules with patient name, barangay, dose day, date, status, and count.
- Updated the top header notification bell to fetch today's schedule alerts.
- The bell now shows a numeric badge when there are schedules due today.
- Clicking the bell opens a dropdown list of today's scheduled patients.
- Each dropdown item can open the PEP Schedule page, and the footer link opens Notifications.
- If there are no schedules today, the dropdown clearly says no PEP schedules for today.

**Verification:**
- React parsing passed for Header.tsx and api.ts.
- GET /api/dev/status returned 200.
- Admin login returned 200.
- GET /api/schedule-alerts/today returned 200 with live database data.

**Vict's Progress**

# BITEMAP Development Progress Log

## June 1, 2026 – RBAC and Final Role Standardization

### System Administrator RBAC Update

The System Administrator role was restricted and standardized as a technical platform role.

The final role key was set to:

```text
system_admin
```

System Administrator is now allowed to access only:

* User Management
* System Settings
* Audit Logs
* System/System Notifications
* Logout

System Administrator is blocked from clinic and health-related modules such as:

* Dashboard
* Patients
* Incidents
* New Incident
* PEP Schedule
* Inventory
* GIS Map
* Reports

The default administrator account was also updated:

```text
Email: admin@bitemap.local
Password: password
Role: system_admin
Status: active
```

The system now redirects System Administrator users to `/users` instead of the health dashboard.

---

### Final Role Set

The system roles were standardized into four final roles:

```text
system_admin
clinic_admin
doctor
nurse_vaccinator
```

Old or temporary roles were removed from the final frontend options, including:

* Health Officer
* BHW
* Encoder
* separate Nurse
* separate Vaccinator

Compatibility mappings were added to support old role values if existing data still appears in the database.

Examples:

```text
Admin → system_admin
Health Officer → doctor
Nurse → nurse_vaccinator
Vaccinator → nurse_vaccinator
Clinic Admin → clinic_admin
```

---

### Demo/Test Accounts Standardization

The final active demo accounts were standardized as:

| Email                                                           | Password | Final Role       | Display Name         |
| --------------------------------------------------------------- | -------- | ---------------- | -------------------- |
| [admin@bitemap.local](mailto:admin@bitemap.local)               | password | system_admin     | System Administrator |
| [doctor@bitemap.local](mailto:doctor@bitemap.local)             | password | doctor           | Doctor               |
| [nurse@bitemap.local](mailto:nurse@bitemap.local)               | password | nurse_vaccinator | Nurse/Vaccinator     |
| [clinic.admin@bitemap.local](mailto:clinic.admin@bitemap.local) | password | clinic_admin     | Clinic Administrator |

Old demo accounts such as:

* `bhw@bitemap.local`
* `test@example.com`
* `health.officer@bitemap.local`

were either deactivated or converted into the final role structure.

No `migrate:fresh` command was run.

---

### Frontend RBAC Updates

The frontend RBAC configuration was updated in:

```text
roleAccess.ts
```

The sidebar and route guards now follow the final role permissions.

The topbar **New Incident** button is hidden for roles that are not allowed to create incidents.

System Administrator can no longer manually access restricted health-related frontend routes.

---

### Backend RBAC Updates

The backend API middleware now normalizes legacy role values safely.

Backend routes now use final normalized role keys:

```text
system_admin
clinic_admin
doctor
nurse_vaccinator
```

Old role access was removed from protected write routes to prevent Doctor from inheriting old Health Officer permissions.

---

## July 2, 2026 – Local Development Setup

The BITEMAP web application was set up from GitHub to the local laptop development environment.

The local project folder was prepared for development and testing.

The app structure includes:

* Laravel backend
* Vite React frontend
* MySQL database through local development tools

---

## July 3, 2026 – Project Review, Blank Page Fix, and RBAC Continuation

### Project Review

The `BITEMAPOFFICIAL` project folder was reviewed.

The system was confirmed to be a two-part application:

```text
backend  → Laravel API backend
frontend → Vite React TypeScript frontend
```

Major modules already exist, including:

* Authentication
* Dashboard
* Patients
* Incidents
* PEP Schedule
* Inventory
* GIS Map
* Reports
* Notifications
* User Management
* Settings
* Audit Logs
* Public Portal pages

It was also noted that Laravel is now the active backend, while some old Supabase-related frontend files still exist.

---

### Blank Page Fix

The Vite blank white page issue was fixed.

Cause:

```text
LucideIcon was imported as a runtime value from lucide-react, but it is only a TypeScript type.
```

Updated files:

```text
StatCard.tsx
EmptyState.tsx
```

The imports were changed to use `import type`.

After the fix, the frontend rendered correctly and redirected to the login page.

---

# RBAC Fixes Completed

## Nurse/Vaccinator Role

The Nurse/Vaccinator role was standardized to:

```text
nurse_vaccinator
```

Compatibility was added for old values:

```text
Nurse/Vaccinator
Nurse
Vaccinator
nurse
vaccinator
```

Nurse/Vaccinator can access:

* Dashboard
* Patient Registry
* Incident Management
* PEP Schedule
* Inventory
* Notifications
* Logout

Nurse/Vaccinator cannot access:

* User Management
* System Settings
* Audit Logs
* Reports
* GIS Map
* System administration pages

Nurse/Vaccinator can perform daily clinic workflow tasks such as:

* Register patients
* Update patient records
* Record animal bite incidents
* Encode assessment details
* Create and update PEP schedules
* Mark doses as given or missed
* Reschedule PEP doses
* Send SMS reminders
* View and update inventory
* Add/restock inventory items
* Record batch/lot number, expiry date, and reorder level

Verified account:

```text
nurse@bitemap.local
```

The account successfully logs in as:

```text
nurse_vaccinator
```

Allowed APIs return `200`, while restricted APIs return `403`.

---

## Doctor Role

The Doctor role was standardized to:

```text
doctor
```

Compatibility was added for old values:

```text
Doctor
Health Officer
```

Doctor can access:

* Dashboard
* Patient Registry
* Incident Management
* PEP Schedule
* Inventory
* GIS Map
* Reports
* Logout

Doctor cannot access:

* User Management
* System Settings
* Audit Logs
* Notifications
* New Incident page
* Inventory create/edit/restock/delete actions

Doctor permissions are mostly view and review-based:

* View patients
* View patient details
* View incidents
* View PEP schedules
* View inventory
* View reports
* View GIS Map

Inventory access for Doctor is view-only.

Verified account:

```text
doctor@bitemap.local
```

The account successfully logs in as:

```text
doctor
```

Doctor was confirmed unable to add, edit, or restock inventory.

---

## Clinic Admin Role

The Clinic Admin role was standardized to:

```text
clinic_admin
```

Compatibility was added for old value:

```text
Clinic Admin
```

Clinic Admin can access:

* Dashboard
* Patient Registry
* Incident Management
* New Incident
* PEP Schedule
* Inventory
* GIS Map
* Reports
* Notifications
* User Management
* Logout

Clinic Admin cannot access:

* System Settings
* Audit Logs
* Technical system administration pages reserved for System Administrator

Clinic Admin can manage clinic operations and clinic-level users, but cannot manage `system_admin` users.

System Admin-related actions and role options are hidden from Clinic Admin in User Management.

Verified account:

```text
clinic.admin@bitemap.local
```

The account successfully logs in as:

```text
clinic_admin
```

---

# Database and Migration Work

Normal migrations were added. No `migrate:fresh` was used.

Added migrations:

```text
2026_07_03_000001_canonicalize_nurse_vaccinator_role.php
2026_07_03_000002_canonicalize_doctor_role.php
2026_07_03_000003_canonicalize_clinic_admin_role.php
```

These migrations support the final role enum values and convert old role labels into canonical role keys.

The normal migration command may be used:

```powershell
php artisan migrate
```

Data was preserved.

---

# Important Constraints Followed

During the RBAC updates:

* No `migrate:fresh` was run.
* No data was deleted.
* Existing System Admin behavior was preserved while fixing other roles.
* Nurse/Vaccinator behavior was preserved while fixing Doctor and Clinic Admin.
* Doctor behavior was preserved while fixing Clinic Admin.
* Supabase remnants were not removed yet.
* Laravel remains the active backend.
* React TypeScript remains the active frontend.
* Final role keys were standardized across frontend, backend, route guards, seeders, and migrations.

---

# Current RBAC Status

| Role                 | Status |
| -------------------- | ------ |
| System Administrator | Fixed  |
| Nurse/Vaccinator     | Fixed  |
| Doctor               | Fixed  |
| Clinic Admin         | Fixed  |

RBAC/access control is now mostly completed and verified for the four final BITEMAP roles.

---
July 4, 2026
Performed a Supabase cleanup audit for BITEMAP and confirmed the active backend is Laravel API + MySQL. Identified old unused Supabase frontend files, removed confirmed dead Supabase client/auth/service code, and deleted the unused generated Supabase credential file. Verified no active frontend imports still used Supabase, then removed the unused @supabase/supabase-js dependency from the frontend package files.
Also fixed the missing frontend API client method for today’s PEP schedule alerts by adding notificationsAPI.getTodaySchedules() to the Laravel API service, using the existing backend route. Ran the frontend production build successfully to confirm the cleanup did not break the app.

**Login Page Progress Summary**

Redesigned and polished the BITEMAP login page UI while keeping all authentication logic, RBAC, routes, API calls, backend behavior, form validation, login submit behavior, and account approval behavior unchanged.

Initial improvements included applying Manrope styling to the login page, tightening spacing, updating typography, removing the duplicate “Back to Public Portal” button, and keeping only the top-header public portal button. Text was also updated to use clearer labels such as “Authorized Staff Login,” “Sign In,” and “Access depends on your assigned role.”

The design was then refined with a modern healthcare-inspired emerald/teal color palette, softer slate text, rounded inputs/buttons, a stronger primary “Sign In” button, and a secondary “Request Account Approval” button. The login page was adjusted several times to reduce vertical scrolling, improve visual hierarchy, and make the card feel more premium.

After reviewing the provided reference images, the login page was fully redesigned into a modern split-card layout. The final design includes a large centered rounded login panel, a left emerald/teal gradient branding section with BITEMAP branding and welcome text, a clean white sign-in form on the right, abstract decorative circles/dots, and a curved organic divider between the two sections. The layout remains responsive, with the branding panel hidden on smaller screens so the form stays usable.

Verification completed:
- `npm run build` passed after the login redesign.
- Desktop check confirmed the login page fits within one screen without vertical scrolling.
- Mobile sanity check confirmed the form remains usable without horizontal scrolling.
- Confirmed only one “Back to Public Portal” button remains.
- Confirmed Sign In, password visibility toggle, and Request Account Approval behavior were preserved.

**Nurse/Vaccinator Dashboard Progress Summary**

Improved the BITEMAP Nurse/Vaccinator dashboard to focus on daily clinic workflow instead of GIS or analytics. Added a nurse-specific dashboard view while keeping RBAC, authentication, routes, API calls, backend behavior, database schema, role permissions, and sidebar access rules unchanged.

The Nurse/Vaccinator dashboard now prioritizes:
- Doses Due Today
- Overdue Doses
- Patients for Follow-up
- Low Stock Items
- Today’s PEP Schedule
- Reminder Status
- Recent Incidents
- Vaccine & Supply Status
- Recent Notifications / SMS Reminders

Removed GIS/analytics-heavy content from the Nurse/Vaccinator dashboard view, including Incident Heatmap, High-Risk Areas, Bite Cases Per Barangay, GIS widgets, and Reports-related sections. These remain only outside the nurse dashboard branch for other roles where appropriate.

Polished the dashboard into a modern SaaS-style healthcare layout with soft rounded cards, light mint-gray background, white card surfaces, subtle borders, soft shadows, emerald/teal accents, improved spacing, compact empty states, and clearer visual hierarchy.

Added Plus Jakarta Sans for the nurse dashboard and sidebar shell while keeping the existing global font unchanged. Typography was refined with clearer dashboard titles, larger KPI numbers, cleaner card titles, muted descriptions, and consistent button/link styling.

Verification completed:
- `npm run build` passed.
- Confirmed Nurse/Vaccinator dashboard does not show GIS or Reports widgets.
- Confirmed no RBAC, API, backend, database, permission, route, or authentication behavior was changed.

**July 5, 2026**

## Incident Management Progress Summary

Improved the BITEMAP Incident Management module workflow and UI.

### Completed Changes

- Fixed the issue where updated incident details did not reflect in the Incident Management list after saving changes from the Edit Incident Report page.
- Updated the Edit Incident Report page to focus on incident-specific fields only.
- Made linked patient information read-only in the edit incident form.
- Added an `Open Patient Record` action so patient profile updates are handled through the Patient Registry.
- Polished the Incident Details page into a more compact clinical case summary layout.
- Replaced code-block style encoded notes with cleaner key-value clinical rows.
- Clarified the Incident Location section in both New Incident and Edit Incident forms.
- Replaced confusing map placeholder text with clearer location states such as:
  - Barangay only
  - No pin selected
  - Using approximate barangay location
  - Exact pin selected
- Renamed the location action button to `Use Barangay Location`.
- Balanced the Edit Incident Report layout by moving the WHO recommendation guide under the WHO Wound Category cards.
- Reduced unnecessary whitespace and cleaned up section headings.
- Removed duplicate Incident Management controls, including duplicate `New Incident` actions.
- Improved button and icon alignment for a more consistent UI.

### Verification

- Ran `npm run build`
- Build completed successfully.

### Result

The Incident Management module is now more consistent, clinic-friendly, and aligned with the intended BITEMAP workflow. Nurse/Vaccinator and Clinic Admin can manage incident encoding more clearly, while patient profile updates remain properly handled through the Patient Registry.


**July 7, 2026**
**UI / Design System**
- Applied broader BITEMAP UI polish inspired by the uploaded dashboard reference.
- Updated the visual direction toward a modern healthcare SaaS dashboard style.
- Improved:
  - global theme colors
  - font usage
  - sidebar styling
  - header styling
  - buttons
  - badges
  - inputs
  - stat cards
  - tables
- Polished Inventory and Patient Registry pages to better match the new style.


**July 8, 2026**
 
**Inventory Module**
- Improved the Inventory workflow for realistic clinic supply management.
- Added support for inventory batches/restocks.
- Added backend support for `inventory_batches`.
- Added batch fields such as lot number, quantity received, remaining quantity, expiry date, received date, supplier/source, and notes.
- Added Add Batch / Restock workflow.
- Added View Batches workflow.
- Improved Adjust Stock modal with:
  - current stock / new stock preview
  - transaction type
  - batch/lot affected
  - quantity
  - transaction date
  - compact notes/reason field
  - validation to prevent negative stock
- Clarified Reorder Level as the low-stock alert threshold.
- Cleaned up Inventory action buttons.
- Removed duplicate toolbar Add Batch button.
- Kept Add Item in the toolbar as the master item creation action.
- Renamed row-level Batch action to Restock.
- Updated Add Item modal wording to be more user-friendly.

**Backend / Database**
- Added an `InventoryBatch` model.
- Added `inventory_batches` migration.
- Added API routes for:
  - viewing inventory item batches
  - adding inventory batches
- Updated inventory API response to include batch data and nearest expiry information.
- Updated stock transaction handling to support batch-related adjustments.

**Migration Fix**
- Fixed failed Laravel migration:
  - `2026_07_03_000002_canonicalize_doctor_role`
- Resolved MySQL ENUM conflict caused by duplicate `doctor` / `Doctor` values.
- Updated role canonicalization to use lowercase role keys.
- Also made the clinic admin role canonicalization migration safer.
- Successfully ran `php artisan migrate`.
- Confirmed the new inventory batch migration ran successfully.


**Verification**
- Ran `npm run build` multiple times.
- Builds passed successfully.
- Ran backend route and PHP syntax checks during inventory/backend work.
- Confirmed migrations ran successfully.


**Notifications & Reminders Module**
- Converted the module to SMS-only based on project scope.
- Removed Email buttons, Email statistics, Email labels, and Email resend behavior from the Notifications UI.
- Updated Upcoming Reminders to show only `Send SMS`.
- Updated SMS statistics to show:
  - Total SMS Sent Today
  - Pending SMS
  - Sent SMS
  - Failed SMS
- Improved notification log timestamps so Pending rows no longer say `Sent`.
- Added readable timestamp labels such as Created, Sent, and Failed.
- Added SMS-focused filters: All, Pending, Sent, Failed.
- Styled Notification Log and Upcoming Reminders headers with the emerald/teal green card theme.
- Made Upcoming Reminders cleaner by limiting it to the next 5 reminders.
- Added Notification Log pagination with 10 records per page.
- Added Previous/Next page controls and page indicators.
- Made the right-side reminders/statistics column sticky on desktop.

**Verification**
- Ran `npm run build` after changes.
- Build passed successfully.
- Only the existing Vite large chunk warning appeared.

**July 9, 2026**

**Role Access / Shared RBAC**
- Audited role-based behavior across shared modules.
- Tightened shared route guards so create/edit URLs require correct action permissions.
- Preserved existing RBAC rules and did not change backend permissions.
- Kept Nurse/Vaccinator workflow unchanged.

**Dashboard**
- Polished the Clinic Admin Dashboard to match the cleaner Nurse/Vaccinator dashboard style.
- Kept Clinic Admin focused on analytics, monitoring, GIS, reports, inventory, and operations.
- Added a cleaner operations overview layout.
- Improved spacing, cards, visual hierarchy, and action links.
- Fixed high-risk barangay count consistency.

**GIS Heatmap / GIS Map**
- Made the map larger and more visually dominant.
- Moved filters, legend, and Barangay Analysis into a compact right sidebar.
- Improved responsive layout so the map stacks cleanly on smaller screens.
- Added map resize handling so Leaflet renders correctly after layout changes.
- Preserved existing GIS role access and backend data behavior.

**Reports**
- Changed report preview from a placeholder list into a real selected-report preview.
- Added report-specific summaries and preview table columns.
- Renamed “Generate From Database” to “Generate Report”.
- Moved Report Preview to the main left area.
- Moved Report Configuration to the right sidebar.
- Clarified that preview rows show only a limited sample.
- Kept PDF/Excel downloads connected to the full filtered report.
- Removed temporary “Generated Reports This Session” section.

**Header / Sidebar**
- Added notification bell for all authenticated roles.
- Kept Notifications/SMS module hidden from Doctor based on current RBAC.
- Added global search only on pages without module-specific search.
- Hid global search on pages with their own search/filter tools.
- Removed empty sidebar section labels such as “General” when no items are visible.
- Cleaned Doctor sidebar so it only shows allowed modules.

**Verification**
- Ran `npm run build` after major updates.
- Builds passed successfully.
- Existing Vite large chunk warning remains.
- No authentication, backend API, database schema, SMS workflow, inventory logic, incident workflow, or role permission rules were changed.


**July 10, 2026** 

**System Administrator**
**Dashboard**
- Created a dedicated System Administrator Dashboard focused on platform administration only.
- Added platform metrics for users, account requests, suspicious login activity, system notifications, audit activity, user distribution, system status, security overview, and quick admin actions.
- Removed clinical, patient, inventory, GIS, vaccination, and incident analytics from the System Admin dashboard.

**System Notifications**
- Redesigned System Notifications as a platform-alert module.
- Added summary cards, filters, severity indicators, notification list/table, status actions, details modal, and pagination.
- Ensured System Notifications does not show patient SMS reminders.

**Audit Log / System Activity**
- Added server-side pagination with 10 entries per page by default.
- Added page-size options, numbered pagination, debounced search, clear filters, sticky table header, and compact footer.
- Improved action labels and Asia/Manila timestamp display.
- Removed large bottom summary cards to reduce page length.
- Ensured PDF/Excel exports respect active filters and export all filtered records.

**System Settings**
- Rebuilt settings ownership for System Admin.
- System Admin now manages only platform-level settings:
  - SMS service configuration
  - SMS credential status and secure credential update modal
  - Test SMS modal
  - Security policies
  - Platform alert settings
- Removed clinic profile, reminder lead time, inventory alert preferences, and clinic operational settings from System Admin.
- Removed email/SMTP settings and government-specific placeholders.
- Hid global search on the Settings page.

**User Management**
- Hid System Admin accounts from Clinic Admin User Management.
- Updated Clinic Admin stats to count clinic-level staff only.
- Protected Clinic Admin from promoting users to System Admin.
- Added role-safe edit modal behavior and user table pagination.
- Protected self-deactivation.


**July 12, 2026** 

## 1. Staff Login Page

- Preserved the existing BITEMAP logo, GIS healthcare background, login form, authentication logic, header, footer, and responsive layout.
- Added a slow full-background pan and zoom animation.
- Ensured the entire background moves, including the GIS network design on the left.
- Added subtle floating particles, pulsing network nodes, and calm wave movement.
- Kept all animation layers behind the login card.
- Added `prefers-reduced-motion` support.
- Increased the animation speed slightly based on feedback.
- Verified that the login card remains stable and that no page overflow occurs.

## 2. Shared BITEMAP Visual System

- Extracted the finalized logo path, background path, typography, and animated GIS layers into shared reusable files.
- Created a shared animated background component used by both the Login Page and Public Portal.
- Centralized the animation keyframes, particles, network nodes, wave effects, and reduced-motion behavior.
- Eliminated duplicate background declarations and established one source of truth for the BITEMAP visual identity.

## 3. Public Portal Landing Page

- Redesigned the page to match the finalized Staff Login visual identity.
- Added the shared BITEMAP logo, Manrope typography, teal and emerald palette, animated GIS background, rounded cards, and subtle shadows.
- Replaced “Health Worker Login” with “Authorized Staff Login.”
- Added a sticky, translucent public header.
- Added a new hero section with:
  - “Track Animal Bite Trends. Find Help Faster.”
  - Incident Map and Clinic Directory buttons
  - Public-data privacy notice
- Refined the hero into an open, cinematic, centered layout without a large glass container.
- Added public summary cards with:
  - Skeleton loading
  - Empty state
  - Safe error state
  - Retry action
  - Active reporting period
- Added redesigned feature cards for:
  - Incident Heatmap
  - Statistics and Trends
  - Vaccination Clinics
- Added updated animal-bite safety guidance.
- Added “How BITEMAP Helps,” FAQ, clinic-directory preview, privacy notice, medical disclaimer, and structured footer.
- Verified desktop, tablet, and mobile responsiveness with no horizontal overflow.

## 4. Public Incident Heatmap Page

- Replaced the temporary colored rectangular tiles with an actual Leaflet and OpenStreetMap interface.
- Matched the page visually with the redesigned Public Portal.
- Added a shared public header and animated GIS introduction banner.
- Added broad reporting filters for:
  - Year
  - Month range
  - Risk classification
  - Animal type
- Prevented public reporting periods from being narrowed below three months.
- Added summary cards for:
  - Total recorded incidents
  - Barangays with recorded incidents
  - Highest reported barangay
  - PEP completion rate
- Added skeleton, empty, filtered-empty, safe error, and Retry states.
- Added a desktop side panel and mobile bottom panel for selected barangay summaries.
- Added incident rate, city comparison, risk level, common animal, reporting period, legend, and prevention guidance.
- Used broad barangay-area centers instead of individual incident coordinates.
- Added the visible privacy notice:

  “Barangay-level aggregated data only. Exact incident locations and personal patient information are not displayed.”

## 5. Public Heatmap Data Privacy and Security

- Identified that the original public heatmap endpoint exposed individual latitude and longitude values.
- Replaced the public response with server-side barangay aggregation.
- Removed patient-level coordinates, record IDs, timestamps, addresses, patient details, and treatment records from the public response.
- Added suppression for barangay results containing fewer than five incidents.
- Suppressed associated rates, animal summaries, and comparisons for small result groups.
- Added broad-filter validation to reduce re-identification risks.
- Added rate limiting to public map and statistics endpoints.
- Separated the public heatmap endpoint from the authenticated staff GIS endpoint.
- Ensured the Staff GIS page uses an authenticated `/gis/heatmap` endpoint.

## 6. Public API Error Handling

- Fixed the issue where public pages displayed raw Laravel and database exceptions.
- Prevented public exposure of:
  - SQLSTATE messages
  - Database host and port
  - Database names
  - SQL queries
  - Stack traces
  - File paths
  - Internal API details
- Added safe public messages:
  - “Unable to load map data.”
  - “Public statistics are temporarily unavailable. Please try again later.”
- Preserved Retry actions.
- Added Laravel application logging for complete server-side exceptions.
- Added sanitized JSON error envelopes with non-sensitive error codes.
- Added a global Laravel fallback for unhandled public API exceptions.
- Set `APP_DEBUG=false` in the active and example backend environments.
- Applied sanitized handling to the Public Portal, Public Heatmap, Public Statistics, and Public Clinics APIs.

## 7. Public Statistics Page

- Added a dedicated safe error state.
- Added a Retry button.
- Prevented backend exception text from reaching the page or browser console.
- Reset statistics safely when loading fails.
- Preserved the existing public statistics route and data integration.

## 8. Public Vaccination Clinics Page

- Removed all fictional and government-specific clinic records.
- Removed fake:
  - Phone numbers
  - `.gov.ph` email addresses
  - Distances
  - Operating schedules
  - Service availability
  - Free-treatment statements
  - No-appointment claims
- Redesigned the page to match the Public Portal and Heatmap design system.
- Added:
  - Shared BITEMAP header
  - Animated GIS hero
  - Neutral treatment guidance
  - Leaflet/OpenStreetMap clinic map
  - Search field
  - Barangay filter
  - Treatment-service filter
  - Immunoglobulin filter
  - Open-now filter
  - Reset action
- Added synchronized clinic-card and map-marker selection.
- Added conditional actions:
  - View on Map only when coordinates exist
  - Directions only when coordinates exist
  - Call Clinic only when a valid public number exists
- Added a responsive clinic-details modal.
- Added “Before Visiting” guidance.
- Added loading, empty, filtered-empty, safe error, and Retry states.
- Verified that the page does not calculate or display fake distances.

## 9. Public Clinic Directory Backend

- Added a dedicated `GET /api/public/clinics` endpoint.
- Added rate limiting.
- Restricted the response to allowlisted public clinic information.
- Made public clinic publishing explicitly opt-in through `clinic_public_listing_enabled`.
- Disabled public clinic publishing by default.
- Returned optional information only when stored:
  - Clinic name and type
  - General address and barangay
  - Public contact details
  - Operating hours
  - Reported services
  - Public coordinates
  - Public notes
  - Verification and update dates
- Added a sanitized clinic-directory error response:

  “Unable to load clinic information. Please try again later.”

## 10. Validation and Testing

- Successfully completed frontend production builds after the changes.
- Verified Login, Public Portal, Heatmap, and Clinics pages in the browser.
- Confirmed responsive behavior at desktop, tablet, and 390-pixel mobile widths.
- Confirmed that animated layers remain behind page content.
- Confirmed that pages do not produce horizontal overflow.
- Confirmed that public error pages do not reveal SQL, database, stack-trace, or file-path information.
- Confirmed that the new public clinic endpoint is registered.
- PHP syntax validation passed for the modified Laravel files.
- The complete Laravel test suite could not run successfully because the local PHP installation lacks the required SQLite and OpenSSL extensions. These were environment failures rather than application assertion failures.

## Overall Progress

The BITEMAP public-facing experience now follows a unified healthcare-GIS visual identity across the Staff Login, Public Portal, Incident Heatmap, Statistics, and Clinic Directory. Public data access has also been strengthened through aggregation, small-count suppression, endpoint separation, rate limiting, sanitized errors, and removal of fictional or unverified public content.

**July 13, 2026**

## Fixed incident date synchronization across Incident Management, Patient Registry, and PEP Schedule.

When the Date of Incident is updated, the system now recalculates the linked PEP schedule using Day 0, 3, 7, 14, and 28 offsets. Existing schedule records are updated without creating duplicates, while completed-dose status, administered dates, personnel, vaccine lot details, and history are preserved.

Validation was added to require a valid, non-future incident date. The update is processed atomically to prevent partially saved incident or schedule data.

Verification completed:

- Incident Management list and details display the updated date.
- Patient Registry displays the refreshed incident date and dose history.
- PEP Schedule displays all recalculated dose dates.
- No duplicate schedules were created.
- Nurse/Vaccinator update access was confirmed.
- Clinic Admin and Doctor viewing access was confirmed.
- Automated regression test passed with 16 assertions.
- Frontend production build and backend formatting checks passed.

Notification synchronization was intentionally excluded and remains a separate task.

**July 14, 2026**

Incident Management

- Fixed Incident Date corrections so updated dates remain synchronized across Incident Management, Patient Registry, Incident Details, and PEP Schedule.
- Preserved completed vaccination records and administration history during date recalculation.
- Added regression coverage for incident-date and PEP schedule synchronization.

PEP Schedule

- Fixed “Open PEP Schedule” deep-linking so the correct patient and incident schedule is automatically selected.
- Added proper Due Today, Overdue, and Completed Late handling.
- Added staff actions for recording late doses, sending reminders, and manually rescheduling overdue doses.
- Ensured rescheduling affects only the selected dose and does not automatically move future doses.
- Added overdue follow-up messaging and updated compliance and next-dose summaries.
- Preserved existing role permissions and schedule features.

Incident Location

- Replaced the location placeholder with a functional Leaflet map for New and Edit Incident Reports.
- Barangay selection now centers the map and supports barangay-only reporting.
- Added optional exact latitude and longitude selection through the map.
- Added a safer pin confirmation workflow:
  - Map clicks create a temporary review marker.
  - Confirm Pin finalizes the coordinates.
  - Cancel Pin removes the temporary selection.
  - Existing confirmed pins remain unchanged until a replacement is confirmed.
  - Changing barangay resets the pin and returns to barangay-only status.
- Simplified the location UI and preserved location data in Incident Details, GIS Map, and reports.

Verification

- Frontend production builds completed successfully.
- PHP syntax and route checks passed.
- Regression tests passed, including incident-date synchronization, PEP overdue workflows, and location persistence.
- New and Edit Incident Report workflows were tested in the running application.