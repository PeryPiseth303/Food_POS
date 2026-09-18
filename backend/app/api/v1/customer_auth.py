from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.user import CustomerUser
from app.models.order import Order
from app.schemas.user import (
    CustomerRegister,
    CustomerRegisterResponse,
    CustomerLogin,
    CustomerVerifyOTP,
    CustomerResendOTP,
    CustomerResendOTPResponse,
    CustomerRequestLoginOTP,
    CustomerRequestLoginOTPResponse,
    CustomerUpdate,
    CustomerOut,
    CustomerTokenResponse,
)
from app.schemas.order import OrderOut, OrderItemOut
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.api.deps import get_current_customer
from app.services.email_service import generate_otp_code, get_otp_expiry, send_otp_email

router = APIRouter(prefix="/customer", tags=["Customer Authentication"])


def is_otp_expired(expires_at: Optional[datetime]) -> bool:
    if not expires_at:
        return True
    now = datetime.now(timezone.utc)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return now > expires_at


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


@router.post("/register", response_model=CustomerRegisterResponse)
async def register_customer(
    reg_in: CustomerRegister,
    db: AsyncSession = Depends(get_db)
):
    """Register a new customer account and send a 6-digit verification code via email."""
    existing_res = await db.execute(select(CustomerUser).where(CustomerUser.email == reg_in.email))
    customer = existing_res.scalar_one_or_none()

    if customer and customer.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )

    otp_code = generate_otp_code()
    otp_expiry = get_otp_expiry()

    if customer and not customer.is_verified:
        # Customer previously registered but never verified: update password and send new OTP
        customer.hashed_password = get_password_hash(reg_in.password)
        customer.full_name = reg_in.full_name
        if reg_in.phone:
            customer.phone = reg_in.phone
        if reg_in.delivery_address:
            customer.delivery_address = reg_in.delivery_address
        customer.otp_code = otp_code
        customer.otp_expires_at = otp_expiry
        customer.is_active = True
    else:
        customer = CustomerUser(
            email=reg_in.email,
            hashed_password=get_password_hash(reg_in.password),
            full_name=reg_in.full_name,
            phone=reg_in.phone,
            delivery_address=reg_in.delivery_address,
            is_active=True,
            is_verified=False,
            otp_code=otp_code,
            otp_expires_at=otp_expiry
        )
        db.add(customer)

    await db.commit()
    await db.refresh(customer)

    # Send OTP email
    smtp_sent, _ = await send_otp_email(customer.email, otp_code, customer.full_name)

    return CustomerRegisterResponse(
        requires_verification=True,
        email=customer.email,
        message=f"A 6-digit verification code has been sent to {customer.email}.",
        debug_otp=None
    )


@router.post("/verify-otp", response_model=CustomerTokenResponse)
async def verify_customer_otp(
    verify_in: CustomerVerifyOTP,
    db: AsyncSession = Depends(get_db)
):
    """Verify 6-digit email OTP and activate customer account."""
    res = await db.execute(select(CustomerUser).where(CustomerUser.email == verify_in.email))
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register first."
        )

    if customer.is_verified:
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

    clean_code = verify_in.otp_code.strip()
    if not customer.otp_code or customer.otp_code.strip() != clean_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your email and try again."
        )

    if is_otp_expired(customer.otp_expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please click 'Resend Code'."
        )

    customer.is_verified = True
    customer.otp_code = None
    customer.otp_expires_at = None
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


@router.post("/resend-otp", response_model=CustomerResendOTPResponse)
async def resend_customer_otp(
    resend_in: CustomerResendOTP,
    db: AsyncSession = Depends(get_db)
):
    """Resend a fresh verification code to the customer email."""
    res = await db.execute(select(CustomerUser).where(CustomerUser.email == resend_in.email))
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account with this email does not exist."
        )

    if customer.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already verified. You can sign in directly."
        )

    otp_code = generate_otp_code()
    customer.otp_code = otp_code
    customer.otp_expires_at = get_otp_expiry()
    await db.commit()

    smtp_sent, _ = await send_otp_email(customer.email, otp_code, customer.full_name)

    return CustomerResendOTPResponse(
        success=True,
        message=f"A fresh verification code has been sent to {customer.email}.",
        debug_otp=None
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

    if not customer.is_verified:
        # Resend code automatically so customer can verify right now
        otp_code = generate_otp_code()
        customer.otp_code = otp_code
        customer.otp_expires_at = get_otp_expiry()
        await db.commit()
        smtp_sent, _ = await send_otp_email(customer.email, otp_code, customer.full_name)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"EMAIL_NOT_VERIFIED: Your account is not verified yet. A verification code has been dispatched to {customer.email}."
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


@router.post("/request-login-otp", response_model=CustomerRequestLoginOTPResponse)
async def request_customer_login_otp(
    req_in: CustomerRequestLoginOTP,
    db: AsyncSession = Depends(get_db)
):
    """
    Request a 6-digit OTP code to log in to an existing account without password.
    """
    res = await db.execute(select(CustomerUser).where(CustomerUser.email == req_in.email))
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account with this email does not exist. Please create an account first."
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated. Please contact restaurant staff."
        )

    otp_code = generate_otp_code()
    customer.otp_code = otp_code
    customer.otp_expires_at = get_otp_expiry()
    await db.commit()

    smtp_sent, _ = await send_otp_email(customer.email, otp_code, customer.full_name, purpose="login")

    return CustomerRequestLoginOTPResponse(
        success=True,
        email=customer.email,
        message=f"A 6-digit login code has been sent to {customer.email}.",
        debug_otp=None
    )


@router.post("/login-with-otp", response_model=CustomerTokenResponse)
async def login_customer_with_otp(
    verify_in: CustomerVerifyOTP,
    db: AsyncSession = Depends(get_db)
):
    """
    Sign in to an existing account using the 6-digit OTP code sent to email.
    """
    res = await db.execute(select(CustomerUser).where(CustomerUser.email == verify_in.email))
    customer = res.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register first."
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account has been deactivated."
        )

    clean_code = verify_in.otp_code.strip()
    if not customer.otp_code or customer.otp_code.strip() != clean_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid login code. Please check your email and try again."
        )

    if is_otp_expired(customer.otp_expires_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Login code has expired. Please request a fresh code."
        )

    customer.is_verified = True
    customer.otp_code = None
    customer.otp_expires_at = None
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
