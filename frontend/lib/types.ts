export interface CustomizationChoice {
  name: string;
  price?: number;
}

export interface CustomizationOption {
  id: string;
  name: string;
  type: "single" | "multiple";
  required?: boolean;
  options: (string | CustomizationChoice)[];
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_popular: boolean;
  dietary_tags?: string;
  customizations?: CustomizationOption[];
  sort_order: number;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  items: MenuItem[];
}

export interface FullMenuResponse {
  restaurant_name: string;
  currency_symbol: string;
  categories: Category[];
}

export interface CartItemCustomization {
  [key: string]: string | string[] | { name: string; price: number }[];
}

export interface CartItem {
  cart_id: string; // unique string for same item with different options
  menu_item: MenuItem;
  quantity: number;
  customizations?: CartItemCustomization;
  notes?: string;
  unit_price: number;
  total_price: number;
}

export interface OrderItemOut {
  id: number;
  menu_item_id?: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  customizations?: Record<string, any>;
  notes?: string;
}

export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "served" | "cancelled";
export type OrderType = "dine_in" | "delivery";

export interface Order {
  id: number;
  order_number: string;
  order_type?: OrderType;
  table_id?: number | null;
  table_number?: string | null;
  customer_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  delivery_address?: string | null;
  special_requests?: string | null;
  status: OrderStatus;
  payment_status: "pending" | "paid" | "failed";
  payment_method: string;
  subtotal: number;
  tax: number;
  tip: number;
  total_amount: number;
  estimated_prep_minutes: number;
  created_at: string;
  updated_at: string;
  items: OrderItemOut[];
}

export interface TableSession {
  is_valid: boolean;
  table_id: number;
  table_number: string;
  session_token: string;
  restaurant_name: string;
  message: string;
}

export interface TableData {
  id: number;
  table_number: string;
  capacity: number;
  qr_code_token: string;
  is_active: boolean;
  created_at: string;
  qr_url?: string;
}

export interface AnalyticsSummary {
  total_revenue: number;
  today_revenue: number;
  total_orders: number;
  today_orders: number;
  average_order_value: number;
  active_orders_count: number;
  orders_by_status: Record<string, number>;
  top_selling_items: { name: string; quantity_sold: number; revenue: number }[];
  daily_sales: { date: string; total_sales: number; order_count: number }[];
  table_stats: { table_number: string; order_count: number; total_spent: number }[];
}

export interface CustomerUser {
  id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  delivery_address?: string | null;
  created_at: string;
}

export interface CustomerTokenResponse {
  access_token: string;
  token_type: string;
  customer: CustomerUser;
}

export interface CreateOrderPayload {
  order_type?: OrderType;
  table_id?: number | null;
  session_token?: string | null;
  customer_id?: number | null;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  special_requests?: string;
  payment_method: string;
  tip: number;
  items: {
    menu_item_id: number;
    quantity: number;
    customizations?: any;
    notes?: string;
  }[];
}
