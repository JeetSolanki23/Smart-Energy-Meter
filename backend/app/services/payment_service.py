import hashlib
import hmac
from datetime import UTC, datetime

import razorpay
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.bill import Bill
from app.models.enums import BillStatus, PaymentStatus
from app.models.payment import Payment

settings = get_settings()


class PaymentService:
    def __init__(self) -> None:
        self.client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    def create_order(self, db: Session, bill: Bill) -> dict:
        if bill.status == BillStatus.PAID:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bill already paid")

        amount_paise = int(round(bill.amount * 100))
        order = self.client.order.create(
            {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"bill_{bill.id}",
                "payment_capture": 1,
            }
        )

        payment = Payment(
            bill_id=bill.id,
            razorpay_order_id=order["id"],
            amount=bill.amount,
            status=PaymentStatus.CREATED,
        )
        db.add(payment)
        db.commit()

        return {
            "order_id": order["id"],
            "amount_paise": amount_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
        }

    def verify_webhook_signature(self, body: bytes, signature: str) -> bool:
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def mark_payment_success(
        self,
        db: Session,
        razorpay_order_id: str,
        razorpay_payment_id: str,
    ) -> None:
        payment = db.query(Payment).filter(Payment.razorpay_order_id == razorpay_order_id).first()
        if not payment:
            return

        payment.razorpay_payment_id = razorpay_payment_id
        payment.status = PaymentStatus.SUCCESS
        payment.paid_at = datetime.now(UTC)

        bill = db.query(Bill).filter(Bill.id == payment.bill_id).first()
        if bill:
            bill.status = BillStatus.PAID

        db.commit()
