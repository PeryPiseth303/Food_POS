from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.customer_auth import router as customer_auth_router
from app.api.v1.tables import router as tables_router
from app.api.v1.menu import router as menu_router
from app.api.v1.orders import router as orders_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.websocket import router as ws_router
from app.api.v1.notifications import router as notifications_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(customer_auth_router)
api_router.include_router(tables_router)
api_router.include_router(menu_router)
api_router.include_router(orders_router)
api_router.include_router(analytics_router)
api_router.include_router(ws_router)
api_router.include_router(notifications_router)
