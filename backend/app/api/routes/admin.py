from datetime import UTC, date, datetime, timedelta

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db_session
from app.models.device import Device
from app.models.daily_usage import DailyUsage
from app.models.energy_reading import EnergyReading
from app.models.bill import Bill
from app.models.enums import BillStatus, DeviceStatus
from app.models.user import User
from app.schemas.pricing import PricingResponse, PricingUpdateRequest
from app.schemas.runtime_config import RuntimeConfigResponse, RuntimeConfigUpdateRequest
from app.schemas.device import (
    AdminActivateDeviceRequest,
    AdminRegisterDeviceRequest,
    AdminRelayRequest,
)
from app.services.pricing_service import get_current_price, set_current_price
from app.services.runtime_config_service import get_device_data_interval_seconds, set_device_data_interval_seconds
from app.services.device_service import consume_pair_code, generate_device_identity
from app.workers.celery_app import celery_app
from app.workers.tasks import (
    aggregate_daily_usage_task,
    check_unpaid_bills_task,
    generate_monthly_bills_task,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/pricing", response_model=PricingResponse)
def get_pricing(
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> PricingResponse:
    return PricingResponse(price_per_unit=get_current_price(db))


@router.put("/pricing", response_model=PricingResponse)
def update_pricing(
    payload: PricingUpdateRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> PricingResponse:
    value = set_current_price(db, payload.price_per_unit)
    return PricingResponse(price_per_unit=value)


@router.get("/device-interval", response_model=RuntimeConfigResponse)
def get_device_interval(
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> RuntimeConfigResponse:
    return RuntimeConfigResponse(device_data_interval_seconds=get_device_data_interval_seconds(db))


@router.put("/device-interval", response_model=RuntimeConfigResponse)
def update_device_interval(
    payload: RuntimeConfigUpdateRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> RuntimeConfigResponse:
    value = set_device_data_interval_seconds(db, payload.device_data_interval_seconds)
    return RuntimeConfigResponse(device_data_interval_seconds=value)


@router.get("/users/search")
def search_users(
    q: str = Query(min_length=2, max_length=255),
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> list[dict]:
    query_text = q.strip()
    if not query_text:
        return []
    query_lower = query_text.lower()

    rows = (
        db.query(User)
        .filter(User.email.ilike(f"%{query_text}%"))
        .order_by(
            case((func.lower(User.email) == query_lower, 0), else_=1),
            User.email.asc(),
        )
        .limit(10)
        .all()
    )

    return [{"id": str(u.id), "email": u.email} for u in rows]


@router.post("/device/register")
def register_device(
    payload: AdminRegisterDeviceRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device_uid = consume_pair_code(payload.pair_code)
    existing = db.query(Device).filter(Device.device_uid == device_uid).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Device already registered")

    device_id, device_secret = generate_device_identity()
    device = Device(
        device_id=device_id,
        device_uid=device_uid,
        device_secret=device_secret,
        user_id=payload.user_id,
        status=DeviceStatus.PENDING_ACTIVATION,
        location=payload.location,
        relay_state=True,
    )
    db.add(device)
    db.commit()

    return {"device_id": device_id, "status": device.status}


@router.post("/device/activate")
def activate_device(
    payload: AdminActivateDeviceRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if device.tampered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tampered device cannot be activated. Recover device first.",
        )

    device.status = DeviceStatus.ACTIVE
    db.commit()
    return {"status": "ACTIVE"}


@router.post("/device/deactivate")
def deactivate_device(
    payload: AdminActivateDeviceRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    device.status = DeviceStatus.DEACTIVATED
    device.relay_state = False
    db.commit()
    return {"status": "DEACTIVATED"}


@router.post("/device/remove")
def remove_device(
    payload: AdminActivateDeviceRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    device.status = DeviceStatus.REMOVED
    db.commit()
    return {"status": "REMOVED"}


@router.post("/device/recover")
def recover_device(
    payload: AdminActivateDeviceRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if device.status == DeviceStatus.REMOVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Removed device cannot be recovered")

    # Recovery clears tamper lock, re-enables lifecycle, and keeps relay OFF for safety.
    device.tampered = False
    device.status = DeviceStatus.ACTIVE
    device.relay_state = False
    device.pending_relay_command = None
    db.commit()
    return {
        "status": device.status.value,
        "relay_state": "OFF",
        "recovered": True,
    }


@router.post("/device/relay")
def relay_control(
    payload: AdminRelayRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if device.tampered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tampered device relay is locked OFF until recovery.",
        )

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Relay control allowed only for ACTIVE devices. Current status: {device.status.value}",
        )

    desired = payload.relay_state.upper().strip()
    if desired not in {"ON", "OFF"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="relay_state must be ON or OFF")

    device.pending_relay_command = desired == "ON"
    db.commit()
    return {"queued": True, "relay_state": desired}


@router.get("/device/list")
def list_devices(db: Session = Depends(get_db_session), _: object = Depends(get_current_admin)) -> list[dict]:
    interval_seconds = get_device_data_interval_seconds(db)
    offline_cutoff = datetime.now(UTC) - timedelta(seconds=interval_seconds * 2)
    month_start = datetime.now(UTC).date().replace(day=1)

    latest_readings = (
        db.query(EnergyReading.device_id, func.max(EnergyReading.timestamp).label("last_seen_at"))
        .group_by(EnergyReading.device_id)
        .all()
    )
    last_seen_map = {str(row.device_id): row.last_seen_at for row in latest_readings}

    rows = db.query(Device).all()
    result = []
    for d in rows:
        last_seen_at = last_seen_map.get(str(d.id))
        is_offline = bool(last_seen_at and last_seen_at < offline_cutoff)
        health_status = "TAMPERED" if d.tampered else ("OFFLINE" if is_offline else "GOOD")
        relay_state = "OFF" if d.tampered else ("ON" if d.relay_state else "OFF")
        owner = db.query(User).filter(User.id == d.user_id).first() if d.user_id else None

        lifetime_units = (
            db.query(func.coalesce(func.sum(DailyUsage.units_consumed), 0.0))
            .filter(DailyUsage.device_id == d.id)
            .scalar()
        )
        current_month_units = (
            db.query(func.coalesce(func.sum(DailyUsage.units_consumed), 0.0))
            .filter(DailyUsage.device_id == d.id, DailyUsage.date >= month_start)
            .scalar()
        )

        result.append(
            {
                "device_id": d.device_id,
                "device_uid": d.device_uid,
                "status": d.status,
                "location": d.location,
                "relay_state": relay_state,
                "tampered": d.tampered,
                "health_status": health_status,
                "owner_email": owner.email if owner else None,
                "lifetime_units": float(lifetime_units or 0.0),
                "current_month_units": float(current_month_units or 0.0),
                "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
            }
        )

    return result


@router.get("/users/overview")
def users_overview(db: Session = Depends(get_db_session), _: object = Depends(get_current_admin)) -> list[dict]:
    month_start = datetime.now(UTC).date().replace(day=1)
    rows = db.query(User).order_by(User.email.asc()).all()
    result = []

    for user in rows:
        devices = db.query(Device).filter(Device.user_id == user.id).all()
        device_ids = [d.id for d in devices]
        active_devices = sum(1 for d in devices if d.status == DeviceStatus.ACTIVE)

        if device_ids:
            lifetime_units = (
                db.query(func.coalesce(func.sum(DailyUsage.units_consumed), 0.0))
                .filter(DailyUsage.device_id.in_(device_ids))
                .scalar()
            )
            current_month_units = (
                db.query(func.coalesce(func.sum(DailyUsage.units_consumed), 0.0))
                .filter(DailyUsage.device_id.in_(device_ids), DailyUsage.date >= month_start)
                .scalar()
            )
            last_seen_at = (
                db.query(func.max(EnergyReading.timestamp))
                .filter(EnergyReading.device_id.in_(device_ids))
                .scalar()
            )
        else:
            lifetime_units = 0.0
            current_month_units = 0.0
            last_seen_at = None

        unpaid_bills = (
            db.query(func.count(Bill.id))
            .filter(Bill.user_id == user.id, Bill.status == BillStatus.UNPAID)
            .scalar()
        )
        overdue_bills = (
            db.query(func.count(Bill.id))
            .filter(Bill.user_id == user.id, Bill.status == BillStatus.OVERDUE)
            .scalar()
        )
        due_amount = (
            db.query(func.coalesce(func.sum(Bill.amount), 0.0))
            .filter(Bill.user_id == user.id, Bill.status.in_([BillStatus.UNPAID, BillStatus.OVERDUE]))
            .scalar()
        )

        result.append(
            {
                "user_id": str(user.id),
                "email": user.email,
                "device_count": len(devices),
                "active_device_count": active_devices,
                "current_month_units": float(current_month_units or 0.0),
                "lifetime_units": float(lifetime_units or 0.0),
                "unpaid_bills": int(unpaid_bills or 0),
                "overdue_bills": int(overdue_bills or 0),
                "due_amount": float(due_amount or 0.0),
                "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
            }
        )

    return result


@router.get("/analytics/trends")
def admin_analytics_trends(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    today = datetime.now(UTC).date()
    resolved_end = end_date or today
    resolved_start = start_date or (resolved_end - timedelta(days=29))

    if resolved_start > resolved_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date cannot be after end_date")

    if (resolved_end - resolved_start).days > 365:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum range is 366 days")

    usage_rows = (
        db.query(
            DailyUsage.date.label("date"),
            func.coalesce(func.sum(DailyUsage.units_consumed), 0.0).label("units"),
        )
        .filter(DailyUsage.date >= resolved_start, DailyUsage.date <= resolved_end)
        .group_by(DailyUsage.date)
        .order_by(DailyUsage.date.asc())
        .all()
    )
    usage_map = {row.date: float(row.units or 0.0) for row in usage_rows}

    due_rows = (
        db.query(
            Bill.due_date.label("date"),
            func.coalesce(func.sum(Bill.amount), 0.0).label("due_amount"),
            func.sum(case((Bill.status == BillStatus.UNPAID, 1), else_=0)).label("unpaid_count"),
            func.sum(case((Bill.status == BillStatus.OVERDUE, 1), else_=0)).label("overdue_count"),
        )
        .filter(
            Bill.due_date >= resolved_start,
            Bill.due_date <= resolved_end,
            Bill.status.in_([BillStatus.UNPAID, BillStatus.OVERDUE]),
        )
        .group_by(Bill.due_date)
        .order_by(Bill.due_date.asc())
        .all()
    )
    due_map = {
        row.date: {
            "due_amount": float(row.due_amount or 0.0),
            "unpaid_count": int(row.unpaid_count or 0),
            "overdue_count": int(row.overdue_count or 0),
        }
        for row in due_rows
    }

    consumption_daily = []
    dues_daily = []
    cursor = resolved_start
    while cursor <= resolved_end:
        consumption_daily.append(
            {
                "date": cursor.isoformat(),
                "units": usage_map.get(cursor, 0.0),
            }
        )

        due_point = due_map.get(cursor, {"due_amount": 0.0, "unpaid_count": 0, "overdue_count": 0})
        dues_daily.append(
            {
                "date": cursor.isoformat(),
                "due_amount": due_point["due_amount"],
                "unpaid_count": due_point["unpaid_count"],
                "overdue_count": due_point["overdue_count"],
            }
        )
        cursor += timedelta(days=1)

    return {
        "start_date": resolved_start.isoformat(),
        "end_date": resolved_end.isoformat(),
        "consumption_daily": consumption_daily,
        "dues_daily": dues_daily,
    }


@router.post("/jobs/aggregate-daily-usage")
def trigger_aggregate_daily_usage(
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    latest_reading_at = db.query(func.max(EnergyReading.timestamp)).scalar()
    target_date = (latest_reading_at.date() if latest_reading_at else datetime.now(UTC).date())

    try:
        task = aggregate_daily_usage_task.delay(target_date_iso=target_date.isoformat())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to queue aggregate_daily_usage task: {exc}",
        ) from exc

    return {
        "queued": True,
        "task_name": "aggregate_daily_usage",
        "task_id": task.id,
        "target_date": target_date.isoformat(),
    }


@router.post("/jobs/generate-monthly-bills")
def trigger_generate_monthly_bills(
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    latest_daily_date = db.query(func.max(DailyUsage.date)).scalar()
    if latest_daily_date:
        month_start = latest_daily_date.replace(day=1)
    else:
        now = datetime.now(UTC).date()
        month_start = now.replace(day=1)

    try:
        task = generate_monthly_bills_task.delay(month_start_iso=month_start.isoformat())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to queue generate_monthly_bills task: {exc}",
        ) from exc

    return {
        "queued": True,
        "task_name": "generate_monthly_bills",
        "task_id": task.id,
        "month_start": month_start.isoformat(),
    }


@router.post("/jobs/check-unpaid-bills")
def trigger_check_unpaid_bills(_: object = Depends(get_current_admin)) -> dict:
    try:
        task = check_unpaid_bills_task.delay()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to queue check_unpaid_bills task: {exc}",
        ) from exc

    return {
        "queued": True,
        "task_name": "check_unpaid_bills",
        "task_id": task.id,
    }


@router.get("/jobs/{task_id}")
def get_job_status(task_id: str, _: object = Depends(get_current_admin)) -> dict:
    try:
        result = AsyncResult(task_id, app=celery_app)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch task status: {exc}",
        ) from exc

    response = {
        "task_id": task_id,
        "status": result.status,
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
    }

    if result.failed():
        response["error"] = str(result.result)
    elif result.successful():
        response["result"] = result.result

    return response
