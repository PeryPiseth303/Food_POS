from typing import List, Dict, Any
from pydantic import BaseModel


class TopItemStat(BaseModel):
    name: str
    quantity_sold: int
    revenue: float


class DailySalesStat(BaseModel):
    date: str
    total_sales: float
    order_count: int


class TableOrderStat(BaseModel):
    table_number: str
    order_count: int
    total_spent: float


class AnalyticsSummary(BaseModel):
    total_revenue: float
    today_revenue: float
    total_orders: int
    today_orders: int
    average_order_value: float
    active_orders_count: int
    orders_by_status: Dict[str, int]
    top_selling_items: List[TopItemStat]
    daily_sales: List[DailySalesStat]
    table_stats: List[TableOrderStat]
