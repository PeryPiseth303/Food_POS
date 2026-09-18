import { FullMenuResponse, TableSession, Order, AnalyticsSummary, TableData, Category, MenuItem, CustomerUser, CustomerTokenResponse, CustomerRegisterResponse, CustomerResendOtpResponse, StaffNotification, KhqrPaymentData, PaymentStatusData } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_V1 = `${API_BASE_URL}/api/v1`;

function getAuthHeader(): Record<string, string> {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("admin_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

function getCustomerAuthHeader(tokenOverride?: string): Record<string, string> {
  if (tokenOverride) {
    return { Authorization: `Bearer ${tokenOverride}` };
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("customer_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

// ==========================================
// Customer Authentication & Profile API
// ==========================================
export async function registerCustomer(payload: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  delivery_address?: string;
}): Promise<CustomerRegisterResponse> {
  const res = await fetch(`${API_V1}/customer/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }
  return await res.json();
}

export async function verifyCustomerOtp(payload: {
  email: string;
  otp_code: string;
}): Promise<CustomerTokenResponse> {
  const res = await fetch(`${API_V1}/customer/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Verification failed" }));
    throw new Error(err.detail || "Verification failed");
  }
  const data: CustomerTokenResponse = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("customer_token", data.access_token);
    localStorage.setItem("customer_user", JSON.stringify(data.customer));
  }
  return data;
}

export async function resendCustomerOtp(payload: {
  email: string;
}): Promise<CustomerResendOtpResponse> {
  const res = await fetch(`${API_V1}/customer/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to resend code" }));
    throw new Error(err.detail || "Failed to resend code");
  }
  return await res.json();
}

export async function loginCustomer(payload: {
  email: string;
  password: string;
}): Promise<CustomerTokenResponse> {
  const res = await fetch(`${API_V1}/customer/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    const errorMsg = typeof err.detail === "string" ? err.detail : (err.detail?.message || "Invalid email or password");
    const errorObj = new Error(errorMsg) as any;
    if (res.status === 403 && errorMsg.includes("EMAIL_NOT_VERIFIED")) {
      errorObj.requiresVerification = true;
      errorObj.email = payload.email;
    }
    throw errorObj;
  }
  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("customer_token", data.access_token);
    localStorage.setItem("customer_user", JSON.stringify(data.customer));
  }
  return data;
}

export async function requestCustomerLoginOtp(email: string): Promise<{
  success: boolean;
  email: string;
  message: string;
  debug_otp?: string;
}> {
  const res = await fetch(`${API_V1}/customer/request-login-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase() })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to send login code" }));
    throw new Error(err.detail || "Failed to send login code");
  }
  return await res.json();
}

export async function loginWithCustomerOtp(payload: {
  email: string;
  otp_code: string;
}): Promise<CustomerTokenResponse> {
  const res = await fetch(`${API_V1}/customer/login-with-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email.trim().toLowerCase(),
      otp_code: payload.otp_code.trim()
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Invalid login code" }));
    throw new Error(err.detail || "Invalid login code");
  }
  const data: CustomerTokenResponse = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("customer_token", data.access_token);
    localStorage.setItem("customer_user", JSON.stringify(data.customer));
  }
  return data;
}

export async function getCustomerProfile(token?: string): Promise<CustomerUser> {
  const res = await fetch(`${API_V1}/customer/me`, {
    headers: { ...getCustomerAuthHeader(token) },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to load customer profile");
  }
  return res.json();
}

export async function updateCustomerProfile(payload: {
  full_name?: string;
  phone?: string;
  delivery_address?: string;
}, token?: string): Promise<CustomerUser> {
  const res = await fetch(`${API_V1}/customer/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getCustomerAuthHeader(token)
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update profile" }));
    throw new Error(err.detail || "Update profile failed");
  }
  const updated = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("customer_user", JSON.stringify(updated));
  }
  return updated;
}

export async function getCustomerOrders(token?: string): Promise<Order[]> {
  const res = await fetch(`${API_V1}/customer/orders`, {
    headers: { ...getCustomerAuthHeader(token) },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to load customer orders");
  }
  return res.json();
}

// 1. Table Validation
export async function validateTable(
  tableIdentifier: string,
  token?: string,
  lat?: number,
  lng?: number
): Promise<TableSession> {
  const params = new URLSearchParams();
  if (token) params.append("token", token);
  if (lat) params.append("lat", lat.toString());
  if (lng) params.append("lng", lng.toString());

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_V1}/tables/${tableIdentifier}/validate${query}`, {
    cache: "no-store"
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to validate table" }));
    throw new Error(err.detail || "Invalid table QR code");
  }
  return res.json();
}

export async function getTableActiveOrders(tableIdentifier: string): Promise<Order[]> {
  const res = await fetch(`${API_V1}/tables/${tableIdentifier}/active-orders`, {
    cache: "no-store"
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

// 2. Customer Menu
export async function getPublicMenu(): Promise<FullMenuResponse> {
  const res = await fetch(`${API_V1}/menu`, {
    next: { revalidate: 30 } // Next.js ISR cache
  });
  if (!res.ok) {
    throw new Error("Failed to load restaurant menu");
  }
  return res.json();
}

// 3. Customer Order Creation & Tracking
export async function createOrder(orderPayload: any): Promise<Order> {
  const res = await fetch(`${API_V1}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to place order" }));
    throw new Error(err.detail || "Order checkout failed");
  }
  return res.json();
}

export async function getOrder(orderId: number): Promise<Order> {
  const res = await fetch(`${API_V1}/orders/${orderId}`, {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Order not found");
  }
  return res.json();
}

// 4. Admin Auth
export async function adminLogin(email: string, password: string): Promise<{ access_token: string; user_name: string; role: string }> {
  const res = await fetch(`${API_V1}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Invalid credentials");
  }
  const data = await res.json();
  if (typeof window !== "undefined") {
    localStorage.setItem("admin_token", data.access_token);
    localStorage.setItem("admin_user", JSON.stringify(data));
  }
  return data;
}

// 5. Admin Orders
export async function getAdminOrders(status?: string): Promise<Order[]> {
  const query = status && status !== "all" ? `?status=${status}` : "";
  const res = await fetch(`${API_V1}/orders${query}`, {
    headers: { ...getAuthHeader() },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to fetch orders");
  }
  return res.json();
}

export async function updateOrderStatus(orderId: number, status: string): Promise<Order> {
  const res = await fetch(`${API_V1}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update order status" }));
    throw new Error(err.detail || "Status update failed");
  }
  return res.json();
}

// 6. Admin Menu Manager
export async function getAdminMenu(): Promise<Category[]> {
  const res = await fetch(`${API_V1}/menu/admin`, {
    headers: { ...getAuthHeader() },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to load admin menu");
  }
  return res.json();
}

export async function toggleMenuItemAvailability(itemId: number): Promise<MenuItem> {
  const res = await fetch(`${API_V1}/menu/items/${itemId}/availability`, {
    method: "PATCH",
    headers: { ...getAuthHeader() }
  });
  if (!res.ok) {
    throw new Error("Failed to toggle item availability");
  }
  return res.json();
}

export async function createMenuItem(itemData: any): Promise<MenuItem> {
  const res = await fetch(`${API_V1}/menu/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify(itemData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create menu item" }));
    throw new Error(err.detail || "Failed to create menu item");
  }
  return res.json();
}

export async function updateMenuItem(itemId: number, itemData: any): Promise<MenuItem> {
  const res = await fetch(`${API_V1}/menu/items/${itemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify(itemData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update menu item" }));
    throw new Error(err.detail || "Failed to update item");
  }
  return res.json();
}

export async function deleteMenuItem(itemId: number): Promise<void> {
  const res = await fetch(`${API_V1}/menu/items/${itemId}`, {
    method: "DELETE",
    headers: { ...getAuthHeader() }
  });
  if (!res.ok) {
    throw new Error("Failed to delete menu item");
  }
}

// 7. Admin Tables & QR
export async function getTables(): Promise<TableData[]> {
  const res = await fetch(`${API_V1}/tables`, {
    headers: { ...getAuthHeader() },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to fetch tables");
  }
  return res.json();
}

export async function createTable(tableNumber: string, capacity: number): Promise<TableData> {
  const res = await fetch(`${API_V1}/tables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader()
    },
    body: JSON.stringify({ table_number: tableNumber, capacity })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create table" }));
    throw new Error(err.detail || "Failed to create table");
  }
  return res.json();
}

export async function getTableQr(tableId: number): Promise<{ qr_image_base64: string; target_url: string; table_number: string }> {
  const res = await fetch(`${API_V1}/tables/${tableId}/qr`, {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to generate table QR");
  }
  return res.json();
}

// 8. Admin Analytics
export async function getSalesAnalytics(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_V1}/analytics/sales`, {
    headers: { ...getAuthHeader() },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error("Failed to fetch analytics data");
  }
  return res.json();
}

// ==========================================
// 9. Staff Notifications API
// ==========================================
export async function callStaff(tableNumber: string | number, message?: string): Promise<StaffNotification> {
  const tbl = String(tableNumber || "1").trim();
  const res = await fetch(`${API_V1}/notifications/call-staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table_number: tbl,
      notification_type: "call_staff",
      message: message || `Table #${tbl} requested staff assistance.`
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to alert staff" }));
    const errorMsg = Array.isArray(err.detail)
      ? err.detail.map((d: any) => d.msg || "").join(", ")
      : typeof err.detail === "string"
      ? err.detail
      : "Failed to alert staff";
    throw new Error(errorMsg || "Failed to alert staff");
  }
  return res.json();
}

export async function getStaffNotifications(): Promise<StaffNotification[]> {
  const res = await fetch(`${API_V1}/notifications`, {
    headers: { ...getAuthHeader() },
    cache: "no-store"
  });
  if (!res.ok) return [];
  return res.json();
}

export async function resolveStaffNotification(id: number): Promise<StaffNotification> {
  const res = await fetch(`${API_V1}/notifications/${id}/resolve`, {
    method: "PATCH",
    headers: { ...getAuthHeader() }
  });
  if (!res.ok) throw new Error("Failed to resolve notification");
  return res.json();
}

export async function clearAllNotifications(): Promise<{ message: string }> {
  const res = await fetch(`${API_V1}/notifications/clear`, {
    method: "DELETE",
    headers: { ...getAuthHeader() }
  });
  if (!res.ok) throw new Error("Failed to clear notifications");
  return res.json();
}

// ==========================================
// KHQR & ABA PayWay Payment Gateway API
// ==========================================
export async function createKhqrPayment(orderId: number): Promise<KhqrPaymentData> {
  const res = await fetch(`${API_V1}/payments/create-qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to generate KHQR code" }));
    throw new Error(err.detail || "Failed to generate KHQR code");
  }
  return res.json();
}

export async function checkPaymentStatus(orderId: number, transactionId?: string): Promise<PaymentStatusData> {
  const res = await fetch(`${API_V1}/payments/check-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId, transaction_id: transactionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to check payment status" }));
    throw new Error(err.detail || "Failed to check payment status");
  }
  return res.json();
}

export async function simulatePaymentApproval(orderId: number): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_V1}/payments/simulate-success`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to simulate payment" }));
    throw new Error(err.detail || "Failed to simulate payment");
  }
  return res.json();
}
