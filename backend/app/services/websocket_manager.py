import json
import logging
from typing import Dict, Set
from fastapi import WebSocket

logger = logging.getLogger("websocket")


class ConnectionManager:
    def __init__(self):
        # Admin connections: set of WebSockets
        self.admin_connections: Set[WebSocket] = set()
        # Order-specific customer connections: order_id -> set of WebSockets
        self.order_connections: Dict[int, Set[WebSocket]] = {}

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.add(websocket)
        logger.info(f"Admin WebSocket connected. Total admin connections: {len(self.admin_connections)}")

    def disconnect_admin(self, websocket: WebSocket):
        self.admin_connections.discard(websocket)
        logger.info(f"Admin WebSocket disconnected. Total admin connections: {len(self.admin_connections)}")

    async def connect_order(self, order_id: int, websocket: WebSocket):
        await websocket.accept()
        if order_id not in self.order_connections:
            self.order_connections[order_id] = set()
        self.order_connections[order_id].add(websocket)
        logger.info(f"Customer WebSocket connected for Order #{order_id}")

    def disconnect_order(self, order_id: int, websocket: WebSocket):
        if order_id in self.order_connections:
            self.order_connections[order_id].discard(websocket)
            if not self.order_connections[order_id]:
                del self.order_connections[order_id]
        logger.info(f"Customer WebSocket disconnected for Order #{order_id}")

    async def broadcast_to_admins(self, message: dict):
        """Send message to all active admin dashboards."""
        data = json.dumps(message)
        dead_connections = set()
        for conn in self.admin_connections:
            try:
                await conn.send_text(data)
            except Exception as e:
                logger.error(f"Error sending message to admin WS: {e}")
                dead_connections.add(conn)
        for dead in dead_connections:
            self.admin_connections.discard(dead)

    async def send_order_update(self, order_id: int, message: dict):
        """Send message to customer watching their specific order."""
        data = json.dumps(message)
        if order_id in self.order_connections:
            dead_connections = set()
            for conn in self.order_connections[order_id]:
                try:
                    await conn.send_text(data)
                except Exception as e:
                    logger.error(f"Error sending message to order WS #{order_id}: {e}")
                    dead_connections.add(conn)
            for dead in dead_connections:
                self.order_connections[order_id].discard(dead)


ws_manager = ConnectionManager()
