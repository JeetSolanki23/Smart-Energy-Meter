from pydantic import BaseModel, Field


class PricingResponse(BaseModel):
    price_per_unit: float


class PricingUpdateRequest(BaseModel):
    price_per_unit: float = Field(gt=0)
