from sqlalchemy import Float
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Pricing(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pricing"

    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
