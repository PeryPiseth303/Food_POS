import logging
import httpx
from datetime import datetime, timezone
from app.core.config import settings

logger = logging.getLogger("telegram_service")


async def send_telegram_order_notification(order_data: dict) -> bool:
    """
    Sends an immediate Telegram notification to the restaurant staff / admin group
    when an order is created or paid. Handles both Dine-in and Online Delivery orders.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    order_type = order_data.get("order_type", "dine_in")
    is_delivery = order_type == "delivery"
    order_num = order_data.get("order_number", "N/A")
    cust_name = order_data.get("customer_name", "Guest")
    cust_phone = order_data.get("customer_phone") or "Not provided"
    delivery_loc = order_data.get("delivery_address") or "Not specified"
    table_num = order_data.get("table_number") or "N/A"
    pay_method = order_data.get("payment_method", "mock_card")
    pay_status = order_data.get("payment_status", "paid").upper()
    total_amt = order_data.get("total_amount", 0)
    items_list = order_data.get("items", [])
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    # Format items for both Telegram and console
    items_text_list = []
    for item in items_list:
        cust_str = ""
        customizations = item.get("customizations")
        if customizations and isinstance(customizations, dict):
            opts = [f"{k}: {v}" for k, v in customizations.items() if v]
            if opts:
                cust_str = f"   ↳ _{', '.join(opts)}_\n"
        
        notes_str = f"   ↳ Note: {item.get('notes')}\n" if item.get("notes") else ""
        items_text_list.append(
            f"• *{item.get('quantity')}x* {item.get('item_name')} — `${item.get('item_total', 0):.2f}`\n{cust_str}{notes_str}"
        )

    items_formatted = "".join(items_text_list)
    special_req = order_data.get("special_requests")
    special_req_formatted = f"\n📝 *Special Instructions:* {special_req}\n" if special_req else ""

    if not token or not chat_id or token == "your_bot_token":
        logger.warning("Telegram bot token or admin chat ID not configured. Logging mock notification.")
        channel_label = "ONLINE DELIVERY (FROM HOME)" if is_delivery else "DINE-IN (SHOP PLACE)"
        mock_msg = (
            f"\n{'=' * 65}\n"
            f"[MOCK TELEGRAM NOTIFICATION DISPATCHED]\n"
            f"Channel: {channel_label}\n"
            f"Order: {order_num}\n"
            f"{('Customer: ' + str(cust_name) + chr(10) + 'Phone: ' + str(cust_phone) + chr(10) + 'Location: ' + str(delivery_loc)) if is_delivery else ('Table: #' + str(table_num) + chr(10) + 'Guest: ' + str(cust_name))}\n"
            f"Payment: {pay_method} ({pay_status})\n"
            f"Total: ${total_amt:.2f}\n"
            f"Time: {now_str}\n"
            f"Items: {len(items_list)} items\n"
            f"{'=' * 65}\n"
        )
        try:
            print(mock_msg)
        except Exception:
            logger.info("Mock Telegram message dispatched for %s", order_num)
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    if is_delivery:
        header_section = (
            f"🏠 *NEW ONLINE DELIVERY ORDER (FROM HOME)*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🏷️ *Order:* `{order_num}`\n"
            f"👤 *Customer:* *{cust_name}*\n"
            f"📞 *Phone:* *{cust_phone}*\n"
            f"📍 *Location:* *{delivery_loc}*\n"
            f"💳 *Payment:* *{pay_method}* ({pay_status})\n"
        )
    else:
        header_section = (
            f"🍽️ *NEW DINE-IN ORDER (SHOP PLACE)*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🏷️ *Order:* `{order_num}`\n"
            f"🪑 *Table:* *Table #{table_num}*\n"
            f"👤 *Customer:* {cust_name}\n"
            f"💳 *Payment:* *{pay_method}* ({pay_status})\n"
        )

    message = (
        f"{header_section}"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"*Order Items:*\n"
        f"{items_formatted}"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💵 *Subtotal:* `${order_data.get('subtotal', 0):.2f}`\n"
        f"🧾 *Tax:* `${order_data.get('tax', 0):.2f}`\n"
        f"🪙 *Tip:* `${order_data.get('tip', 0):.2f}`\n"
        f"💰 *TOTAL:* `${total_amt:.2f}`\n"
        f"{special_req_formatted}"
        f"⏱️ *Time:* {now_str}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🔗 [Open Admin Dashboard]({settings.FRONTEND_URL}/admin/dashboard)"
    )

    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Telegram notification sent for order {order_num}")
                return True
            else:
                logger.error(f"Telegram API responded with {response.status_code}: {response.text}")
                return False
    except Exception as exc:
        logger.error(f"Failed to send Telegram notification: {exc}")
        return False
