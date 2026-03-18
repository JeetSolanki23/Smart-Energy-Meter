from pydantic import BaseModel, Field


class RuntimeConfigResponse(BaseModel):
    device_data_interval_seconds: int


class RuntimeConfigUpdateRequest(BaseModel):
    device_data_interval_seconds: int = Field(ge=5, le=3600)
