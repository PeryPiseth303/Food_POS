import random
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.order import Order, OrderItem
from app.models.table import RestaurantTable
from app.models.menu import MenuItem
from app.schemas.order import OrderCreate, OrderOut, OrderStatusUpdate, OrderItemOut
from app.core.config import settings
from app.core.security import verify_table_session_token
from app.services.websocket_manager import ws_manager
from app.services.telegram_service import send_telegram_order_notification
from app.api.deps import get_current_admin

router = APIRouter(prefix="/orders", tags=["Orders"])


def generate_order_number() -> str:
    timestamp_part = datetime.now().strftime("%H%M")
    rand_part = random.randint(100, 999)
    return f"ORD-{timestamp_part}-{rand_part}"


def format_order_response(order: Order) -> OrderOut:
    items_out = [
        OrderItemOut(
            id=item.id,
            menu_item_id=item.menu_item_id,
            item_name=item.item_name,
            quantity=item.quantity,
            unit_price=float(item.unit_price),
            item_total=float(item.item_total),
            customizations=item.customizations or {},
            notes=item.notes
        )
        for item in order.items
    ]

    table_num = None
    if order.table:
        table_num = order.table.table_number
    elif order.order_type == "delivery":
        table_num = "Delivery"
    elif order.table_id:
        table_num = f"#{order.table_id}"

    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        order_type=order.order_type or "dine_in",
        table_id=order.table_id,
        table_number=table_num,
        customer_id=order.customer_id,
        customer_name=order.customer_name or "Guest",
        customer_phone=order.customer_phone,
        delivery_address=order.delivery_address,
        special_requests=order.special_requests,
        status=order.status,
        payment_status=order.payment_status,
        payment_method=order.payment_method,
        payment_intent_id=order.payment_intent_id,
        subtotal=float(order.subtotal),
        tax=float(order.tax),
        tip=float(order.tip),
        total_amount=float(order.total_amount),
        estimated_prep_minutes=order.estimated_prep_minutes,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=items_out
    )


