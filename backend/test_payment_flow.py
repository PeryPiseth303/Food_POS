import asyncio
from app.db.session import async_session_factory
from app.models.order import Order
from app.services.payment_service import (
    generate_qr_image_data_uri,
    create_order_khqr,
    verify_order_payment,
    simulate_payment_success,
)
from sqlalchemy import select


async def test_full_payment_flow():
    print("==================================================")
    print("Testing Official ABA PayWay Payment System")
    print("==================================================")

    # 1. Test QR Image Generation
    test_link = "https://link.payway.com.kh/aba?acc=000000000&amount=18.50"
    img_data_uri = generate_qr_image_data_uri(test_link)
    assert img_data_uri.startswith("data:image/png;base64,"), "QR image must be valid PNG Base64 data URI"
    print(f"ABA PayWay QR Image rendered: {img_data_uri[:40]}... (Length: {len(img_data_uri)} bytes)")

    # 2. Test Database Order Payment Generation
    async with async_session_factory() as db:
        # Fetch or verify an existing order
        stmt = select(Order).order_by(Order.id.desc()).limit(1)
        res = await db.execute(stmt)
        order = res.scalar_one_or_none()
        if not order:
            print("No existing order found to test with.")
            return

        print(f"Using Order #{order.order_number} (ID: {order.id}, Total: ${order.total_amount:.2f})")
        
        # Test create_order_khqr (ABA PayWay)
        pay_data = await create_order_khqr(order, db)
        assert pay_data["success"] is True
        assert pay_data["amount_usd"] == float(order.total_amount)
        assert pay_data["amount_khr"] > 0
        assert pay_data["qr_string"].startswith("000201"), "QR string must be authentic EMVCo KHQR format starting with 000201"
        assert pay_data["provider"] in ("aba_pay_p2p", "khqr_bakong", "aba_payway_live", "aba_pay_emvco", "aba_payway")
        assert pay_data["aba_payment_link"] is not None
        assert "link.payway.com.kh" in pay_data["aba_payment_link"]
        print(f"ABA PayWay payment data successfully generated: provider={pay_data['provider']}")
        print(f"ABA Payment Link: {pay_data['aba_payment_link']}")
        print(f"ABA Deep Link: {pay_data['abapay_deeplink']}")

        # 3. Test Payment Status Check
        status_res = await verify_order_payment(order.id, db)
        print(f"Initial Payment Status Check: is_paid={status_res.get('is_paid')}, status={status_res.get('payment_status')}")

        # 4. Test Payment Approval Simulation (Cashier/Admin)
        sim_res = await simulate_payment_success(order.id, db)
        assert sim_res["success"] is True
        print(f"Payment Approval Confirmation: {sim_res['message']}")

        # 5. Re-verify Order Status
        re_status = await verify_order_payment(order.id, db)
        assert re_status["is_paid"] is True
        assert re_status["payment_status"] == "paid"
        print("Re-verification confirmed: Order is marked as PAID via ABA PayWay!")

    print("==================================================")
    print("ALL ABA PAYWAY PAYMENT TESTS PASSED!")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(test_full_payment_flow())
