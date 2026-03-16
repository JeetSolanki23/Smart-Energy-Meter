import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKeyMixin
from app.models.enums import PaymentStatus


class Payment(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "payments"

    bill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bills.id"), nullable=False, index=True)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.CREATED)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
