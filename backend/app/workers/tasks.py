from datetime import UTC, date, datetime, timedelta

from app.db.session import SessionLocal
from app.services.billing_service import (
    aggregate_daily_usage,
    generate_monthly_bills,
    mark_overdue_bills,
)
from app.workers.celery_app import celery_app


@celery_app.task(name="aggregate_daily_usage")
def aggregate_daily_usage_task(target_date_iso: str | None = None) -> int:
    db = SessionLocal()
    try:
        # Runs at 00:05 UTC, so default target is previous day.
        target_day = (
            date.fromisoformat(target_date_iso)
            if target_date_iso
            else (datetime.now(UTC) - timedelta(days=1)).date()
        )
        return aggregate_daily_usage(db, target_date=target_day)
    finally:
        db.close()


@celery_app.task(name="generate_monthly_bills")
def generate_monthly_bills_task(month_start_iso: str | None = None) -> int:
    db = SessionLocal()
    try:
        month_start = date.fromisoformat(month_start_iso) if month_start_iso else None
        return generate_monthly_bills(db, month_start=month_start)
    finally:
        db.close()


@celery_app.task(name="check_unpaid_bills")
def check_unpaid_bills_task() -> int:
    db = SessionLocal()
    try:
        return mark_overdue_bills(db)
    finally:
        db.close()
