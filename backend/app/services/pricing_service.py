from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.pricing import Pricing

settings = get_settings()


def get_current_price(db: Session) -> float:
    row = db.query(Pricing).order_by(Pricing.created_at.desc()).first()
    if row:
        return float(row.price_per_unit)
    return float(settings.PRICE_PER_UNIT)


def set_current_price(db: Session, price_per_unit: float) -> float:
    row = Pricing(price_per_unit=price_per_unit)
    db.add(row)
    db.commit()
    return float(price_per_unit)
