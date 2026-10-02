# BITEMAP

**A GIS-Based Animal Bite Incident Tracking and Anti-Rabies Vaccination Monitoring System**

BITEMAP is a web-based information system designed to help animal bite treatment personnel organize patient records, track bite incidents, monitor post-exposure prophylaxis (PEP) schedules, manage vaccine inventory, and review barangay-level incident patterns through GIS-based visualization.

> **Project status:** Core modules are implemented and under continued testing, validation, and refinement for academic capstone use.

## Technology Stack

### Frontend
- React 18, TypeScript, Vite, Tailwind CSS, Leaflet

### Backend
- PHP 8.5+, Laravel 13, MariaDB 10.11, Twilio SDK

### Local Development
- Fully containerized using Docker and Docker Compose

---

## Developer / Tester Setup Guide

The entire BITEMAP application is containerized to ensure reproducibility across different machines without needing to install PHP, Composer, Node.js, or MariaDB natively on your host.

### Prerequisites

1. **Install Docker Desktop** (Make sure WSL 2 is enabled on Windows).
2. **Git** (to clone the repository).

### 1. First-Time Setup

**Clone the repository:**
`ash
git clone https://github.com/4shLee/BITEMAPOFFICIAL.git
cd BITEMAPOFFICIAL
`

**Configure the environment:**
Create your .env.docker file from the example template:
`ash
cp .env.docker.example .env.docker
`
*Note: You can leave the default development credentials in .env.docker as they are pre-configured to work out of the box with the Docker containers.*

**Start the environment:**
Start all containers in the background and build the images.
`ash
docker compose up -d --build
`

**Initialize the Backend:**
Because the host directories are mounted for live-reloading, a fresh clone won't have the endor dependencies yet. Install them and set up the database:
`ash
# Install PHP dependencies inside the backend container
docker exec bitemap-backend composer install

# Run database migrations
docker exec bitemap-backend php artisan migrate

# Optional: Seed the database with demo data
docker exec bitemap-backend php artisan db:seed --class=DemoDataSeeder
`

**Access the application:**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api

*(The frontend container automatically installs npm packages and runs the Vite dev server with hot-reload).*

---

### 2. Normal Daily Development

To start working on the project on a daily basis:

**Start the environment:**
`ash
docker compose up -d
`
You can now edit React code in rontend/src/ or Laravel code in ackend/app/ and the changes will automatically reflect in the browser.

**Stop the environment:**
When you are done for the day:
`ash
docker compose stop
`

---

### 3. Rebuilding After Dependency Changes

If another developer adds new Composer packages or changes the Dockerfiles, you need to rebuild and update:

`ash
# Rebuild the Docker images
docker compose up -d --build

# Update PHP dependencies
docker exec bitemap-backend composer install
`

If you ever need to completely wipe your local database and start fresh:
`ash
docker compose down -v
docker compose up -d
docker exec bitemap-backend php artisan migrate:fresh --seed
`

---

## Security Notes
* Never commit .env.docker or ackend/.env.
* Ensure real Twilio SMS credentials are NOT placed in .env.docker.example.
* Do not use real patient information in development or demonstration data.

