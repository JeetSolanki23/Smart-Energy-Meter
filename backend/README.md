# Smart Energy Meter Backend

Production-ready FastAPI backend for IoT smart energy metering with PostgreSQL, Redis, Celery, and Razorpay.

## Quick Start (.venv)

1. Create and activate virtual environment.
2. Install dependencies.
3. Copy `.env.example` to `.env` and edit values.
4. Start infrastructure (PostgreSQL + Redis) using Docker Compose.
5. Run API and Celery worker.

### Commands (PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
docker compose up -d postgres redis
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal:

```powershell
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app worker -l info
```

Windows note:

```powershell
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app worker -P solo --concurrency=1 -l info
```

Use `-P solo` on Windows to avoid `billiard` spawn errors like `WinError 5/6`.

In a third terminal (scheduler):

```powershell
.\.venv\Scripts\Activate.ps1
celery -A app.workers.celery_app.celery_app beat -l info
```

## API docs

- Swagger: `http://localhost:8000/docs`
- OpenAPI: `http://localhost:8000/openapi.json`

## Project Documentation

- `DOCUMENTATION.md` for architecture, setup, security, billing, and operations.
- `ENDPOINTS_WORKFLOW.md` for endpoint-by-endpoint reference and workflows.

## Test

```powershell
.\.venv\Scripts\Activate.ps1
pytest -q
```

## Email Notifications (Gmail)

The backend supports branded HTML email notifications for:

1. Tamper detection
2. New bill generation
3. Payment success

Update `.env` with SMTP values (see `.env.example`):

```powershell
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail_address@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_gmail_address@gmail.com
SMTP_FROM_NAME=Smart Energy Meter
SMTP_USE_TLS=true
SMTP_USE_SSL=false
ALERT_EMAIL_TO=admin1@example.com,admin2@example.com
```

Notes:

1. Gmail requires an App Password (2FA enabled), not your normal account password.
2. Recipients include owner + `ALERT_EMAIL_TO` list for tamper, bill-generated, and payment-success notifications.
