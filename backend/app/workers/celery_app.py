import os

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "smart_energy_meter",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        # Every day at 00:05 UTC: aggregate previous day's usage snapshots.
        "aggregate-daily-usage": {
            "task": "aggregate_daily_usage",
            "schedule": crontab(hour=0, minute=5),
        },
        # Every month on day 1 at 00:10 UTC: generate monthly bills.
        "generate-monthly-bills": {
            "task": "generate_monthly_bills",
            "schedule": crontab(day_of_month=1, hour=0, minute=10),
        },
        # Every day at 01:00 UTC: mark unpaid bills as overdue.
        "check-unpaid-bills": {
            "task": "check_unpaid_bills",
            "schedule": crontab(hour=1, minute=0),
        },
    },
)

# Windows does not reliably support Celery's default prefork pool (billiard).
# Force a safe worker mode to avoid WinError 5/6 spawn crashes.
if os.name == "nt":
    celery_app.conf.worker_pool = "solo"
    celery_app.conf.worker_concurrency = 1

celery_app.autodiscover_tasks(["app.workers"])
