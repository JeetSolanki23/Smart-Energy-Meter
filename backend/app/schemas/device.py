from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import DeviceStatus


class PairInitRequest(BaseModel):
    device_uid: str = Field(min_length=6, max_length=64)


class PairInitResponse(BaseModel):
    pair_code: str
    expires_in: int


class AdminRegisterDeviceRequest(BaseModel):
    pair_code: str = Field(min_length=6, max_length=6)
    location: str = Field(min_length=1, max_length=255)
    user_id: UUID


class AdminActivateDeviceRequest(BaseModel):
    device_id: str


class AdminRelayRequest(BaseModel):
    device_id: str
    relay_state: str


class DeviceActivateRequest(BaseModel):
    device_uid: str


class DeviceActivateResponse(BaseModel):
    device_id: str
    device_secret: str
    status: DeviceStatus


class DeviceDataRequest(BaseModel):
    device_id: str
    voltage: float
    current: float
    power: float
    energy: float
    tamper: bool = False
    timestamp: datetime


class DeviceCommandResponse(BaseModel):
    relay: str
