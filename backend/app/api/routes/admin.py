from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db_session
from app.models.device import Device
from app.models.energy_reading import EnergyReading
from app.models.enums import DeviceStatus
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

        result.append(
            {
                "device_id": d.device_id,
                "device_uid": d.device_uid,
                "status": d.status,
                "location": d.location,
                "relay_state": relay_state,
                "tampered": d.tampered,
                "health_status": health_status,
                "last_seen_at": last_seen_at.isoformat() if last_seen_at else None,
            }
        )

    return result
