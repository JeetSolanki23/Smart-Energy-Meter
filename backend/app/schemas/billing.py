from datetime import date
from uuid import UUID

from pydantic import BaseModel


class BillResponse(BaseModel):
    bill_id: UUID
    month: date
    units: float
    amount: float
    status: str
    due_date: date


class PaymentCreateRequest(BaseModel):
    bill_id: UUID


class PaymentFinalizeRequest(BaseModel):
    order_id: str
    payment_id: str


class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount_paise: int
    currency: str
    key_id: str


class WebhookResponse(BaseModel):
    status: str
