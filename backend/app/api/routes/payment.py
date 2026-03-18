import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db_session
from app.models.bill import Bill
from app.models.user import User
from app.schemas.billing import PaymentCreateRequest, PaymentFinalizeRequest, RazorpayOrderResponse, WebhookResponse
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payment", tags=["payment"])
payment_service = PaymentService()


@router.post("/create", response_model=RazorpayOrderResponse)
def create_payment_order(
    payload: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> RazorpayOrderResponse:
    bill = db.query(Bill).filter(Bill.id == payload.bill_id, Bill.user_id == current_user.id).first()
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")

    data = payment_service.create_order(db, bill)
    return RazorpayOrderResponse(**data)


@router.post("/finalize")
def finalize_payment(
    payload: PaymentFinalizeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> dict:
    """Synchronous payment finalization - use this instead of webhook for prototype"""
    result = payment_service.finalize_payment(db, payload.order_id, payload.payment_id)
    return result


@router.post("/webhook", response_model=WebhookResponse)
async def payment_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    db: Session = Depends(get_db_session),
) -> WebhookResponse:
    body = await request.body()
    if not payment_service.verify_webhook_signature(body, x_razorpay_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    payload = json.loads(body.decode("utf-8"))
    event = payload.get("event")
    if event == "payment.captured":
        entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        payment_service.mark_payment_success(
            db,
            razorpay_order_id=entity.get("order_id", ""),
            razorpay_payment_id=entity.get("id", ""),
        )

    return WebhookResponse(status="ok")
