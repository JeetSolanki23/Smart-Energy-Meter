from app.db.session import SessionLocal
from app.services.billing_service import (
    aggregate_daily_usage,
    generate_monthly_bills,
    mark_overdue_bills,
)
from app.workers.celery_app import celery_app


@celery_app.task(name="aggregate_daily_usage")
def aggregate_daily_usage_task() -> int:
    db = SessionLocal()
    try:
        return aggregate_daily_usage(db)
    finally:
        db.close()


@celery_app.task(name="generate_monthly_bills")
def generate_monthly_bills_task() -> int:
    db = SessionLocal()
    try:
        return generate_monthly_bills(db)
    finally:
        db.close()


@celery_app.task(name="check_unpaid_bills")
def check_unpaid_bills_task() -> int:
    db = SessionLocal()
    try:
        return mark_overdue_bills(db)
    finally:
        db.close()
