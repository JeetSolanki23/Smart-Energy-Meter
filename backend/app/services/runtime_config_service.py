from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.runtime_config import RuntimeConfig

settings = get_settings()


def get_device_data_interval_seconds(db: Session) -> int:
    row = db.query(RuntimeConfig).order_by(RuntimeConfig.created_at.desc()).first()
    if row:
        return int(row.device_data_interval_seconds)
    return int(settings.DEVICE_DATA_INTERVAL_SECONDS)


def set_device_data_interval_seconds(db: Session, value: int) -> int:
    row = RuntimeConfig(device_data_interval_seconds=value)
    db.add(row)
    db.commit()
    return int(value)
