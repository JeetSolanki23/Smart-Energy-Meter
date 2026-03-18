from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, UTC

from app.core.deps import get_current_user, get_db_session
from app.models.bill import Bill
from app.models.daily_usage import DailyUsage
from app.models.device import Device
from app.models.energy_reading import EnergyReading
from app.models.user import User
from app.schemas.billing import BillResponse
from app.schemas.pricing import PricingResponse
from app.services.pricing_service import get_current_price
from app.services.runtime_config_service import get_device_data_interval_seconds

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/pricing", response_model=PricingResponse)
def get_pricing(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> PricingResponse:
    _ = current_user
    return PricingResponse(price_per_unit=get_current_price(db))


@router.get("/usage")
def get_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> dict:
    """Get current month usage across all user's devices from raw readings."""
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_units = (
        db.query(func.coalesce(func.sum(EnergyReading.energy), 0.0))
        .join(Device, Device.id == EnergyReading.device_id)
        .filter(Device.user_id == current_user.id, EnergyReading.timestamp >= month_start)
        .scalar()
    )
    return {"total_units": float(total_units or 0.0)}


@router.get("/usage/daily")
def get_daily_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> list[dict]:
    """Get daily usage for last 7 days - for dashboard chart"""
    today = datetime.now(UTC).date()
    seven_days_ago = today - timedelta(days=6)
    
    rows = (
        db.query(DailyUsage.date, func.sum(DailyUsage.units_consumed).label("units"))
        .join(Device, Device.id == DailyUsage.device_id)
        .filter(Device.user_id == current_user.id, DailyUsage.date >= seven_days_ago)
        .group_by(DailyUsage.date)
        .order_by(DailyUsage.date)
        .all()
    )
    
    # Map to day names
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    result = []
    for date_obj, units in rows:
        day_index = date_obj.weekday()
        result.append({
            "day": day_names[day_index],
            "date": str(date_obj),
            "units": float(units or 0.0)
        })
    
    return result


@router.get("/usage/hourly")
def get_hourly_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    hours: int = Query(default=24, ge=1, le=168),
) -> list[dict]:
    """Get hourly usage buckets for recent history (default 24h)."""
    since = datetime.now(UTC) - timedelta(hours=hours)
    hour_bucket = func.date_trunc("hour", EnergyReading.timestamp)

    rows = (
        db.query(hour_bucket.label("bucket"), func.coalesce(func.sum(EnergyReading.energy), 0.0).label("units"))
        .join(Device, Device.id == EnergyReading.device_id)
        .filter(Device.user_id == current_user.id, EnergyReading.timestamp >= since)
        .group_by(hour_bucket)
        .order_by(hour_bucket)
        .all()
    )

    result = []
    for bucket_dt, units in rows:
        result.append(
            {
                "hour": bucket_dt.strftime("%H:%M"),
                "timestamp": bucket_dt.isoformat(),
                "units": float(units or 0.0),
            }
        )

    return result


@router.get("/usage/live")
def get_live_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    minutes: int = Query(default=60, ge=1, le=180),
) -> dict:
    """Get minute-level power trend and current total power for near-real-time dashboard view."""
    now = datetime.now(UTC)
    since = now - timedelta(minutes=minutes)
    minute_bucket = func.date_trunc("minute", EnergyReading.timestamp)

    trend_rows = (
        db.query(minute_bucket.label("bucket"), func.coalesce(func.avg(EnergyReading.power), 0.0).label("power"))
        .join(Device, Device.id == EnergyReading.device_id)
        .filter(Device.user_id == current_user.id, EnergyReading.timestamp >= since)
        .group_by(minute_bucket)
        .order_by(minute_bucket)
        .all()
    )

    current_window_start = now - timedelta(minutes=5)
    current_power, last_seen_at = (
        db.query(
            func.coalesce(func.avg(EnergyReading.power), 0.0),
            func.max(EnergyReading.timestamp),
        )
        .join(Device, Device.id == EnergyReading.device_id)
        .filter(Device.user_id == current_user.id, EnergyReading.timestamp >= current_window_start)
        .first()
    )

    series = []
    for bucket_dt, power in trend_rows:
        series.append(
            {
                "time": bucket_dt.strftime("%H:%M"),
                "timestamp": bucket_dt.isoformat(),
                "power": float(power or 0.0),
            }
        )

    return {
        "current_power": float(current_power or 0.0),
        "last_reading_at": last_seen_at.isoformat() if last_seen_at else None,
        "series": series,
    }


@router.get("/devices/usage")
def get_devices_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> list[dict]:
    """Get per-device usage breakdown"""
    interval_seconds = get_device_data_interval_seconds(db)
    offline_cutoff = datetime.now(UTC) - timedelta(seconds=interval_seconds * 2)

    latest_readings = (
        db.query(EnergyReading.device_id, func.max(EnergyReading.timestamp).label("last_seen_at"))
        .group_by(EnergyReading.device_id)
        .all()
    )
    last_seen_map = {str(row.device_id): row.last_seen_at for row in latest_readings}

    devices = db.query(Device).filter(Device.user_id == current_user.id).all()
    
    result = []
    for device in devices:
        total_units = (
            db.query(func.coalesce(func.sum(DailyUsage.units_consumed), 0.0))
            .filter(DailyUsage.device_id == device.id)
            .scalar()
        )
        last_seen_at = last_seen_map.get(str(device.id))
        is_offline = bool(last_seen_at and last_seen_at < offline_cutoff)
        health_status = "TAMPERED" if device.tampered else ("OFFLINE" if is_offline else "GOOD")

        result.append({
            "device_id": device.device_id,
            "device_uid": device.device_uid,
            "location": device.location,
            "status": device.status.value,
            "total_units": float(total_units or 0.0),
            "tampered": device.tampered,
            "health_status": health_status,
            "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
        })
    
    return result


@router.get("/bills", response_model=list[BillResponse])
def get_bills(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> list[BillResponse]:
    bills = db.query(Bill).filter(Bill.user_id == current_user.id).order_by(Bill.month.desc()).all()
    return [
        BillResponse(
            bill_id=b.id,
            month=b.month,
            units=b.units,
            amount=b.amount,
            status=b.status.value,
            due_date=b.due_date,
        )
        for b in bills
    ]
