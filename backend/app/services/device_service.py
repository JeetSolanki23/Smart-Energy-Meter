import random
import secrets
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.device import Device
from app.models.energy_reading import EnergyReading
from app.models.tamper_log import TamperLog
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
    reading = EnergyReading(
        device_id=device.id,
        voltage=payload["voltage"],
        current=payload["current"],
        power=payload["power"],
        energy=payload["energy"],
        tamper=payload["tamper"],
        timestamp=payload["timestamp"],
    )
    db.add(reading)

    if payload["tamper"]:
        device.tampered = True
        tamper_log = TamperLog(
            device_id=device.id,
            timestamp=datetime.now(UTC),
            description="Tamper detected by device firmware",
        )
        db.add(tamper_log)

    db.commit()
