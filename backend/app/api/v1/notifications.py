import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.api.deps import get_db
from app.models.notification import StaffNotification
from app.schemas.notification import CallStaffRequest, StaffNotificationResponse
from app.services.websocket_manager import ws_manager

logger = logging.getLogger("notifications")
router = APIRouter(prefix="/notifications", tags=["Staff Notifications"])


@router.post("/call-staff", response_model=StaffNotificationResponse)
async def call_staff(
    req: CallStaffRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Customer endpoint: Calls waitstaff to their specific table.
    Saves the notification in the database and broadcasts an instant alert via WebSocket to admin.
    """
    tbl = req.table_number.strip()
    msg = req.message or f"Table #{tbl} requested staff assistance."
    
    notification = StaffNotification(
        table_number=tbl,
        notification_type=req.notification_type or "call_staff",
        message=msg,
        status="unread",
        created_at=datetime.now(timezone.utc)
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    # Broadcast real-time event to all active admin dashboards
    try:
        notif_dict = {
            "id": notification.id,
            "table_number": notification.table_number,
            "notification_type": notification.notification_type,
            "message": notification.message,
            "status": notification.status,
            "created_at": notification.created_at.isoformat()
        }
        await ws_manager.broadcast_to_admins({
            "event": "staff_call",
            "type": "staff_call",
            "data": notif_dict,
            "notification": notif_dict
        })
    except Exception as e:
        logger.error(f"Failed to broadcast staff call to admin WS: {e}")

    return notification


@router.get("", response_model=List[StaffNotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Returns recent staff call notifications, ordered newest first.
    """
    res = await db.execute(
        select(StaffNotification).order_by(StaffNotification.created_at.desc()).limit(50)
    )
    return res.scalars().all()


@router.patch("/{notification_id}/resolve", response_model=StaffNotificationResponse)
async def resolve_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Marks a staff call notification as resolved.
    """
    res = await db.execute(
        select(StaffNotification).where(StaffNotification.id == notification_id)
    )
    notif = res.scalar_one_or_none()
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    notif.status = "resolved"
    notif.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(notif)

    # Notify admins about resolved status
    try:
        await ws_manager.broadcast_to_admins({
            "event": "staff_call_resolved",
            "type": "staff_call_resolved",
            "notification_id": notif.id,
            "data": {"notification_id": notif.id}
        })
    except Exception as e:
        logger.error(f"Failed to broadcast resolution WS: {e}")

    return notif


@router.delete("/clear")
async def clear_notifications(
    db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint: Clears/resolves all active staff notifications.
    """
    await db.execute(
        update(StaffNotification).where(StaffNotification.status == "unread").values(
            status="resolved",
            resolved_at=datetime.now(timezone.utc)
        )
    )
    await db.commit()

    try:
        await ws_manager.broadcast_to_admins({
            "event": "staff_calls_cleared",
            "type": "staff_calls_cleared",
            "data": {}
        })
    except Exception as e:
        logger.error(f"Failed to broadcast cleared WS: {e}")

    return {"message": "All active notifications marked as resolved."}

