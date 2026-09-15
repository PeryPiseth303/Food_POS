from datetime import datetime, timezone, timedelta
from typing import Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.db.session import get_db
from app.models.order import Order, OrderItem
from app.models.table import RestaurantTable
from app.schemas.analytics import AnalyticsSummary, TopItemStat, DailySalesStat, TableOrderStat
from app.api.deps import get_current_admin

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/sales", response_model=AnalyticsSummary)
async def get_sales_analytics(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    # 1. Total revenue and total orders
    tot_res = await db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_amount), 0.0)
        ).where(Order.status != "cancelled")
    )
    total_orders, total_revenue = tot_res.one()

    # 2. Today's revenue and orders
    today_res = await db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_amount), 0.0)
        ).where(Order.created_at >= today_start, Order.status != "cancelled")
    )
    today_orders, today_revenue = today_res.one()

    # 3. Average order value
    avg_ov = float(total_revenue / total_orders) if total_orders > 0 else 0.0

    # 4. Status breakdown
    status_res = await db.execute(
        select(Order.status, func.count(Order.id)).group_by(Order.status)
    )
    orders_by_status = {s: 0 for s in ["pending", "confirmed", "preparing", "ready", "served", "cancelled"]}
    active_count = 0
    for s, cnt in status_res.all():
        orders_by_status[s] = cnt
        if s in ["pending", "confirmed", "preparing", "ready"]:
            active_count += cnt

    # 5. Top 5 selling items
    top_items_res = await db.execute(
        select(
            OrderItem.item_name,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.item_total).label("total_rev")
        )
        .group_by(OrderItem.item_name)
        .order_by(desc("total_qty"))
        .limit(5)
    )
    top_selling_items = [
        TopItemStat(
            name=row[0],
            quantity_sold=int(row[1] or 0),
            revenue=float(row[2] or 0.0)
        )
        for row in top_items_res.all()
    ]

    # 6. Daily sales (last 7 days)
    daily_sales = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        day_str = day.strftime("%b %d")

        d_res = await db.execute(
            select(
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_amount), 0.0)
            ).where(
                Order.created_at >= day,
                Order.created_at < next_day,
                Order.status != "cancelled"
            )
        )
        d_cnt, d_rev = d_res.one()
        daily_sales.append(
            DailySalesStat(
                date=day_str,
                total_sales=float(d_rev),
                order_count=int(d_cnt)
            )
        )

    # 7. Table breakdown
    table_res = await db.execute(
        select(
            RestaurantTable.table_number,
            func.count(Order.id).label("ord_cnt"),
            func.coalesce(func.sum(Order.total_amount), 0.0).label("spent")
        )
        .join(Order, Order.table_id == RestaurantTable.id)
        .group_by(RestaurantTable.table_number)
        .order_by(desc("spent"))
        .limit(8)
    )
    table_stats = [
        TableOrderStat(
            table_number=row[0],
            order_count=int(row[1]),
            total_spent=float(row[2])
        )
        for row in table_res.all()
    ]

    return AnalyticsSummary(
        total_revenue=float(total_revenue),
        today_revenue=float(today_revenue),
        total_orders=int(total_orders),
        today_orders=int(today_orders),
        average_order_value=round(avg_ov, 2),
        active_orders_count=active_count,
        orders_by_status=orders_by_status,
        top_selling_items=top_selling_items,
        daily_sales=daily_sales,
        table_stats=table_stats
    )
