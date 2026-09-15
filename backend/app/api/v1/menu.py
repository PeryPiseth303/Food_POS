from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.db.session import get_db
from app.models.menu import Category, MenuItem
from app.schemas.menu import (
    FullMenuResponse, CategoryWithItems, MenuItemOut, MenuItemCreate,
    MenuItemUpdate, CategoryCreate, CategoryUpdate, CategoryOut
)
from app.core.config import settings
from app.api.deps import get_current_admin

router = APIRouter(prefix="/menu", tags=["Menu Management"])


@router.get("", response_model=FullMenuResponse)
async def get_public_menu(db: AsyncSession = Depends(get_db)):
    """
    Returns active menu items grouped by active categories for customers.
    Fast and ready for client caching / ISR.
    """
    stmt = (
        select(Category)
        .where(Category.is_active == True)
        .options(selectinload(Category.items))
        .order_by(Category.sort_order)
    )
    result = await db.execute(stmt)
    categories = result.scalars().all()

    categories_out = []
    for cat in categories:
        active_items = [
            MenuItemOut.model_validate(item)
            for item in cat.items
            if item.is_available
        ]
        cat_dict = CategoryOut.model_validate(cat).model_dump()
        cat_dict["items"] = active_items
        categories_out.append(CategoryWithItems(**cat_dict))

    return FullMenuResponse(
        restaurant_name=settings.RESTAURANT_NAME,
        currency_symbol=settings.CURRENCY_SYMBOL,
        categories=categories_out
    )


@router.get("/admin", response_model=List[CategoryWithItems])
async def get_admin_menu(
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    """Returns all categories and items (including out-of-stock items) for management."""
    stmt = (
        select(Category)
        .options(selectinload(Category.items))
        .order_by(Category.sort_order)
    )
    result = await db.execute(stmt)
    categories = result.scalars().all()

    categories_out = []
    for cat in categories:
        items = [MenuItemOut.model_validate(item) for item in cat.items]
        cat_dict = CategoryOut.model_validate(cat).model_dump()
        cat_dict["items"] = items
        categories_out.append(CategoryWithItems(**cat_dict))

    return categories_out


@router.post("/categories", response_model=CategoryOut)
async def create_category(
    category_in: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    new_cat = Category(**category_in.model_dump())
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return new_cat


@router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    cat_update: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    res = await db.execute(select(Category).where(Category.id == category_id))
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = cat_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cat, field, value)

    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    res = await db.execute(select(Category).where(Category.id == category_id))
    cat = res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(cat)
    await db.commit()
    return {"message": "Category deleted successfully"}


@router.post("/items", response_model=MenuItemOut)
async def create_menu_item(
    item_in: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    cat_res = await db.execute(select(Category).where(Category.id == item_in.category_id))
    if not cat_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Category ID does not exist")

    new_item = MenuItem(**item_in.model_dump())
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return new_item


@router.put("/items/{item_id}", response_model=MenuItemOut)
async def update_menu_item(
    item_id: int,
    item_update: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    res = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    update_data = item_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/items/{item_id}/availability", response_model=MenuItemOut)
async def toggle_item_availability(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    res = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    item.is_available = not item.is_available
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}")
async def delete_menu_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    admin=Depends(get_current_admin)
):
    res = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Menu item deleted successfully"}
