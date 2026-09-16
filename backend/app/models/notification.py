from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.db.base import Base


class StaffNotification(Base):
    __tablename__ = "staff_notifications"

    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(String(50), index=True, nullable=False)
    notification_type = Column(String(50), default="call_staff", nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(30), default="unread", nullable=False)  # unread, resolved
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
