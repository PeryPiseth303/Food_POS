from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, field_validator


class CallStaffRequest(BaseModel):
    table_number: Union[str, int]
    notification_type: Optional[str] = "call_staff"
    message: Optional[str] = None

    @field_validator("table_number", mode="before")
    def coerce_table_number(cls, v):
        return str(v)



class StaffNotificationResponse(BaseModel):
    id: int
    table_number: str
    notification_type: str
    message: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
