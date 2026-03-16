from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin, get_db_session
from app.models.device import Device
from app.models.enums import DeviceStatus
from app.schemas.device import (
    AdminActivateDeviceRequest,
    AdminRegisterDeviceRequest,
    AdminRelayRequest,
)
from app.services.device_service import consume_pair_code, generate_device_identity

router = APIRouter(prefix="/admin", tags=["admin"])


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


@router.post("/device/relay")
def relay_control(
    payload: AdminRelayRequest,
    db: Session = Depends(get_db_session),
    _: object = Depends(get_current_admin),
) -> dict:
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    desired = payload.relay_state.upper().strip()
    if desired not in {"ON", "OFF"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="relay_state must be ON or OFF")

    device.pending_relay_command = desired == "ON"
    db.commit()
    return {"queued": True, "relay_state": desired}


@router.get("/device/list")
def list_devices(db: Session = Depends(get_db_session), _: object = Depends(get_current_admin)) -> list[dict]:
    rows = db.query(Device).all()
    return [
        {
            "device_id": d.device_id,
            "device_uid": d.device_uid,
            "status": d.status,
            "location": d.location,
            "relay_state": "ON" if d.relay_state else "OFF",
            "tampered": d.tampered,
        }
        for d in rows
    ]
