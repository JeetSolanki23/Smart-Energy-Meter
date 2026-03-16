import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class DailyUsage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "daily_usage"
    __table_args__ = (UniqueConstraint("device_id", "date", name="uq_daily_usage_device_date"),)

    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("devices.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    units_consumed: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
