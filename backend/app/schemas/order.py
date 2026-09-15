from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int = 1
    customizations: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class OrderItemOut(BaseModel):
    id: int
    menu_item_id: Optional[int]
    item_name: str
    quantity: int
    unit_price: float
    item_total: float
    customizations: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    order_type: str = "dine_in"  # dine_in, delivery
    table_id: Optional[int] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = "Guest"
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    session_token: Optional[str] = None
    special_requests: Optional[str] = None
    payment_method: str = "mock_card"  # mock_card, aba_pay, stripe, cash_on_delivery
    tip: float = 0.0
    items: List[OrderItemCreate]


class OrderStatusUpdate(BaseModel):
    status: str  # pending, confirmed, preparing, ready, served, cancelled


class OrderOut(BaseModel):
    id: int
    order_number: str
    order_type: str = "dine_in"
    table_id: Optional[int] = None
    table_number: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = "Guest"
    customer_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    special_requests: Optional[str] = None
    status: str
    payment_status: str
    payment_method: str
    payment_intent_id: Optional[str] = None
    subtotal: float
    tax: float
    tip: float
    total_amount: float
    estimated_prep_minutes: int
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True
