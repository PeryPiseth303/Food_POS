from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class CreateKhqrRequest(BaseModel):
    order_id: int


class KhqrPaymentResponse(BaseModel):
    success: bool = True
    order_id: int
    order_number: str
    amount_usd: float
    amount_khr: int
    qr_string: str
    qr_image: str  # data:image/png;base64,...
    abapay_deeplink: str
    aba_payment_link: Optional[str] = None
    transaction_id: str
    expires_at: str
    provider: str = "khqrcc"
    is_sandbox: bool = False
    message: Optional[str] = None


class CheckPaymentStatusRequest(BaseModel):
    order_id: int
    transaction_id: Optional[str] = None


class PaymentStatusResponse(BaseModel):
    order_id: int
    order_number: str
    payment_status: str  # pending, paid, failed
    is_paid: bool
    payment_method: str
    message: Optional[str] = None


class SimulatePaymentRequest(BaseModel):
    order_id: int
