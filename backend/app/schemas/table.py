from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class TableBase(BaseModel):
    table_number: str
    capacity: int = 4
    is_active: bool = True


class TableCreate(BaseModel):
    table_number: str
    capacity: int = 4


class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class TableOut(TableBase):
    id: int
    qr_code_token: str
    created_at: datetime
    qr_url: Optional[str] = None

    class Config:
        from_attributes = True


class TableValidateRequest(BaseModel):
    token: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TableSessionResponse(BaseModel):
    is_valid: bool
    table_id: int
    table_number: str
    session_token: str
    restaurant_name: str
    message: str
