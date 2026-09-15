"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { CartItem, MenuItem, TableSession, CustomerUser, OrderType } from "./types";

interface CartContextType {
  // Table info
  tableSession: TableSession | null;
  setTableSession: (session: TableSession | null) => void;
  // Order Mode (Dine-in vs Delivery from home)
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  // Customer Account
  customer: CustomerUser | null;
  customerToken: string | null;
  loginCustomerStore: (customer: CustomerUser, token: string) => void;
  logoutCustomerStore: () => void;
  updateCustomerStore: (customer: CustomerUser) => void;
  // Cart
  cart: CartItem[];
  addToCart: (item: MenuItem, quantity: number, customizations?: any, notes?: string) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, delta: number) => void;
  clearCart: () => void;
  // Totals
  subtotal: number;
  tax: number;
  tip: number;
  setTip: (amount: number) => void;
  total: number;
  itemCount: number;
  // Customer details for checkout
  customerName: string;
  setCustomerName: (name: string) => void;
  customerPhone: string;
  setCustomerPhone: (phone: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (address: string) => void;
  specialRequests: string;
  setSpecialRequests: (req: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [tableSession, setTableSessionState] = useState<TableSession | null>(null);
  const [orderType, setOrderTypeState] = useState<OrderType>("dine_in");
  const [customer, setCustomerState] = useState<CustomerUser | null>(null);
  const [customerToken, setCustomerTokenState] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tip, setTip] = useState<number>(0);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhoneState] = useState<string>("");
  const [deliveryAddress, setDeliveryAddressState] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState<string>("");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const savedTable = localStorage.getItem("food_table_session");
      if (savedTable) setTableSessionState(JSON.parse(savedTable));

      const savedCart = localStorage.getItem("food_cart");
      if (savedCart) setCart(JSON.parse(savedCart));

      const savedOrderType = localStorage.getItem("food_order_type") as OrderType;
      if (savedOrderType) setOrderTypeState(savedOrderType);

      const savedToken = localStorage.getItem("customer_token");
      const savedUserStr = localStorage.getItem("customer_user");
      if (savedToken && savedUserStr) {
        const u = JSON.parse(savedUserStr);
        setCustomerTokenState(savedToken);
        setCustomerState(u);
        setCustomerName(u.full_name || "");
        if (u.phone) setCustomerPhoneState(u.phone);
        if (u.delivery_address) setDeliveryAddressState(u.delivery_address);
      } else {
        const savedName = localStorage.getItem("food_customer_name");
        if (savedName) setCustomerName(savedName);
        const savedPhone = localStorage.getItem("food_customer_phone");
        if (savedPhone) setCustomerPhoneState(savedPhone);
        const savedAddr = localStorage.getItem("food_delivery_address");
        if (savedAddr) setDeliveryAddressState(savedAddr);
      }
    } catch (e) {
      console.error("Failed to restore session from localStorage", e);
    }
  }, []);

  // Persist cart
  useEffect(() => {
    try {
      localStorage.setItem("food_cart", JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to save cart", e);
    }
  }, [cart]);

  const setTableSession = useCallback((session: TableSession | null) => {
    setTableSessionState(session);
    if (session) {
      localStorage.setItem("food_table_session", JSON.stringify(session));
      setOrderTypeState("dine_in");
      localStorage.setItem("food_order_type", "dine_in");
    } else {
      localStorage.removeItem("food_table_session");
    }
  }, []);

  const setOrderType = useCallback((type: OrderType) => {
    setOrderTypeState(type);
    localStorage.setItem("food_order_type", type);
  }, []);

  const loginCustomerStore = useCallback((user: CustomerUser, token: string) => {
    setCustomerState(user);
    setCustomerTokenState(token);
    localStorage.setItem("customer_token", token);
    localStorage.setItem("customer_user", JSON.stringify(user));
    if (user.full_name) {
      setCustomerName(user.full_name);
      localStorage.setItem("food_customer_name", user.full_name);
    }
    if (user.phone) {
      setCustomerPhoneState(user.phone);
      localStorage.setItem("food_customer_phone", user.phone);
    }
    if (user.delivery_address) {
      setDeliveryAddressState(user.delivery_address);
      localStorage.setItem("food_delivery_address", user.delivery_address);
    }
  }, []);

  const logoutCustomerStore = useCallback(() => {
    setCustomerState(null);
    setCustomerTokenState(null);
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_user");
  }, []);

  const updateCustomerStore = useCallback((user: CustomerUser) => {
    setCustomerState(user);
    localStorage.setItem("customer_user", JSON.stringify(user));
    if (user.full_name) setCustomerName(user.full_name);
    if (user.phone) setCustomerPhoneState(user.phone);
    if (user.delivery_address) setDeliveryAddressState(user.delivery_address);
  }, []);

  const handleSetName = useCallback((name: string) => {
    setCustomerName(name);
    localStorage.setItem("food_customer_name", name);
  }, []);

  const handleSetPhone = useCallback((phone: string) => {
    setCustomerPhoneState(phone);
    localStorage.setItem("food_customer_phone", phone);
  }, []);

  const handleSetAddress = useCallback((address: string) => {
    setDeliveryAddressState(address);
    localStorage.setItem("food_delivery_address", address);
  }, []);

  const addToCart = (
    item: MenuItem,
    quantity: number,
    customizations: any = {},
    notes: string = ""
  ) => {
    // Generate unique ID based on item ID and customizations
    const custKey = JSON.stringify(customizations || {});
    const cartId = `${item.id}-${btoa(encodeURIComponent(custKey))}`;

    // Calculate item unit price with any paid options
    let unitPrice = Number(item.price);
    if (customizations && customizations.extras && Array.isArray(customizations.extras)) {
      for (const ext of customizations.extras) {
        if (ext && ext.price) unitPrice += Number(ext.price);
      }
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.cart_id === cartId);
      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + quantity;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          total_price: newQty * unitPrice,
          notes: notes || updated[existingIdx].notes
        };
        return updated;
      } else {
        const newItem: CartItem = {
          cart_id: cartId,
          menu_item: item,
          quantity,
          customizations,
          notes,
          unit_price: unitPrice,
          total_price: unitPrice * quantity
        };
        return [...prev, newItem];
      }
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cart_id !== cartId));
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cart_id === cartId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              total_price: newQty * item.unit_price
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem("food_cart");
  };

  // Computations
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + tax + tip) * 100) / 100;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        tableSession,
        setTableSession,
        orderType,
        setOrderType,
        customer,
        customerToken,
        loginCustomerStore,
        logoutCustomerStore,
        updateCustomerStore,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal,
        tax,
        tip,
        setTip,
        total,
        itemCount,
        customerName,
        setCustomerName: handleSetName,
        customerPhone,
        setCustomerPhone: handleSetPhone,
        deliveryAddress,
        setDeliveryAddress: handleSetAddress,
        specialRequests,
        setSpecialRequests
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
