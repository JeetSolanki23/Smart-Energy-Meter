import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import DeviceStatus


class Device(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "devices"

    device_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    device_uid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    device_secret: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[DeviceStatus] = mapped_column(Enum(DeviceStatus), default=DeviceStatus.PENDING_ACTIVATION)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    relay_state: Mapped[bool] = mapped_column(Boolean, default=True)
    pending_relay_command: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    tampered: Mapped[bool] = mapped_column(Boolean, default=False)
