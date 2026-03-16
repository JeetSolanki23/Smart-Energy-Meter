from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.bill import Bill
from app.models.daily_usage import DailyUsage
from app.models.device import Device
from app.models.energy_reading import EnergyReading
from app.models.enums import BillStatus

settings = get_settings()


def aggregate_daily_usage(db: Session, target_date: date | None = None) -> int:
    day = target_date or datetime.now(UTC).date()
    start_dt = datetime.combine(day, datetime.min.time(), tzinfo=UTC)
    end_dt = start_dt + timedelta(days=1)

    rows = (
        db.query(EnergyReading.device_id, func.sum(EnergyReading.energy).label("units"))
        .filter(EnergyReading.timestamp >= start_dt, EnergyReading.timestamp < end_dt)
        .group_by(EnergyReading.device_id)
        .all()
    )

    processed = 0
    for device_id, units in rows:
        daily = (
            db.query(DailyUsage)
            .filter(DailyUsage.device_id == device_id, DailyUsage.date == day)
            .first()
        )
        if daily:
            daily.units_consumed = float(units or 0.0)
        else:
            db.add(DailyUsage(device_id=device_id, date=day, units_consumed=float(units or 0.0)))
        processed += 1

    db.commit()
    return processed


def generate_monthly_bills(db: Session, month_start: date | None = None) -> int:
    today = datetime.now(UTC).date()
    first_day = month_start or today.replace(day=1)
    next_month = (first_day.replace(day=28) + timedelta(days=4)).replace(day=1)

    rows = (
        db.query(Device.user_id, func.sum(DailyUsage.units_consumed).label("units"))
        .join(Device, Device.id == DailyUsage.device_id)
        .filter(DailyUsage.date >= first_day, DailyUsage.date < next_month)
        .group_by(Device.user_id)
        .all()
    )

    count = 0
    for user_id, units in rows:
        existing = db.query(Bill).filter(Bill.user_id == user_id, Bill.month == first_day).first()
        if existing:
            continue
        bill = Bill(
            user_id=UUID(str(user_id)),
            month=first_day,
            units=float(units or 0.0),
            amount=float(units or 0.0) * settings.PRICE_PER_UNIT,
            due_date=first_day + timedelta(days=15),
            status=BillStatus.UNPAID,
        )
        db.add(bill)
        count += 1

    db.commit()
    return count


def mark_overdue_bills(db: Session, today: date | None = None) -> int:
    current = today or datetime.now(UTC).date()
    bills = (
        db.query(Bill)
        .filter(Bill.status == BillStatus.UNPAID, Bill.due_date < current)
        .all()
    )
    for bill in bills:
        bill.status = BillStatus.OVERDUE

    db.commit()
    return len(bills)
