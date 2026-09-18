import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.order import Order
from app.schemas.payment import (
    CreateKhqrRequest,
    KhqrPaymentResponse,
    CheckPaymentStatusRequest,
    PaymentStatusResponse,
    SimulatePaymentRequest,
)
from app.services.payment_service import (
    create_order_khqr,
    verify_order_payment,
    simulate_payment_success,
    mark_order_as_paid,
)

logger = logging.getLogger("payments_router")
router = APIRouter(prefix="/payments", tags=["Payments (ABA PayWay)"])


@router.post("/create-qr", response_model=KhqrPaymentResponse)
async def create_payment_qr(
    payload: CreateKhqrRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates dynamic ABA PayWay checkout QR and mobile deep link for an order.
    Integrates with official ABA PayWay API and direct ABA Pay dynamic payment links.
    """
    stmt = (
        select(Order)
        .where(Order.id == payload.order_id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot pay for a cancelled order")

    result = await create_order_khqr(order, db)
    return KhqrPaymentResponse(**result)


@router.post("/check-status", response_model=PaymentStatusResponse)
async def check_payment_status(
    payload: CheckPaymentStatusRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verifies payment status for an order against ABA PayWay.
    If paid, updates database and broadcasts real-time updates.
    """
    res = await verify_order_payment(payload.order_id, db, payload.transaction_id)
    if "error" in res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res["error"])

    return PaymentStatusResponse(**res)


@router.post("/simulate-success")
async def simulate_bank_approval(
    payload: SimulatePaymentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Development/Testing helper: Immediately marks payment as successful,
    broadcasting live WebSocket events to the customer and admin dashboard,
    and triggering staff Telegram alerts.
    """
    res = await simulate_payment_success(payload.order_id, db)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res.get("error", "Failed"))
    return res


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook callback handler for ABA PayWay payment notifications.
    """
    try:
        data: Dict[str, Any] = await request.json()
    except Exception:
        data = dict(await request.form())

    logger.info(f"Received Payment Webhook Callback: {data}")
    tran_id = data.get("transaction_id") or data.get("tran_id") or data.get("order_number")
    status_flag = str(data.get("status", "")).upper()

    if not tran_id:
        return {"status": "ignored", "reason": "Missing transaction ID"}

    stmt = (
        select(Order)
        .where((Order.order_number == tran_id) | (Order.payment_intent_id == tran_id))
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()

    if not order:
        logger.warning(f"Webhook received for unknown order/transaction: {tran_id}")
        return {"status": "ignored", "reason": "Order not found"}

    if status_flag in ("0", "PAID", "APPROVED", "SUCCESS", "COMPLETED"):
        await mark_order_as_paid(order, db, provider="webhook")
        return {"status": "ok", "message": f"Order #{order.order_number} marked as paid"}

    return {"status": "received", "current_payment_status": order.payment_status}
