from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class RuntimeConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "runtime_config"

    device_data_interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
