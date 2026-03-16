import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin


class TamperLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "tamper_logs"

    device_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("devices.id"), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
