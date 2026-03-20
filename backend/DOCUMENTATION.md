# Smart Energy Meter Backend Documentation

## 1. Purpose

This document is the backend reference for developers and operators.

It covers:

- architecture and folder structure
- local setup with `.venv`
- auth and security model
- device lifecycle and telemetry behavior
- billing and payment processing
- background jobs and operations guidance

## 2. Tech Stack

- Python 3.12
- FastAPI + Uvicorn
- SQLAlchemy 2
- PostgreSQL
- Redis
- Celery
- Razorpay
- Prometheus metrics
- structlog JSON logging

## 3. Project Structure

```text
backend/
  app/
    api/routes/
      auth.py
      admin.py
      device.py
      user.py
      payment.py
    core/
      config.py
      deps.py
      logging.py
      security.py
    db/
      base.py
      session.py
    models/
      admin.py
      user.py
      device.py
      energy_reading.py
      daily_usage.py
      bill.py
      payment.py
      tamper_log.py
      pricing.py
      runtime_config.py
    schemas/
    services/
    workers/
      celery_app.py
      tasks.py
    main.py
  tests/
  DOCUMENTATION.md
  ENDPOINTS_WORKFLOW.md
  README.md
```

## 4. Local Setup (.venv)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Start infra:

```powershell
docker compose up -d postgres redis
```

Run API:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run worker (second terminal):

```powershell
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app worker -l info
```

## 5. Security Model

### User and Admin auth

- JWT role claim is used for authorization (`role=user` or `role=admin`).
- Auth routes:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/admin/register`
  - `POST /api/v1/auth/admin/login`

### Device auth

- Devices use `Authorization: Bearer <device_secret>`.
- Protected device routes:
  - `POST /api/v1/device/data`
  - `GET /api/v1/device/command`

## 6. Core Domain Behavior

### Device lifecycle

States:

- `PENDING_ACTIVATION`
- `ACTIVE`
- `DEACTIVATED`
- `REMOVED`

Lifecycle control routes are under `/api/v1/admin/device/*`.

### Tamper protection

When incoming telemetry has `tamper=true`:

- device is marked tampered
- status becomes `DEACTIVATED`
- relay is forced OFF
- pending relay command is cleared
- tamper log is inserted

A tampered device cannot be activated or relay-controlled until recovered.

### Recovery flow

Admin can recover using:

- `POST /api/v1/admin/device/recover`

Recovery clears tamper lock, sets device to `ACTIVE`, and keeps relay OFF for safety.

### Offline status

Device offline/health is computed from last telemetry time compared to runtime polling interval.

## 7. Runtime Configuration

The backend supports dynamic runtime config stored in DB:

- Pricing per unit
- Device polling interval (seconds)

Admin routes:

- `GET /api/v1/admin/pricing`
- `PUT /api/v1/admin/pricing`
- `GET /api/v1/admin/device-interval`
- `PUT /api/v1/admin/device-interval`

User route:

- `GET /api/v1/user/pricing`

## 8. Billing and Payments

### Billing

Background tasks:

- `aggregate_daily_usage`
- `generate_monthly_bills`
- `check_unpaid_bills`

Schedule behavior:

- Daily aggregation at 00:05 UTC processes the previous day.
- Monthly bill generation on day 1 produces bills for the previous month.

Manual admin triggers (for testing/ops):

- `POST /api/v1/admin/jobs/aggregate-daily-usage`
- `POST /api/v1/admin/jobs/generate-monthly-bills`
- `POST /api/v1/admin/jobs/check-unpaid-bills`
- `GET /api/v1/admin/jobs/{task_id}`

Manual trigger behavior:

- Aggregate job targets latest telemetry date (fallback: current date).
- Generate bills job targets month of latest `daily_usage` date (fallback: current month).

Monthly bill amount uses current dynamic pricing from `pricing` table.

### Payments

Routes:

- `POST /api/v1/payment/create`
- `POST /api/v1/payment/finalize`
- `POST /api/v1/payment/webhook`

`/finalize` supports synchronous prototype completion without waiting for webhook.
`/webhook` validates `X-Razorpay-Signature` using HMAC SHA256.

## 9. Observability

- Health: `GET /health`
- Swagger: `/docs`
- OpenAPI: `/openapi.json`
- Prometheus metrics via instrumentator middleware

## 10. Testing

```powershell
.\.venv\Scripts\python.exe -m ruff check app tests
.\.venv\Scripts\python.exe -m pytest -q
```

## 11. Troubleshooting

### Device command always OFF

- Device may be tampered and relay lock is active.
- Check admin recover flow.

### Device appears offline

- Verify telemetry posts are arriving.
- Verify runtime device interval (`/admin/device-interval`).

### Bills use unexpected amount

- Check current dynamic pricing (`/admin/pricing`).

### Payment not reflecting

- Use `/payment/finalize` for prototype flow.
- For webhook flow, verify `RAZORPAY_WEBHOOK_SECRET`.
