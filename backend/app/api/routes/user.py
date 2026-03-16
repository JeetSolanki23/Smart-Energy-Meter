from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db_session
from app.models.bill import Bill
from app.models.daily_usage import DailyUsage
from app.models.device import Device
from app.models.user import User
from app.schemas.billing import BillResponse

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/usage")
def get_usage(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> dict:
    total_units = (
        db.query(func.coalesce(func.sum(DailyUsage.units_consumed), 0.0))
        .join(Device, Device.id == DailyUsage.device_id)
        .filter(Device.user_id == current_user.id)
        .scalar()
    )
    return {"total_units": float(total_units or 0.0)}


@router.get("/bills", response_model=list[BillResponse])
def get_bills(current_user: User = Depends(get_current_user), db: Session = Depends(get_db_session)) -> list[BillResponse]:
    bills = db.query(Bill).filter(Bill.user_id == current_user.id).order_by(Bill.month.desc()).all()
    return [
        BillResponse(
            id=b.id,
            month=b.month,
            units=b.units,
            amount=b.amount,
            status=b.status.value,
            due_date=b.due_date,
        )
        for b in bills
    ]
