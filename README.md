# Smart Energy Meter

Smart Energy Meter is a full-stack IoT platform for monitoring electricity usage, managing device health, controlling relay power remotely, and handling monthly billing with payment collection.

The project is designed around three connected layers:

- IoT firmware running on ESP32 meters (INA219 sensing + relay control)
- Backend platform for ingestion, auth, billing, and business logic
- Frontend dashboards for Admin and User operations

This README is the top-level onboarding guide for the entire repository.

## What Problem This Project Solves

Traditional meter data is often delayed, manual, or inaccessible for end users. This platform solves that by providing:

- near real-time usage visibility
- device lifecycle controls from admin panel
- tamper detection and safety lock behavior
- automated monthly billing
- payment tracking and reconciliation

## System Overview

High-level runtime flow:

1. ESP32 device pairs with backend using short-lived pair code.
2. Admin binds device to a user and activates the meter.
3. Device posts telemetry periodically.
4. Backend stores readings, evaluates health/tamper, and updates usage summaries.
5. Celery jobs generate monthly bills and overdue states.
6. User pays bill through Razorpay flow.
7. Frontend dashboards visualize usage, billing, and device status.

## Architecture

```text
ESP32 Meter (INA219 + Relay)
	|
	| HTTPS REST
	v
FastAPI Backend
  |- PostgreSQL (primary data)
  |- Redis (cache + broker)
  |- Celery Worker (scheduled/background jobs)
  |- Razorpay (payment gateway)
	|
	v
React Frontend (Admin + User dashboards)
```

## Core Features

### Device Lifecycle and Security

- pair code onboarding with Redis TTL
- role-based admin actions (register, activate, deactivate, remove, recover)
- device authentication via bearer `device_secret`
- relay command queue and polling model
- tamper-triggered safety behavior (deactivate + relay lock OFF)

### Energy Monitoring

- periodic ingestion of voltage/current/power/energy payloads
- per-user and per-device usage aggregations
- daily/hourly/live usage endpoints for dashboard visualizations
- offline and health status computed from latest telemetry timestamps

### Billing and Payments

- daily aggregation jobs
- monthly bill generation with dynamic pricing support
- overdue bill detection job
- Razorpay order creation and webhook verification
- prototype synchronous finalize endpoint for development/testing workflows

### Operations and Reliability

- structured logging (JSON)
- health endpoint and Prometheus instrumentation
- Docker-based local infra for PostgreSQL and Redis
- backend tests + linting + CI pipeline

## Repository Layout

- [backend/](backend/): FastAPI API, domain models, services, worker tasks, backend docs
- [frontend/](frontend/): React + Vite web app for Admin/User experiences
- [firmware/](firmware/): ESP32 firmware and firmware-specific notes
- [backend.md](backend.md): backend technical specification baseline
- [IoT Hardware.md](IoT%20Hardware.md): hardware and firmware architecture notes

## Detailed Module Pointers

- Backend app entry: [backend/app/main.py](backend/app/main.py)
- API routes: [backend/app/api/routes/](backend/app/api/routes)
- Domain models: [backend/app/models/](backend/app/models)
- Business services: [backend/app/services/](backend/app/services)
- Worker tasks: [backend/app/workers/tasks.py](backend/app/workers/tasks.py)
- Endpoint reference: [backend/ENDPOINTS_WORKFLOW.md](backend/ENDPOINTS_WORKFLOW.md)
- Backend operations doc: [backend/DOCUMENTATION.md](backend/DOCUMENTATION.md)

## Quick Start (Local Development)

Prerequisites:

- Python 3.12+
- Node.js 18+
- Docker Desktop
- Git

### 1. Clone and enter repo

```powershell
git clone <your-repo-url>
cd "Smart Energy Meter"
```

### 2. Start backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
docker compose up -d postgres redis
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:

- Swagger: http://localhost:8000/docs
- OpenAPI: http://localhost:8000/openapi.json
- Health: http://localhost:8000/health

### 3. Start worker

Open a new terminal:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app worker -l info
```

### 4. Start frontend

Open another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL is typically shown by Vite (commonly http://localhost:5173).

### 5. Firmware setup

Open [firmware/SmartEnergyMeter_ESP32/](firmware/SmartEnergyMeter_ESP32) in Arduino IDE or PlatformIO, configure device network/server constants, and flash to ESP32.

## Configuration and Environment

Backend reads configuration from `.env` (see [backend/.env.example](backend/.env.example)).

Important groups:

- app and JWT settings
- PostgreSQL connection settings
- Redis and Celery broker settings
- Razorpay key and webhook secret
- runtime defaults for pair TTL, polling interval, and pricing

Do not commit real secrets to git.

## Current API Domains

Main backend route groups:

- `/api/v1/auth/*` for user/admin auth
- `/api/v1/admin/*` for admin controls and runtime settings
- `/api/v1/device/*` for device pairing, activation, telemetry, and commands
- `/api/v1/user/*` for usage, bills, and user-facing data
- `/api/v1/payment/*` for order creation, finalize, and webhook handling

For complete endpoint payloads and workflow diagrams, see [backend/ENDPOINTS_WORKFLOW.md](backend/ENDPOINTS_WORKFLOW.md).

## Typical End-to-End Flow

1. Admin account is created and logged in.
2. User account is created and linked to a new meter.
3. Device displays pair code from pair-init call.
4. Admin registers/activates device.
5. Device fetches credentials and starts telemetry.
6. User dashboard begins showing usage charts.
7. Monthly billing runs via worker tasks.
8. User pays bill; bill status transitions to paid.

## Testing and Quality

Backend checks:

```powershell
cd backend
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend checks (if configured):

```powershell
cd frontend
npm run lint
```

## Production Readiness Notes

Before deploying to production, ensure:

- strong secret management (vault or environment injection)
- HTTPS termination and strict CORS policy
- database backups and migration strategy
- worker scheduling and retry policies
- monitoring and alerting for API/worker/device health
- API rate limiting and audit trails for admin actions

## Troubleshooting Quick Guide

### Backend starts but APIs fail

- verify PostgreSQL and Redis containers are healthy
- verify backend `.env` values

### Device cannot pair/register

- confirm Redis is running
- check pair code has not expired

### Device shows offline unexpectedly

- verify telemetry ingestion intervals
- check runtime polling interval configuration in admin settings

### Payment not updating bill status

- validate Razorpay webhook signature configuration
- use finalize endpoint in development if webhook is not configured

## Documentation Index

- Backend deep documentation: [backend/DOCUMENTATION.md](backend/DOCUMENTATION.md)
- Endpoint and workflow guide: [backend/ENDPOINTS_WORKFLOW.md](backend/ENDPOINTS_WORKFLOW.md)
- Backend setup notes: [backend/README.md](backend/README.md)
- Frontend setup notes: [frontend/README.md](frontend/README.md)
- Hardware/firmware doc: [IoT Hardware.md](IoT%20Hardware.md)
