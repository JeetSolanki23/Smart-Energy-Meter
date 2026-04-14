import hashlib
import hmac
from datetime import UTC, datetime
from uuid import UUID

import razorpay
from fastapi import HTTPException, status
from razorpay.errors import BadRequestError, ServerError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.bill import Bill
from app.models.enums import BillStatus, PaymentStatus
from app.models.payment import Payment
from app.services.email_service import send_payment_success_notification

settings = get_settings()


class PaymentService:
    def __init__(self) -> None:
        self.client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    def create_order(self, db: Session, bill: Bill) -> dict:
        if bill.status == BillStatus.PAID:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bill already paid")

        minimum_amount_paise = max(int(round(settings.MIN_PAYMENT_AMOUNT * 100)), 100)
        amount_paise = max(int(round(bill.amount * 100)), minimum_amount_paise)

        # Backward-compatible fix for existing tiny bills already in DB.
        adjusted_amount = amount_paise / 100.0
        if bill.amount < adjusted_amount:
            bill.amount = adjusted_amount

        existing = (
            db.query(Payment)
            .filter(
                Payment.bill_id == bill.id,
                Payment.status == PaymentStatus.CREATED,
                Payment.razorpay_order_id.isnot(None),
            )
            .first()
        )
        if existing and int(round(existing.amount * 100)) == amount_paise:
            return {
                "order_id": existing.razorpay_order_id,
                "amount_paise": amount_paise,
                "currency": "INR",
                "key_id": settings.RAZORPAY_KEY_ID,
            }

        if existing and existing.status == PaymentStatus.CREATED:
            existing.status = PaymentStatus.FAILED
        # Razorpay receipt max length is 40 chars. UUID hex is 32 chars.
        receipt = f"bill_{bill.id.hex}"

        try:
            order = self.client.order.create(
                {
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": receipt,
                    "payment_capture": 1,
                }
            )
        except BadRequestError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        except ServerError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Payment gateway is currently unavailable. Please try again.",
            ) from exc

        payment = Payment(
            bill_id=bill.id,
            razorpay_order_id=order["id"],
            amount=adjusted_amount,
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

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        payload = f"{order_id}|{payment_id}".encode("utf-8")
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def finalize_payment(
        self,
        db: Session,
        current_user_id: UUID,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> dict:
        """Synchronously finalize payment (for prototype without webhook)"""
        if not self.verify_payment_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid payment signature")

        payment = (
            db.query(Payment)
            .join(Bill, Bill.id == Payment.bill_id)
            .filter(Payment.razorpay_order_id == razorpay_order_id, Bill.user_id == current_user_id)
            .first()
        )
        if not payment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found")

        if payment.status == PaymentStatus.SUCCESS:
            return {"status": "success", "bill_status": "PAID"}

        payment.razorpay_payment_id = razorpay_payment_id
        payment.status = PaymentStatus.SUCCESS
        payment.paid_at = datetime.now(UTC)

        bill = db.query(Bill).filter(Bill.id == payment.bill_id).first()
        if bill:
            bill.status = BillStatus.PAID
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")

        db.commit()
        send_payment_success_notification(db, bill)
        return {"status": "success", "bill_status": "PAID"}

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

        was_success = payment.status == PaymentStatus.SUCCESS

        payment.razorpay_payment_id = razorpay_payment_id
        payment.status = PaymentStatus.SUCCESS
        payment.paid_at = datetime.now(UTC)

        bill = db.query(Bill).filter(Bill.id == payment.bill_id).first()
        if bill:
            bill.status = BillStatus.PAID

        db.commit()

        if bill and not was_success:
            send_payment_success_notification(db, bill)
