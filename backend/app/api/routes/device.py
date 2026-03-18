from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_authenticated_device, get_db_session
from app.services.runtime_config_service import get_device_data_interval_seconds
from app.models.device import Device
from app.models.enums import DeviceStatus
from app.schemas.device import (
    DeviceCommandResponse,
    DeviceActivateRequest,
    DeviceActivateResponse,
    DeviceDataRequest,
    PairInitRequest,
    PairInitResponse,
)
from app.services.device_service import create_pair_code, store_reading

router = APIRouter(prefix="/device", tags=["device"])
settings = get_settings()


@router.post("/pair/init", response_model=PairInitResponse)
def pair_init(payload: PairInitRequest) -> PairInitResponse:
    """Generate pair code for device - used by admin to register device"""
    pair_code = create_pair_code(payload.device_uid)
    return PairInitResponse(pair_code=pair_code, expires_in=settings.PAIR_CODE_TTL_SECONDS)


@router.post("/activate", response_model=DeviceActivateResponse)
def device_activate(payload: DeviceActivateRequest, db: Session = Depends(get_db_session)) -> DeviceActivateResponse:
    """Device fetches issued credentials after admin registers and activates it."""
    device = db.query(Device).filter(Device.device_uid == payload.device_uid).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not registered")

    if device.status != DeviceStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Device status is {device.status.value}")

    return DeviceActivateResponse(
        device_id=device.device_id,
        device_secret=device.device_secret,
        status=device.status,
    )


@router.post("/data")
def device_data(
    payload: DeviceDataRequest,
    auth_device: Device = Depends(get_authenticated_device),
    db: Session = Depends(get_db_session),
) -> dict:
    """IoT device submits energy readings - must be ACTIVE device"""
    if auth_device.status != DeviceStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Device is not active")
    
    if payload.device_id != auth_device.device_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device mismatch")

    store_reading(db, auth_device, payload.model_dump())
    return {"status": "ok"}


@router.get("/command", response_model=DeviceCommandResponse)
def device_command(auth_device: Device = Depends(get_authenticated_device), db: Session = Depends(get_db_session)) -> DeviceCommandResponse:
    """IoT device polls for relay commands"""
    device = db.query(Device).filter(Device.id == auth_device.id).first()
    interval = get_device_data_interval_seconds(db)
    relay = "ON"
    if device and device.tampered:
        device.relay_state = False
        device.pending_relay_command = None
        db.commit()
        return DeviceCommandResponse(relay="OFF", polling_interval_seconds=interval)

    if device and device.pending_relay_command is not None:
        relay = "OFF" if device.pending_relay_command is False else "ON"
        device.relay_state = bool(device.pending_relay_command)
        device.pending_relay_command = None
        db.commit()
    elif device:
        relay = "ON" if device.relay_state else "OFF"

    return DeviceCommandResponse(relay=relay, polling_interval_seconds=interval)
