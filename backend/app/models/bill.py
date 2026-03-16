import uuid
from datetime import date

from sqlalchemy import Date, Enum, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import BillStatus


class Bill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bills"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    month: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    units: Mapped[float] = mapped_column(Float, nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[BillStatus] = mapped_column(Enum(BillStatus), default=BillStatus.UNPAID)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
