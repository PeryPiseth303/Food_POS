import logging
import httpx
from datetime import datetime, timezone
from app.core.config import settings

logger = logging.getLogger("telegram_service")


async def send_telegram_order_notification(order_data: dict) -> bool:
    """
    Sends an official payment receipt to Telegram staff/admin group ONLY when the order is paid.
    If the order is pending/unpaid, notification is suppressed until payment confirmation.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    pay_status = str(order_data.get("payment_status", "")).strip().lower()
    if pay_status != "paid":
        logger.info(
            f"Telegram receipt suppressed for order {order_data.get('order_number')}: "
            f"status is '{pay_status}' (not paid yet)."
        )
        return False

    order_type = order_data.get("order_type", "dine_in")
    is_delivery = order_type == "delivery"
    order_num = order_data.get("order_number", "N/A")
    cust_name = order_data.get("customer_name", "Guest")
    cust_phone = order_data.get("customer_phone") or "Not provided"
    delivery_loc = order_data.get("delivery_address") or "Not specified"
    table_num = order_data.get("table_number") or "N/A"
    pay_method = order_data.get("payment_method", "mock_card")
    pay_status = order_data.get("payment_status", "paid").upper()
    total_amt = float(order_data.get("total_amount") or 0)
    subtotal = float(order_data.get("subtotal") or 0)
    tax = float(order_data.get("tax") or 0)
    tip = float(order_data.get("tip") or 0)
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

    # Format payment method for display
    method_labels = {
        "aba_pay": "ABA Pay (KHQR)",
        "mock_card": "Online Credit/Debit Card",
        "cash_on_delivery": "Cash on Delivery",
        "cash": "Cash at Counter"
    }
    pay_method_label = method_labels.get(pay_method, pay_method.upper())
    pay_status_label = "PAID ✅" if pay_status == "PAID" else "PENDING ⏳"
    khr_total = int(float(total_amt) * settings.EXCHANGE_RATE_USD_KHR)

    # Cambodia local time (UTC+7)
    from datetime import timezone as dt_tz, timedelta as dt_timedelta
    tz_cambodia = dt_tz(dt_timedelta(hours=7))
    local_time_str = datetime.now(tz_cambodia).strftime("%d/%m/%Y %I:%M %p")

    url = f"https://api.telegram.org/bot{token}/sendMessage"

    if is_delivery:
        header_section = (
            f"🧾 *OFFICIAL PAYMENT RECEIPT (PAID)*\n"
            f"🛵 *Online Delivery (From Home)*\n\n"
            f"🏷️ *Order Number:* `{order_num}`\n"
            f"👤 *Customer:* *{cust_name}*\n"
            f"📞 *Phone:* *{cust_phone}*\n"
            f"📍 *Delivery Address:* *{delivery_loc}*\n"
            f"💳 *Payment Method:* *{pay_method_label}*\n"
            f"📊 *Payment Status:* *{pay_status_label}*"
        )
    else:
        header_section = (
            f"🧾 *OFFICIAL PAYMENT RECEIPT (PAID)*\n"
            f"🍽️ *Dine-In Serving (Shop)*\n\n"
            f"🏷️ *Order Number:* `{order_num}`\n"
            f"🪑 *Table:* *Table #{table_num}*\n"
            f"👤 *Customer:* *{cust_name}*\n"
            f"📞 *Phone:* {cust_phone}\n"
            f"💳 *Payment Method:* *{pay_method_label}*\n"
            f"📊 *Payment Status:* *{pay_status_label}*"
        )

    message = (
        f"═════════════════════════════\n"
        f"{header_section}\n"
        f"─────────────────────────────\n"
        f"📋 *Food Items Ordered:*\n\n"
        f"{items_formatted}\n"
        f"─────────────────────────────\n"
        f"💵 *Subtotal:* `${subtotal:.2f}`\n"
        f"🧾 *Tax (8%):* `${tax:.2f}`\n"
        f"🪙 *Tip:* `${tip:.2f}`\n"
        f"💰 *TOTAL PAID:* *${total_amt:.2f}* (≈ *៛{khr_total:,}*)\n"
        f"{special_req_formatted}\n"
        f"⏱️ *Order Time:* {local_time_str}\n\n"
        f"─────────────────────────────\n"
        f"🍳 Kitchen order moved to active queue.\n"
        f"🔗 [Open Admin & Kitchen Dashboard]({settings.FRONTEND_URL}/admin/dashboard)\n\n"
        f"═════════════════════════════\n"
        f"   🧾 RECEIPT #{order_num} COMPLETED\n"
        f"═════════════════════════════\n\n"
    )

    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
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


async def send_telegram_payment_success_notification(order_data: dict) -> bool:
    """
    Sends the official payment receipt to Telegram staff/admin group when ABA Pay / KHQR payment succeeds.
    """
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_ADMIN_CHAT_ID

    order_num = order_data.get("order_number", "N/A")
    cust_name = order_data.get("customer_name", "Guest")
    cust_phone = order_data.get("customer_phone") or "Not provided"
    order_type = order_data.get("order_type", "dine_in")
    is_delivery = order_type == "delivery"
    delivery_loc = order_data.get("delivery_address") or "Not specified"
    table_num = order_data.get("table_number") or "N/A"

    total_amt = float(order_data.get("total_amount", 0))
    subtotal = float(order_data.get("subtotal", 0))
    tax = float(order_data.get("tax", 0))
    tip = float(order_data.get("tip", 0))
    khr_amt = int(total_amt * settings.EXCHANGE_RATE_USD_KHR)

    pay_method = order_data.get("payment_method", "aba_pay")
    method_labels = {
        "aba_pay": "ABA Pay (KHQR)",
        "mock_card": "Online Card",
        "cash_on_delivery": "Cash on Delivery",
        "cash": "Cash at Counter"
    }
    pay_method_label = method_labels.get(pay_method, pay_method.upper())
    items_list = order_data.get("items", [])

    from datetime import timezone as dt_tz, timedelta as dt_timedelta
    tz_cambodia = dt_tz(dt_timedelta(hours=7))
    local_time_str = datetime.now(tz_cambodia).strftime("%d/%m/%Y %I:%M %p")

    if not token or not chat_id or token == "your_bot_token":
        logger.info(f"[MOCK TELEGRAM RECEIPT] Order #{order_num} PAID: ${total_amt:.2f} ({pay_method_label})")
        return False

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
    items_formatted = "".join(items_text_list) if items_text_list else "• Details on dashboard\n"

    special_req = order_data.get("special_requests")
    special_req_formatted = f"\n📝 *Special Instructions:* {special_req}\n" if special_req else ""

    if is_delivery:
        header_section = (
            f"🧾 *OFFICIAL PAYMENT RECEIPT (PAID)*\n"
            f"🛵 *Online Delivery (From Home)*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🏷️ *Order Number:* `{order_num}`\n"
            f"👤 *Customer:* *{cust_name}*\n"
            f"📞 *Phone:* *{cust_phone}*\n"
            f"📍 *Delivery Address:* *{delivery_loc}*\n"
            f"💳 *Payment Method:* *{pay_method_label}*\n"
            f"📊 *Payment Status:* *PAID ✅*\n"
        )
    else:
        header_section = (
            f"🧾 *OFFICIAL PAYMENT RECEIPT (PAID)*\n"
            f"🍽️ *Dine-In Serving (Shop)*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🏷️ *Order Number:* `{order_num}`\n"
            f"🪑 *Table:* *Table #{table_num}*\n"
            f"👤 *Customer:* *{cust_name}*\n"
            f"📞 *Phone:* {cust_phone}\n"
            f"💳 *Payment Method:* *{pay_method_label}*\n"
            f"📊 *Payment Status:* *PAID ✅*\n"
        )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    message = (
        f"{header_section}"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"📋 *Items Ordered:*\n"
        f"{items_formatted}"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"💵 *Subtotal:* `${subtotal:.2f}`\n"
        f"🧾 *Tax (8%):* `${tax:.2f}`\n"
        f"🪙 *Tip:* `${tip:.2f}`\n"
        f"💰 *TOTAL PAID:* *${total_amt:.2f}* (≈ *៛{khr_amt:,}*)\n"
        f"{special_req_formatted}"
        f"⏱️ *Paid Time:* {local_time_str}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🍳 Kitchen order moved to active queue.\n"
        f"🔗 [Open Admin & Kitchen Dashboard]({settings.FRONTEND_URL}/admin/dashboard)"
    )

    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Telegram receipt sent successfully for order {order_num}")
                return True
            else:
                logger.error(f"Telegram API responded with {response.status_code}: {response.text}")
                return False
    except Exception as exc:
        logger.error(f"Failed to send Telegram payment confirmation: {exc}")
        return False


