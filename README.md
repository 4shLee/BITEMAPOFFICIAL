# BITEMAP

**A GIS-Based Animal Bite Incident Tracking and Anti-Rabies Vaccination Monitoring System**

BITEMAP is a web-based information system designed to help animal bite treatment personnel organize patient records, track bite incidents, monitor post-exposure prophylaxis (PEP) schedules, manage vaccine inventory, and review barangay-level incident patterns through GIS-based visualization.

> **Project status:** Core modules are implemented and under continued testing, validation, and refinement for academic capstone use.

## Key Features

- **Patient Registry** — structured patient profiles, contact details, residence information, SMS consent, search, filters, and server-side pagination.
- **Incident Management** — animal bite records, WHO exposure classification, incident status, location details, and patient linkage.
- **PEP Schedule Monitoring** — Day 0, 3, 7, 14, and 28 schedules, dose recording, overdue monitoring, missed appointments, and rescheduling.
- **Notifications and Reminders** — due-today and overdue alerts, reminder history, duplicate protection, SMS simulation mode, and optional Twilio delivery.
- **GIS Monitoring** — barangay-level incident mapping and hotspot visualization using Leaflet.
- **Vaccine Inventory** — vaccine items, batch and lot tracking, expiry dates, stock transactions, and low-stock monitoring.
- **Reports and Analytics** — incident, vaccination, compliance, inventory, and barangay-level reports.
- **Role-Based Access Control** — separate permissions for system administrators, clinic administrators, doctors, and nurse/vaccinators.
- **Public Portal** — clinic information, public statistics, heatmap views, and clinic locator features.
- **Audit Logging** — records sensitive actions such as account approval, role changes, exports, and deletions.

## User Roles

| Role | Main responsibilities |
|---|---|
| `system_admin` | System settings, SMS credentials, user administration, and audit logs |
| `clinic_admin` | Clinic operations, account approval, incident and patient management, inventory, and settings |
| `doctor` | Patient and incident review, dashboard access, and reports |
| `nurse_vaccinator` | Patient registration, incident entry, PEP dose recording, reminders, and inventory usage |

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Material UI and Radix UI components
- Leaflet and Leaflet Heat
- Recharts

### Backend

- PHP 8.3+
- Laravel 13
- Laravel Sanctum
- MariaDB 10.11
- Twilio SDK
- PHPUnit

### Local Development

- Docker Desktop with Docker Compose
- MariaDB container with a persistent named volume

## Project Structure

```text
BITEMAPOFFICIAL/
├── backend/                  # Laravel API, migrations, models, tests, and seeders
├── frontend/                 # React and Vite frontend
├── docker-compose.yml        # Local MariaDB service
├── .env.docker.example       # Docker environment template
├── PROGRESS_LOG.md           # Development progress history
└── README.md
````

## Prerequisites

Install the following before running the project:

* Git
* PHP 8.3 or later
* Composer
* Node.js and npm
* Docker Desktop with Docker Compose

On Windows, Docker Desktop uses the WSL 2 backend.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/4shLee/BITEMAPOFFICIAL.git
cd BITEMAPOFFICIAL
```

### 2. Configure Docker MariaDB

Create a private `.env.docker` file in the project root using `.env.docker.example` as the template:

```env
MARIADB_ROOT_PASSWORD=your_private_root_password
MARIADB_DATABASE=bitemap_db
MARIADB_USER=bitemap
MARIADB_PASSWORD=your_private_database_password
```

Do not commit `.env.docker`.

Start MariaDB:

```bash
docker compose up -d
```

Confirm that the container is healthy:

```bash
docker compose ps
```

The local database is exposed on port `3307`.

### 3. Configure the Laravel backend

```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
```

For macOS or Linux, replace `copy` with `cp`.

Update the database section of `backend/.env`:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=bitemap_db
DB_USERNAME=bitemap
DB_PASSWORD=the_same_password_from_env_docker
```

Then run:

```bash
php artisan config:clear
php artisan migrate
```

### 4. Install frontend dependencies

```bash
cd ../frontend
npm install
```

## Running the System

Ensure Docker Desktop is running and the MariaDB container is healthy.

From the project root:

```bash
docker compose up -d
```

Start the backend in one terminal:

```bash
cd backend
php artisan serve
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

The frontend uses the API base URL configured through `VITE_API_BASE_URL`. When not provided, it defaults to:

```text
http://127.0.0.1:8000/api
```

## Demo Data

A dedicated idempotent demo seeder is available for local development and capstone demonstrations.

```bash
cd backend
php artisan db:seed --class=DemoDataSeeder
```

The seeder creates clearly fictional users, patients, incidents, PEP schedules, inventory records, transactions, and reminders. Running it repeatedly should not duplicate the demo dataset.

Do not use demo data in a real clinic environment.

## Testing and Verification

### Backend

```bash
cd backend
php artisan test
vendor/bin/pint --test
```

### Frontend

```bash
cd frontend
npx tsc --noEmit
npx eslint src
npm test
npm run build
```

### Git checks

```bash
git diff --check
```

## Docker Commands

```bash
# Start or confirm the database service
docker compose up -d

# Check status
docker compose ps

# View MariaDB logs
docker compose logs --tail=100 mariadb

# Stop the database without deleting data
docker compose stop

# Restart MariaDB
docker compose restart mariadb

# Remove the container while preserving the named volume
docker compose down
```

> Do not run `docker compose down -v` unless you intentionally want to delete the local database volume.

## Security Notes

* Never commit `backend/.env` or `.env.docker`.
* Use strong local database and administrator passwords.
* Replace all default or demonstration credentials before deployment.
* Keep SMS credentials outside source control.
* Do not use real patient information in development or demonstration data.
* The public repository is intended for academic development and should not be treated as a production deployment without a complete security, privacy, infrastructure, and clinical workflow review.

## Development Status

The project currently includes implemented core workflows with ongoing work focused on:

* workflow validation;
* bug fixing and refinement;
* user acceptance testing;
* pilot testing;
* deployment preparation;
* final documentation.

See [`PROGRESS_LOG.md`](PROGRESS_LOG.md) for the detailed development history.

## Contributors

* Vict Christine De Asis
* Ashlee Nicole Rivera
* Geraldene Cabiles

## Academic Context

BITEMAP is developed as an Information Technology capstone project focused on improving the organization, monitoring, and reporting of animal bite incidents and anti-rabies vaccination workflows in Digos City.


