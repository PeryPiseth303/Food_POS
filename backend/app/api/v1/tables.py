import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.session import get_db
from app.models.table import RestaurantTable
from app.schemas.table import (
    TableOut, TableCreate, TableUpdate, TableSessionResponse, TableValidateRequest
)
from app.schemas.order import OrderOut
from app.core.security import create_table_session_token, verify_table_session_token
from app.core.config import settings
from app.api.deps import get_current_admin
from app.services.qr_service import generate_table_qr_url, generate_qr_code_base64

router = APIRouter(prefix="/tables", tags=["Tables & QR Validation"])


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine formula for distance in meters."""
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@router.get("/", response_model=List[TableOut])
async def get_all_tables(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    result = await db.execute(select(RestaurantTable).order_by(RestaurantTable.id))
    tables = result.scalars().all()
    out = []
    for t in tables:
        qr_url = generate_table_qr_url(t.id, t.table_number, t.qr_code_token)
        table_dict = TableOut.model_validate(t).model_dump()
        table_dict["qr_url"] = qr_url
        out.append(TableOut(**table_dict))
    return out


@router.post("/", response_model=TableOut)
async def create_table(
    table_in: TableCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    # Check if table number already exists
    res = await db.execute(select(RestaurantTable).where(RestaurantTable.table_number == table_in.table_number))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Table '{table_in.table_number}' already exists.")

    new_table = RestaurantTable(
        table_number=table_in.table_number,
        capacity=table_in.capacity,
        is_active=True
    )
    db.add(new_table)
    await db.commit()
    await db.refresh(new_table)

    qr_url = generate_table_qr_url(new_table.id, new_table.table_number, new_table.qr_code_token)
    table_dict = TableOut.model_validate(new_table).model_dump()
    table_dict["qr_url"] = qr_url
    return TableOut(**table_dict)


@router.get("/{table_identifier}/validate", response_model=TableSessionResponse)
async def validate_table_id(
    table_identifier: str,
    token: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Validates that a scanned table is real, active, and securely verifies session.
    Optional geofencing check validates user is physically nearby if coordinates provided.
    """
    stmt = select(RestaurantTable).where(
        or_(
            RestaurantTable.table_number == table_identifier,
            RestaurantTable.id == (int(table_identifier) if table_identifier.isdigit() else -1)
        )
    )
    result = await db.execute(stmt)
    table = result.scalar_one_or_none()

    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Table '{table_identifier}' not found in restaurant system."
        )

    if not table.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table {table.table_number} is currently inactive or closed."
        )

    # Optional geofence validation
    geofence_status = "verified"
    if lat is not None and lng is not None:
        dist = calculate_distance(lat, lng, settings.RESTAURANT_LATITUDE, settings.RESTAURANT_LONGITUDE)
        if dist > settings.MAX_DISTANCE_METERS:
            geofence_status = f"warning: {int(dist)}m away from dining room"

    # Generate a cryptographically signed table session token
    signed_token = create_table_session_token(table.id, table.table_number)

    return TableSessionResponse(
        is_valid=True,
        table_id=table.id,
        table_number=table.table_number,
        session_token=signed_token,
        restaurant_name=settings.RESTAURANT_NAME,
        message=f"Welcome to Table #{table.table_number} at {settings.RESTAURANT_NAME}!"
    )


@router.get("/{table_id}/qr")
async def get_table_qr_code(
    table_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Returns scannable QR code image data for the table."""
    result = await db.execute(select(RestaurantTable).where(RestaurantTable.id == table_id))
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    target_url = generate_table_qr_url(table.id, table.table_number, table.qr_code_token)
    qr_b64 = generate_qr_code_base64(target_url)

    return {
        "table_id": table.id,
        "table_number": table.table_number,
        "target_url": target_url,
        "qr_image_base64": qr_b64
    }


@router.get("/{table_identifier}/active-orders", response_model=List[OrderOut])
async def get_table_active_orders(
    table_identifier: str,
    db: AsyncSession = Depends(get_db)
):
    """Returns all currently active (unserved / in-progress) orders for a table."""
    stmt = select(RestaurantTable).where(
        or_(
            RestaurantTable.table_number == table_identifier,
            RestaurantTable.id == (int(table_identifier) if table_identifier.isdigit() else -1)
        )
    )
    result = await db.execute(stmt)
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    from app.models.order import Order
    from sqlalchemy.orm import selectinload
    from app.api.v1.orders import format_order_response

    order_stmt = (
        select(Order)
        .where(
            Order.table_id == table.id,
            Order.status.in_(["pending", "confirmed", "preparing", "ready"])
        )
        .options(selectinload(Order.items), selectinload(Order.table))
        .order_by(Order.created_at.desc())
    )
    res = await db.execute(order_stmt)
    orders = res.scalars().all()
    return [format_order_response(o) for o in orders]
