import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/ws", tags=["WebSockets"])
logger = logging.getLogger("websocket")


@router.websocket("/admin")
async def websocket_admin_endpoint(websocket: WebSocket):
    """
    Real-time channel for Admin/Kitchen dashboard.
    Receives instant events when a customer places an order or updates status.
    """
    await ws_manager.connect_admin(websocket)
    try:
        while True:
            # Keep socket alive and allow ping/pong messages
            data = await websocket.receive_text()
            # Echo or handle ping
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)
    except Exception as e:
        logger.error(f"WebSocket admin error: {e}")
        ws_manager.disconnect_admin(websocket)


@router.websocket("/orders/{order_id}")
async def websocket_order_endpoint(websocket: WebSocket, order_id: int):
    """
    Real-time channel for a customer tracking their specific order on their phone.
    """
    await ws_manager.connect_order(order_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect_order(order_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket order #{order_id} error: {e}")
        ws_manager.disconnect_order(order_id, websocket)
