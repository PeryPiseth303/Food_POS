import io
import base64
import hmac
import hashlib
import logging
import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import qrcode
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.order import Order
from app.services.websocket_manager import ws_manager
from app.services.telegram_service import send_telegram_payment_success_notification

logger = logging.getLogger("payment_service")

# In-memory checkout initiation timestamps for dev auto-approval verification if enabled
ORDER_PAYMENT_INITIATED: Dict[int, float] = {}


def compute_aba_payway_hash(data_str: str, api_key: str) -> str:
    """
    Computes HMAC-SHA512 base64 signature for ABA PayWay API requests.
    """
    signature = hmac.new(
        api_key.encode("utf-8"),
        data_str.encode("utf-8"),
        hashlib.sha512
    ).digest()
    return base64.b64encode(signature).decode("utf-8")


def calculate_crc16_ccitt(data: str) -> str:
    """
    Computes standard CRC16-CCITT checksum for ABA Pay EMVCo QR string.
    Polynomial: 0x1021, Initial: 0xFFFF
    """
    crc = 0xFFFF
    for b in data.encode("utf-8"):
        crc ^= (b << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def build_aba_pay_qr_string(
    account_id: str,
    merchant_name: str,
    merchant_city: str,
    amount: float,
    bill_number: str,
    currency: str = "USD"
) -> str:
    """
    Generates authentic, standard EMVCo QR string for ABA Bank accounts.
    Scannable directly by ABA Mobile app camera, ACLEDA, and Cambodian banking apps.
    Routes payments directly to the merchant's ABA Bank account.
    """
    currency_code = "840" if currency.upper() == "USD" else "116"
    amount_str = f"{amount:.2f}" if currency.upper() == "USD" else str(int(amount))
    clean_acc = account_id.strip()
    clean_name = (merchant_name or "Bistro Moderne")[:25].strip()
    clean_city = (merchant_city or "Phnom Penh")[:15].strip()

    # Tag 29: Domestic Merchant Account Information (ABA Bank Account Identifier)
    acc_sub = f"00{len(clean_acc):02d}{clean_acc}"
    tag29 = f"29{len(acc_sub):02d}{acc_sub}"

    # Tag 62: Additional Data (Order reference bill number)
    tag62 = ""
    if bill_number:
        sub01 = f"01{len(bill_number):02d}{bill_number}"
        tag62 = f"62{len(sub01):02d}{sub01}"

    # Tag 99: Dynamic Expiration Timestamp (15 minutes)
    now_ms = str(int(time.time() * 1000))
    exp_ms = str(int(time.time() * 1000) + 15 * 60 * 1000)
    tag99_val = f"0013{now_ms}0113{exp_ms}"
    tag99 = f"99{len(tag99_val):02d}{tag99_val}"

    raw = (
        "000201"
        "010212"
        f"{tag29}"
        "52045999"
        f"5303{currency_code}"
        f"54{len(amount_str):02d}{amount_str}"
        "5802KH"
        f"59{len(clean_name):02d}{clean_name}"
        f"60{len(clean_city):02d}{clean_city}"
        f"{tag62}"
        f"{tag99}"
        "6304"
    )
    crc = calculate_crc16_ccitt(raw)
    return f"{raw}{crc}"


def generate_qr_image_data_uri(qr_data_string: str) -> str:
    """
    Renders a high-contrast, crisp ABA PayWay QR PNG image as a data:image/png;base64 URI.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(qr_data_string)
    qr.make(fit=True)

    # ABA navy fill on pure white background
    img = qr.make_image(fill_color="#004876", back_color="#ffffff")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


# Alias for backwards compatibility
generate_khqr_image_data_uri = generate_qr_image_data_uri


async def create_order_khqr(order: Order, db: AsyncSession) -> Dict[str, Any]:
    """
    Generates dynamic ABA PayWay payment details for an order.
    1. Attempts official ABA PayWay Gateway API if merchant credentials are valid.
    2. Builds official ABA Pay dynamic EMVCo scannable QR (routes to configured merchant ABA Account).
    """
    amount_usd = float(order.total_amount)
    amount_khr = int(amount_usd * settings.EXCHANGE_RATE_USD_KHR)
    transaction_id = order.order_number
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()

    qr_string = ""
    qr_image = ""
    deeplink = ""
    provider_used = "aba_payway"
    is_live = False

    # Build direct ABA PayWay Dynamic Link for the merchant's account
    acc_num = settings.ABA_PAY_USD_ACC or ""
    aba_payment_link = ""
    if settings.ABA_PAY_KEY_ID and settings.ABA_PAY_CODE and acc_num:
        aba_payment_link = (
            f"https://link.payway.com.kh/aba?id={settings.ABA_PAY_KEY_ID}&code={settings.ABA_PAY_CODE}&acc={acc_num}&amount={amount_usd:.2f}"
        )
    elif acc_num:
        aba_payment_link = f"https://link.payway.com.kh/aba?acc={acc_num}&amount={amount_usd:.2f}"

    # 1. Attempt official ABA PayWay API if merchant ID and API Key are configured
    if settings.ABA_PAYWAY_MERCHANT_ID and settings.ABA_PAYWAY_API_KEY:
        try:
            from aba_sdk import PaywayClient, PaywayConfig, Environment
            from aba_sdk.models import QRRequest, Currency, PaymentOption

            env = (
                Environment.sandbox
                if "sandbox" in settings.ABA_PAYWAY_BASE_URL.lower()
                else Environment.production
            )
            config = PaywayConfig(
                merchant_id=settings.ABA_PAYWAY_MERCHANT_ID.strip(),
                api_key=settings.ABA_PAYWAY_API_KEY.strip(),
                env=env,
                timeout=5,
            )
            client = PaywayClient(config)

            first_name = order.customer_name.split()[0] if order.customer_name else "Customer"
            last_name = (
                order.customer_name.split()[-1]
                if order.customer_name and len(order.customer_name.split()) > 1
                else "Guest"
            )
            cust_email = "guest@restaurant.com"
            customer_obj = order.__dict__.get("customer")
            if customer_obj and hasattr(customer_obj, "email"):
                cust_email = customer_obj.email or cust_email

            qr_req = QRRequest(
                tran_id=transaction_id,
                amount=amount_usd,
                currency=Currency.USD,
                payment_option=PaymentOption.ABAPAY_KHQR,
                first_name=first_name,
                last_name=last_name,
                email=cust_email,
                phone=order.customer_phone or "012345678",
                lifetime=15,
            )
            loop = asyncio.get_running_loop()
            payway_resp = await loop.run_in_executor(None, client.qr.generate_qr, qr_req)

            if payway_resp and payway_resp.qr_string:
                qr_string = payway_resp.qr_string
                if payway_resp.qr_image:
                    qr_image = payway_resp.qr_image if payway_resp.qr_image.startswith("data:") else f"data:image/png;base64,{payway_resp.qr_image}"
                deeplink = payway_resp.abapay_deeplink or ""
                is_live = True
                provider_used = "aba_payway_live"
                logger.info(f"Successfully generated live ABA PayWay QR for order #{order.order_number}")
        except Exception as err:
            logger.info(f"[ABA PayWay API] Direct API skipped ({err}); using standard ABA Pay QR.")

    # 2. ABA Pay / Bakong KHQR Scannable QR
    if not qr_string:
        routing_acc = (
            getattr(settings, "ABA_PAY_ACCOUNT_ID", None)
            or (f"{settings.ABA_PAY_USD_ACC.strip()}@aba" if settings.ABA_PAY_USD_ACC else "")
        ).strip()
        merchant_name = settings.ABA_PAYWAY_MERCHANT_NAME or settings.RESTAURANT_NAME or "Bistro Moderne"
        merchant_city = settings.ABA_PAYWAY_MERCHANT_CITY or "Phnom Penh"

        # Check if routing_acc is a placeholder
        is_placeholder = (not routing_acc) or (routing_acc in ("2809299@aba", "merchant@aba", "@aba"))

        if not is_placeholder and "@" in routing_acc:
            # Generate official NBC Bakong KHQR code
            try:
                from bakong_khqr import KHQR
                k = KHQR()
                qr_string = k.create_qr(
                    account_id=routing_acc,
                    merchant_name=merchant_name,
                    merchant_city=merchant_city,
                    amount=amount_usd,
                    currency="USD",
                    bill_number=transaction_id,
                    expiration=15
                )
                provider_used = "khqr_bakong"
            except Exception as b_err:
                logger.warning(f"bakong_khqr failed ({b_err}); using custom EMVCo builder.")
                qr_string = build_aba_pay_qr_string(
                    account_id=routing_acc,
                    merchant_name=merchant_name,
                    merchant_city=merchant_city,
                    amount=amount_usd,
                    bill_number=transaction_id,
                    currency="USD",
                )
                provider_used = "aba_pay_emvco"
        elif aba_payment_link:
            # If no valid Bakong ID yet, encode direct ABA Mobile payment link into QR code
            qr_string = aba_payment_link
            provider_used = "aba_payway_link"
        else:
            qr_string = build_aba_pay_qr_string(
                account_id=routing_acc or "merchant@aba",
                merchant_name=merchant_name,
                merchant_city=merchant_city,
                amount=amount_usd,
                bill_number=transaction_id,
                currency="USD",
            )
            provider_used = "aba_pay_emvco"

        order.payment_intent_id = hashlib.md5(qr_string.encode("utf-8")).hexdigest()
    else:
        order.payment_intent_id = transaction_id

    if not qr_image:
        qr_image = generate_qr_image_data_uri(qr_string)

    if not deeplink:
        if aba_payment_link:
            deeplink = aba_payment_link
        else:
            deeplink = f"abamobilebank://pay?qr={qr_string}"

    # Track checkout initiation time
    ORDER_PAYMENT_INITIATED[order.id] = time.time()
    await db.commit()

    logger.info(
        f"Prepared ABA PayWay QR for order #{order.order_number} "
        f"via {provider_used} (Account: {acc_num})"
    )

    return {
        "success": True,
        "order_id": order.id,
        "order_number": order.order_number,
        "amount_usd": amount_usd,
        "amount_khr": amount_khr,
        "qr_string": qr_string,
        "qr_image": qr_image,
        "abapay_deeplink": deeplink,
        "aba_payment_link": aba_payment_link,
        "transaction_id": transaction_id,
        "md5": order.payment_intent_id,
        "expires_at": expires_at,
        "provider": provider_used,
        "is_sandbox": not is_live,
        "message": f"Scan with ABA Mobile or tap 'Open in ABA Mobile App' to pay ${amount_usd:.2f} via ABA PayWay."
    }


async def verify_order_payment(order_id: int, db: AsyncSession, transaction_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Checks payment status for an order via ABA PayWay.
    1. If already marked paid, returns confirmed.
    2. If ABA PayWay credentials configured, checks official PayWay transaction status.
    3. If dev auto-confirm is enabled, marks paid once timeout elapses.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()

    if not order:
        return {"error": "Order not found", "is_paid": False, "payment_status": "not_found"}

    if order.payment_status == "paid":
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": "paid",
            "is_paid": True,
            "payment_method": order.payment_method,
            "message": "Payment already confirmed."
        }

    is_confirmed = False
    tran_id = transaction_id or order.order_number

    # 1. Check with official ABA PayWay API if credentials are present
    if settings.ABA_PAYWAY_MERCHANT_ID and settings.ABA_PAYWAY_API_KEY:
        try:
            from aba_sdk import PaywayClient, PaywayConfig, Environment
            env = (
                Environment.sandbox
                if "sandbox" in settings.ABA_PAYWAY_BASE_URL.lower()
                else Environment.production
            )
            config = PaywayConfig(
                merchant_id=settings.ABA_PAYWAY_MERCHANT_ID.strip(),
                api_key=settings.ABA_PAYWAY_API_KEY.strip(),
                env=env,
                timeout=4,
            )
            client = PaywayClient(config)
            loop = asyncio.get_running_loop()
            check_resp = await loop.run_in_executor(None, client.check_transaction.check, tran_id)
            if check_resp and check_resp.status.is_success and check_resp.data.is_approved:
                is_confirmed = True
                logger.info(f"Official ABA PayWay confirmed payment for order #{order.order_number} (APV: {check_resp.data.apv})")
        except Exception as err:
            logger.debug(f"ABA PayWay SDK check: {err}")

        # Fallback to direct PayWay check-transaction REST API
        if not is_confirmed:
            base_url = settings.ABA_PAYWAY_BASE_URL.rstrip("/")
            req_time = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            merchant_id = settings.ABA_PAYWAY_MERCHANT_ID.strip()
            api_key = settings.ABA_PAYWAY_API_KEY.strip()

            check_endpoint = f"{base_url}/api/payment-gateway/v1/payments/check-transaction-2"
            data_to_hash = f"{req_time}{merchant_id}{tran_id}"
            hash_val = compute_aba_payway_hash(data_to_hash, api_key)

            try:
                async with httpx.AsyncClient(timeout=4.0) as client:
                    res = await client.post(
                        check_endpoint,
                        json={
                            "req_time": req_time,
                            "merchant_id": merchant_id,
                            "tran_id": tran_id,
                            "hash": hash_val,
                        }
                    )
                    if res.status_code == 200:
                        resp_json = res.json()
                        status_obj = resp_json.get("status")
                        status_code = status_obj.get("code") if isinstance(status_obj, dict) else status_obj
                        resp_data = resp_json.get("data", {}) if isinstance(resp_json.get("data"), dict) else {}
                        payment_status = str(resp_data.get("payment_status", "")).upper()

                        if status_code in (0, "0", "00") or payment_status in ("APPROVED", "PAID", "SUCCESS", "COMPLETED"):
                            is_confirmed = True
                            logger.info(f"ABA PayWay REST API confirmed payment for order #{order.order_number}")
            except Exception as err:
                logger.debug(f"ABA PayWay REST API check: {err}")

    # 2. Automatic payment detection in development mode (enabled when AUTO_CONFIRM_PAYMENT_SECONDS > 0)
    if not is_confirmed and settings.AUTO_CONFIRM_PAYMENT_SECONDS > 0:
        initiated_at = ORDER_PAYMENT_INITIATED.get(order.id)
        if not initiated_at:
            ORDER_PAYMENT_INITIATED[order.id] = time.time()
            initiated_at = ORDER_PAYMENT_INITIATED[order.id]

        elapsed = time.time() - initiated_at
        if elapsed >= settings.AUTO_CONFIRM_PAYMENT_SECONDS:
            is_confirmed = True
            logger.info(
                f"Auto-confirmed payment for order #{order.order_number} "
                f"after {elapsed:.1f}s scanning duration (dev auto-confirm)."
            )

    if is_confirmed:
        await mark_order_as_paid(order, db, provider="aba_payway")
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "payment_status": "paid",
            "is_paid": True,
            "payment_method": order.payment_method,
            "message": "Payment verified and confirmed successfully via ABA PayWay."
        }

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "payment_status": order.payment_status,
        "is_paid": False,
        "payment_method": order.payment_method,
        "message": "Payment pending transfer confirmation."
    }


async def mark_order_as_paid(order: Order, db: AsyncSession, provider: str = "aba_payway") -> bool:
    """
    Sets order payment_status to 'paid', commits to DB, broadcasts WebSocket updates,
    and sends a Telegram confirmation alert with full receipt details.
    """
    order.payment_status = "paid"
    if order.status == "pending":
        order.status = "confirmed"  # Advance order to kitchen confirmed queue upon payment
    await db.commit()

    # Re-fetch with eager loaded relationships to avoid greenlet IO error
    stmt = (
        select(Order)
        .where(Order.id == order.id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    full_order = res.scalar_one()

    # Build sanitized order payload
    order_payload = {
        "id": full_order.id,
        "order_number": full_order.order_number,
        "status": full_order.status,
        "payment_status": full_order.payment_status,
        "payment_method": full_order.payment_method,
        "order_type": full_order.order_type,
        "customer_name": full_order.customer_name,
        "customer_phone": full_order.customer_phone,
        "delivery_address": full_order.delivery_address,
        "total_amount": float(full_order.total_amount),
        "subtotal": float(full_order.subtotal),
        "tax_amount": float(full_order.tax or 0.0),
        "delivery_fee": 0.0,
        "table_id": full_order.table_id,
        "table_number": full_order.table.table_number if full_order.table else None,
        "created_at": full_order.created_at.isoformat() if full_order.created_at else None,
        "items": [
            {
                "id": item.id,
                "menu_item_id": item.menu_item_id,
                "item_name": item.item_name,
                "unit_price": float(item.unit_price),
                "quantity": item.quantity,
                "total_price": float(item.item_total),
                "customizations": item.customizations,
            }
            for item in full_order.items
        ],
    }

    # 1. Notify customer via order websocket
    await ws_manager.send_order_update(order.id, {"event": "payment_confirmed", "data": order_payload})

    # 2. Notify kitchen and admin dashboard
    await ws_manager.broadcast_to_admins({"event": "order_payment_received", "data": order_payload})

    # 3. Alert staff via Telegram
    try:
        await send_telegram_payment_success_notification(order_payload)
    except Exception as exc:
        logger.warning(f"Could not send Telegram payment alert: {exc}")

    logger.info(f"Order #{order.order_number} marked as PAID via {provider}")
    return True


async def simulate_payment_success(order_id: int, db: AsyncSession) -> Dict[str, Any]:
    """
    Staff / Cashier helper: Marks payment as successful for counter / manual confirmation.
    """
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.table))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()

    if not order:
        return {"success": False, "error": "Order not found"}

    await mark_order_as_paid(order, db, provider="aba_payway_manual")
    return {
        "success": True,
        "order_id": order.id,
        "order_number": order.order_number,
        "payment_status": "paid",
        "message": "Payment confirmed via ABA PayWay!"
    }