@router.post("", response_model=OrderOut)
async def create_order(
    order_in: OrderCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new order from table QR scan (Dine-In) or online site (Delivery).
    Calculates subtotal, tax, and total.
    Dispatches Telegram alert and live WebSocket event to admin dashboard.
    """
    order_type = order_in.order_type or "dine_in"
    table = None

    # 1. Validation based on Order Type
    if order_type == "delivery":
        if not order_in.customer_name or not order_in.customer_name.strip():
            raise HTTPException(status_code=400, detail="Customer name is required for delivery.")
        if not order_in.customer_phone or not order_in.customer_phone.strip():
            raise HTTPException(status_code=400, detail="Phone number is required for delivery.")
        if not order_in.delivery_address or not order_in.delivery_address.strip():
            raise HTTPException(status_code=400, detail="Delivery address / location is required for online ordering.")
    else:
        # Dine-In at Shop Place
        if not order_in.table_id:
            raise HTTPException(status_code=400, detail="Table ID is required for dine-in orders.")
        table_res = await db.execute(select(RestaurantTable).where(RestaurantTable.id == order_in.table_id))
        table = table_res.scalar_one_or_none()
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        if not table.is_active:
            raise HTTPException(status_code=400, detail="Table is currently inactive")

    # 2. Check items
    if not order_in.items:
        raise HTTPException(status_code=400, detail="Cart cannot be empty")

    subtotal = 0.0
    order_items_to_create = []

    for cart_item in order_in.items:
        item_res = await db.execute(select(MenuItem).where(MenuItem.id == cart_item.menu_item_id))
        menu_item = item_res.scalar_one_or_none()
        if not menu_item:
            raise HTTPException(status_code=400, detail=f"Menu item ID {cart_item.menu_item_id} does not exist")
        if not menu_item.is_available:
            raise HTTPException(status_code=400, detail=f"'{menu_item.name}' is currently out of stock")

        unit_price = float(menu_item.price)

        # Calculate any custom option add-on prices if applicable
        extra_cost = 0.0
        if cart_item.customizations and isinstance(cart_item.customizations, dict):
            extras = cart_item.customizations.get("extras", [])
            if isinstance(extras, list):
                for ext in extras:
                    if isinstance(ext, dict) and "price" in ext:
                        extra_cost += float(ext["price"])

        item_unit_total = unit_price + extra_cost
        line_total = item_unit_total * cart_item.quantity
        subtotal += line_total

        order_items_to_create.append(
            OrderItem(
                menu_item_id=menu_item.id,
                item_name=menu_item.name,
                quantity=cart_item.quantity,
                unit_price=item_unit_total,
                item_total=line_total,
                customizations=cart_item.customizations or {},
                notes=cart_item.notes
            )
        )

    tax = round(subtotal * settings.TAX_RATE, 2)
    tip = round(order_in.tip, 2) if order_in.tip > 0 else 0.0
    total = round(subtotal + tax + tip, 2)

    # Online card orders are pre-authorized mock cards; aba_pay & cash start as pending
    is_online_paid = order_in.payment_method in ["mock_card", "stripe"]

    new_order = Order(
        order_number=generate_order_number(),
        order_type=order_type,
        table_id=table.id if table else None,
        customer_id=order_in.customer_id,
        customer_name=order_in.customer_name.strip() if order_in.customer_name else "Guest",
        customer_phone=order_in.customer_phone.strip() if order_in.customer_phone else None,
        delivery_address=order_in.delivery_address.strip() if order_in.delivery_address else None,
        special_requests=order_in.special_requests,
        status="pending",
        payment_status="paid" if is_online_paid else "pending",
        payment_method=order_in.payment_method,
        subtotal=subtotal,
        tax=tax,
        tip=tip,
        total_amount=total,
        estimated_prep_minutes=settings.ESTIMATED_PREP_MINUTES,
        items=order_items_to_create
    )

    db.add(new_order)
    await db.commit()

    # Re-fetch with relationships loaded
    stmt = (
        select(Order)
        .where(Order.id == new_order.id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    full_order = res.scalar_one()

    order_out = format_order_response(full_order)
    order_dict = order_out.model_dump()
    order_dict["created_at"] = full_order.created_at.isoformat()
    order_dict["updated_at"] = full_order.updated_at.isoformat()

    # Broadcast to admin dashboard WebSockets
    background_tasks.add_task(
        ws_manager.broadcast_to_admins,
        {"event": "new_order", "data": order_dict}
    )

    # Dispatch receipt to Telegram bot ONLY if the order is already paid.
    # If not paid (e.g. pending KHQR/ABA Pay), receipt is sent only AFTER payment is confirmed.
    if full_order.payment_status == "paid":
        background_tasks.add_task(
            send_telegram_order_notification,
            order_dict
        )

    return order_out


@router.get("/{order_id}", response_model=OrderOut)
async def get_order_by_id(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Returns order details and live status for customer tracker or admin."""
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return format_order_response(order)


@router.get("", response_model=List[OrderOut])
async def list_orders(
    status: Optional[str] = Query(None),
    table_id: Optional[int] = Query(None),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    """Lists orders for staff with status filter."""
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.table))
        .order_by(Order.created_at.desc())
    )
    if status and status != "all":
        stmt = stmt.where(Order.status == status)
    if table_id:
        stmt = stmt.where(Order.table_id == table_id)

    stmt = stmt.limit(limit)
    res = await db.execute(stmt)
    orders = res.scalars().all()
    return [format_order_response(o) for o in orders]


@router.patch("/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    """
    Updates order status (e.g., pending -> preparing -> ready -> served).
    Instantly pushes update via WebSocket to both customer tracker and staff dashboard.
    """
    valid_statuses = ["pending", "confirmed", "preparing", "ready", "served", "cancelled"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status_update.status}'. Allowed: {', '.join(valid_statuses)}"
        )

    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status_update.status
    order.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(order)

    order_out = format_order_response(order)
    order_dict = order_out.model_dump()
    order_dict["created_at"] = order.created_at.isoformat()
    order_dict["updated_at"] = order.updated_at.isoformat()

    # Broadcast to admin sockets
    background_tasks.add_task(
        ws_manager.broadcast_to_admins,
        {"event": "order_status_updated", "data": order_dict}
    )

    # Push to customer's order tracker
    background_tasks.add_task(
        ws_manager.send_order_update,
        order.id,
        {"event": "status_changed", "status": order.status, "data": order_dict}
    )

    return order_out
