from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.user import CustomerUser
from app.models.order import Order
from app.schemas.user import (
    CustomerRegister,
    CustomerLogin,
    CustomerUpdate,
    CustomerOut,
    CustomerTokenResponse,
)
from app.schemas.order import OrderOut, OrderItemOut
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.api.deps import get_current_customer

router = APIRouter(prefix="/customer", tags=["Customer Authentication"])


def format_customer_order(order: Order) -> OrderOut:
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

    return OrderOut(
        id=order.id,
        order_number=order.order_number,
        order_type=order.order_type,
        table_id=order.table_id,
        table_number=order.table.table_number if order.table else "Delivery",
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


@router.post("/register", response_model=CustomerTokenResponse)
async def register_customer(
    reg_in: CustomerRegister,
    db: AsyncSession = Depends(get_db)
):
    """Register a new customer account for ordering online from home."""
    existing = await db.execute(select(CustomerUser).where(CustomerUser.email == reg_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    customer = CustomerUser(
        email=reg_in.email,
        hashed_password=get_password_hash(reg_in.password),
        full_name=reg_in.full_name,
        phone=reg_in.phone,
        delivery_address=reg_in.delivery_address,
        is_active=True
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=customer.id,
        role="customer",
        expires_delta=expires
    )

    return CustomerTokenResponse(
        access_token=access_token,
        token_type="bearer",
        customer=CustomerOut.model_validate(customer)
    )


@router.post("/login", response_model=CustomerTokenResponse)
async def login_customer(
    login_in: CustomerLogin,
    db: AsyncSession = Depends(get_db)
):
    """Sign in to existing customer account."""
    res = await db.execute(select(CustomerUser).where(CustomerUser.email == login_in.email))
    customer = res.scalar_one_or_none()

    if not customer or not verify_password(login_in.password, customer.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is deactivated"
        )

    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=customer.id,
        role="customer",
        expires_delta=expires
    )

    return CustomerTokenResponse(
        access_token=access_token,
        token_type="bearer",
        customer=CustomerOut.model_validate(customer)
    )


@router.get("/me", response_model=CustomerOut)
async def get_customer_profile(
    current_customer: CustomerUser = Depends(get_current_customer)
):
    """Get the current customer's profile, saved address, and contact number."""
    return CustomerOut.model_validate(current_customer)


@router.put("/me", response_model=CustomerOut)
async def update_customer_profile(
    update_in: CustomerUpdate,
    current_customer: CustomerUser = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    """Update saved delivery address, name, or phone number."""
    if update_in.full_name is not None:
        current_customer.full_name = update_in.full_name
    if update_in.phone is not None:
        current_customer.phone = update_in.phone
    if update_in.delivery_address is not None:
        current_customer.delivery_address = update_in.delivery_address

    await db.commit()
    await db.refresh(current_customer)
    return CustomerOut.model_validate(current_customer)


@router.get("/orders", response_model=List[OrderOut])
async def get_customer_orders(
    current_customer: CustomerUser = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db)
):
    """List past orders made by this logged-in customer."""
    stmt = (
        select(Order)
        .where(Order.customer_id == current_customer.id)
        .options(selectinload(Order.items), selectinload(Order.table))
        .order_by(Order.created_at.desc())
    )
    res = await db.execute(stmt)
    orders = res.scalars().all()
    return [format_customer_order(o) for o in orders]
