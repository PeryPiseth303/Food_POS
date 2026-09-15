from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class MenuItemBase(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_available: bool = True
    is_popular: bool = False
    dietary_tags: Optional[str] = ""
    customizations: Optional[List[Dict[str, Any]]] = []
    sort_order: int = 0


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    is_popular: Optional[bool] = None
    dietary_tags: Optional[str] = None
    customizations: Optional[List[Dict[str, Any]]] = None
    sort_order: Optional[int] = None


class MenuItemOut(MenuItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryBase(BaseModel):
    name: str
    icon: str = "Utensils"
    sort_order: int = 0
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryOut(CategoryBase):
    id: int

    class Config:
        from_attributes = True


class CategoryWithItems(CategoryOut):
    items: List[MenuItemOut] = []


class FullMenuResponse(BaseModel):
    restaurant_name: str
    currency_symbol: str
    categories: List[CategoryWithItems]
