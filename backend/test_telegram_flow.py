import asyncio
import httpx
import json

async def run_test():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=30.0) as client:
        # 1. Fetch menu items to get a valid item id
        menu_res = await client.get("/api/v1/menu/items")
        if menu_res.status_code != 200:
            print(f"Failed to fetch menu: {menu_res.text}")
            return
        items = menu_res.json()
        if not items:
            print("No items in menu")
            return
        
        target_item = items[0]
        print(f"Selected item: {target_item['name']} (${target_item['price']})")

        # 2. Place an Online Delivery Order with ABA Pay
        order_payload = {
            "order_type": "delivery",
            "customer_name": "Pery Piseth",
            "customer_phone": "+855 12 345 678",
            "delivery_address": "Street 2004, Sen Sok, Phnom Penh",
            "payment_method": "aba_pay",
            "tip": 1.0,
            "special_requests": "Extra spicy sauce and utensils please",
            "items": [
                {
                    "menu_item_id": target_item["id"],
                    "quantity": 2,
                    "notes": "Less sugar",
                    "customizations": {
                        "Size": "Large",
                        "Ice": "Normal"
                    }
                }
            ]
        }

        print("Placing delivery order...")
        order_res = await client.post("/api/v1/orders", json=order_payload)
        if order_res.status_code not in (200, 201):
            print(f"Order creation failed: {order_res.status_code} - {order_res.text}")
            return

        order_data = order_res.json()
        order_id = order_data["id"]
        order_num = order_data["order_number"]
        print(f"Order created successfully: #{order_num} (ID: {order_id})")
        print("Telegram order notification should be arriving in chat!")

        # 3. Simulate KHQR payment approval
        print("\nSimulating payment approval...")
        pay_res = await client.post("/api/v1/payments/simulate-success", json={"order_id": order_id})
        print(f"Payment simulation result: {pay_res.status_code} - {pay_res.text}")
        print("Telegram payment success notification should be arriving in chat!")

if __name__ == "__main__":
    asyncio.run(run_test())
