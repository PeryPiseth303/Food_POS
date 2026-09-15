import urllib.request
import json

API_URL = "http://localhost:8000/api/v1"

def post_json(url, data, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get_json(url, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def main():
    print("=== 1. Testing Customer Registration & Login ===")
    reg_data = {
        "email": "customer.test@example.com",
        "password": "Password123!",
        "full_name": "Sarah Connor",
        "phone": "+1 202-555-0199",
        "delivery_address": "8404 Cyberdyne Way, Sector 7, Los Angeles, CA"
    }
    status, body = post_json(f"{API_URL}/customer/register", reg_data)
    if status == 400:
        status, body = post_json(f"{API_URL}/customer/login", {"email": reg_data["email"], "password": reg_data["password"]})
    
    assert status == 200, f"Auth failed with {status}: {body}"
    token = body["access_token"]
    print(f"Customer Authenticated! Token received.")

    print("\n=== 2. Testing Customer Profile Retrieval ===")
    s, profile = get_json(f"{API_URL}/customer/me", token)
    assert s == 200
    print(f"Profile: Name='{profile['full_name']}', Phone='{profile['phone']}', Address='{profile['delivery_address']}'")

    print("\n=== 3. Testing Placing Online Delivery Order ===")
    s, menu = get_json(f"{API_URL}/menu")
    first_item = menu["categories"][0]["items"][0]
    print(f"Ordering item: '{first_item['name']}' ($ {first_item['price']})")

    order_payload = {
        "order_type": "delivery",
        "customer_name": profile["full_name"],
        "customer_phone": profile["phone"],
        "delivery_address": profile["delivery_address"],
        "customer_id": profile["id"],
        "table_id": None,
        "payment_method": "card",
        "special_requests": "Doorcode #4321, leave at apartment door.",
        "tip": 4.00,
        "items": [
            {
                "menu_item_id": first_item["id"],
                "quantity": 2,
                "notes": "No onions, extra sauce please"
            }
        ]
    }
    s, created_order = post_json(f"{API_URL}/orders", order_payload)
    assert s == 200, f"Order failed with {s}: {created_order}"
    print(f"Order Placed! Number: {created_order['order_number']}")
    print(f"Order Type: {created_order['order_type']}")
    print(f"Table Number Display: {created_order['table_number']}")
    print(f"Customer Name: {created_order['customer_name']}")
    print(f"Customer Phone: {created_order['customer_phone']}")
    print(f"Delivery Address: {created_order['delivery_address']}")
    print(f"Total Amount: ${created_order['total_amount']:.2f}")

    print("\n=== 4. Testing Customer Past Orders ===")
    s, cust_orders = get_json(f"{API_URL}/customer/orders", token)
    assert s == 200
    print(f"Customer has {len(cust_orders)} order(s) in history.")
    found_in_cust = any(o["order_number"] == created_order["order_number"] for o in cust_orders)
    assert found_in_cust, "Order not found in customer order history!"
    print(f"Order successfully found in customer's order history.")

    print("\n=== 5. Testing Admin Live Board & Dashboard ===")
    s, admin_auth = post_json(f"{API_URL}/auth/login", {"email": "admin@modernfood.com", "password": "adminpassword123"})
    assert s == 200, f"Admin login failed: {admin_auth}"
    admin_token = admin_auth["access_token"]
    
    s, admin_orders = get_json(f"{API_URL}/orders", admin_token)
    assert s == 200
    target_admin_order = next((o for o in admin_orders if o["order_number"] == created_order["order_number"]), None)
    assert target_admin_order is not None, "Order not found in admin orders list!"
    print(f"Order #{target_admin_order['order_number']} verified in Admin Board!")
    print(f"  - Order Type: {target_admin_order['order_type']}")
    print(f"  - Delivery Address: {target_admin_order['delivery_address']}")
    print(f"  - Customer Phone: {target_admin_order['customer_phone']}")
    print(f"  - Current Status: {target_admin_order['status']}")

    print("\n=== 6. Testing Order Status Update by Staff ===")
    req = urllib.request.Request(
        f"{API_URL}/orders/{target_admin_order['id']}/status",
        data=json.dumps({"status": "preparing"}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"},
        method="PATCH"
    )
    with urllib.request.urlopen(req) as resp:
        updated = json.loads(resp.read().decode("utf-8"))
    assert updated["status"] == "preparing"
    print(f"Staff moved Order #{updated['order_number']} to status: {updated['status']}")

    print("\n=======================================================")
    print("ALL 6 PHASES PASSED WITH 100% SUCCESS!")
    print("=======================================================")

if __name__ == "__main__":
    main()
