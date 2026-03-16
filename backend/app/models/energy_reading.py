import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class EnergyReading(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "energy_readings"

    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("devices.id"), nullable=False, index=True)
    voltage: Mapped[float] = mapped_column(Float, nullable=False)
    current: Mapped[float] = mapped_column(Float, nullable=False)
    power: Mapped[float] = mapped_column(Float, nullable=False)
    energy: Mapped[float] = mapped_column(Float, nullable=False)
    tamper: Mapped[bool] = mapped_column(default=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
