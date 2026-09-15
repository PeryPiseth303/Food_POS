from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    order_type = Column(String(30), default="dine_in", nullable=False, index=True)  # dine_in, delivery
    table_id = Column(Integer, ForeignKey("tables.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_id = Column(Integer, ForeignKey("customer_users.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_name = Column(String(100), default="Guest", nullable=True)
    customer_phone = Column(String(50), nullable=True)
    delivery_address = Column(Text, nullable=True)
    special_requests = Column(Text, nullable=True)

    # Status: pending, confirmed, preparing, ready, served, cancelled
    status = Column(String(30), default="pending", nullable=False, index=True)
    
    # Payment: pending, paid, failed, refunded
    payment_status = Column(String(30), default="pending", nullable=False, index=True)
    payment_method = Column(String(50), default="mock_card", nullable=False)
    payment_intent_id = Column(String(255), nullable=True)

    subtotal = Column(Numeric(10, 2), nullable=False)
    tax = Column(Numeric(10, 2), default=0.00, nullable=False)
    tip = Column(Numeric(10, 2), default=0.00, nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    estimated_prep_minutes = Column(Integer, default=20, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    table = relationship("RestaurantTable", back_populates="orders")
    customer = relationship("CustomerUser", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id", ondelete="SET NULL"), nullable=True)
    item_name = Column(String(200), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    item_total = Column(Numeric(10, 2), nullable=False)
    customizations = Column(JSON, default=dict, nullable=True)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")
