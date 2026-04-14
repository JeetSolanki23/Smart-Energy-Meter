import random
import secrets
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.device import Device
from app.models.energy_reading import EnergyReading
from app.models.enums import DeviceStatus
from app.models.tamper_log import TamperLog
from app.services.email_service import send_tamper_notification
from app.services.redis_service import redis_client

settings = get_settings()


def generate_pair_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def generate_device_identity() -> tuple[str, str]:
    return f"DEV_{secrets.randbelow(999999):06d}", secrets.token_urlsafe(24)


def create_pair_code(device_uid: str) -> str:
    pair_code = generate_pair_code()
    key = f"pair_code:{pair_code}"
    redis_client.setex(key, settings.PAIR_CODE_TTL_SECONDS, device_uid)
    return pair_code


def consume_pair_code(pair_code: str) -> str:
    key = f"pair_code:{pair_code}"
    device_uid = redis_client.get(key)
    if not device_uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired pair code")
    redis_client.delete(key)
    return device_uid


def store_reading(db: Session, device: Device, payload: dict) -> None:
    # Use server-side receipt time for connectivity/offline calculations.
    received_at = datetime.now(UTC)
    was_tampered = bool(device.tampered)

    reading = EnergyReading(
        device_id=device.id,
        voltage=payload["voltage"],
        current=payload["current"],
        power=payload["power"],
        energy=payload["energy"],
        tamper=payload["tamper"],
        timestamp=received_at,
    )
    db.add(reading)

    if payload["tamper"]:
        device.tampered = True
        device.relay_state = False
        device.pending_relay_command = False
        device.status = DeviceStatus.DEACTIVATED
        if not was_tampered:
            tamper_log = TamperLog(
                device_id=device.id,
                timestamp=datetime.now(UTC),
                description="Tamper detected by device firmware. Device deactivated and relay turned OFF.",
            )
            db.add(tamper_log)

    db.commit()

    if payload["tamper"] and not was_tampered:
        send_tamper_notification(db, device)
