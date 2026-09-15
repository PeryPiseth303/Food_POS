from datetime import datetime, timezone
import secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base


class RestaurantTable(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(String(50), unique=True, index=True, nullable=False)
    capacity = Column(Integer, default=4, nullable=False)
    qr_code_token = Column(String(128), unique=True, index=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    orders = relationship("Order", back_populates="table", cascade="all, delete-orphan")
