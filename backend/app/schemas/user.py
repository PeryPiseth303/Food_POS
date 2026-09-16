from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_name: Optional[str] = None
    email: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Online Customer Authentication Schemas
# ==========================================

class CustomerRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    delivery_address: Optional[str] = None


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    delivery_address: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    delivery_address: Optional[str] = None
    is_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerRegisterResponse(BaseModel):
    requires_verification: bool = True
    email: str
    message: str
    debug_otp: Optional[str] = None


class CustomerVerifyOTP(BaseModel):
    email: EmailStr
    otp_code: str


class CustomerResendOTP(BaseModel):
    email: EmailStr


class CustomerResendOTPResponse(BaseModel):
    success: bool = True
    message: str
    debug_otp: Optional[str] = None


class CustomerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerOut
