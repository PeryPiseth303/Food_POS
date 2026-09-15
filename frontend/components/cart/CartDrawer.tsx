"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { createOrder, updateCustomerProfile } from "@/lib/api";
import {
  X,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  QrCode,
  Banknote,
  Sparkles,
  Loader2,
  MapPin,
  Phone,
  User,
  Home,
  Utensils,
  CheckCircle2,
  LogIn
} from "lucide-react";
import { toast } from "sonner";
import CustomerAuthModal from "@/components/auth/CustomerAuthModal";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter();
  const {
    cart,
    removeFromCart,
    updateQuantity,
    clearCart,
    subtotal,
    tax,
    tip,
    setTip,
    total,
    tableSession,
    orderType,
    setOrderType,
    customer,
    customerToken,
    updateCustomerStore,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    deliveryAddress,
    setDeliveryAddress,
    specialRequests,
    setSpecialRequests,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState("mock_card");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  if (!isOpen) return null;

  const isDelivery = orderType === "delivery";

  const tipOptions = [
    { label: "0%", rate: 0 },
    { label: "10%", rate: 0.10 },
    { label: "15%", rate: 0.15 },
    { label: "20%", rate: 0.20 },
  ];

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }

    if (isDelivery) {
      if (!customerName.trim()) {
        toast.error("Please enter your name for online delivery.");
        return;
      }
      if (!customerPhone.trim()) {
        toast.error("Please enter your phone number so the driver can reach you.");
        return;
      }
      if (!deliveryAddress.trim()) {
        toast.error("Please provide your delivery address / location.");
        return;
      }
    } else {
      if (!tableSession) {
        toast.error("Please select or scan a dining table, or switch to 'Order from Home'.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        order_type: orderType,
        table_id: isDelivery ? null : tableSession?.table_id,
        session_token: isDelivery ? null : tableSession?.session_token,
        customer_id: customer?.id || null,
        customer_name: customerName.trim() || (isDelivery ? "Customer" : "Guest"),
        customer_phone: customerPhone.trim() || undefined,
        delivery_address: isDelivery ? deliveryAddress.trim() : undefined,
        special_requests: specialRequests.trim() || undefined,
        payment_method: paymentMethod,
        tip: tip,
        items: cart.map((item) => ({
          menu_item_id: item.menu_item.id,
          quantity: item.quantity,
          customizations: item.customizations || {},
          notes: item.notes || undefined,
        })),
      };

      const createdOrder = await createOrder(orderPayload);

      // If customer is logged in, auto-save phone & delivery address to their profile for future orders
      if (customer && customerToken && (customerPhone.trim() || (isDelivery && deliveryAddress.trim()))) {
        updateCustomerProfile({
          full_name: customerName.trim() || customer.full_name,
          phone: customerPhone.trim() || customer.phone || undefined,
          delivery_address: isDelivery ? deliveryAddress.trim() : (customer.delivery_address || undefined),
        }, customerToken).then((updated) => {
          updateCustomerStore(updated);
        }).catch(() => {});
      }

      toast.success(
        isDelivery
          ? `Online Order #${createdOrder.order_number} received! Dispatched to kitchen & delivery.`
          : `Order #${createdOrder.order_number} confirmed! Sent to kitchen.`
      );
      clearCart();
      onClose();
      router.push(`/orders/${createdOrder.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to place order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-md bg-card border-l border-border shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card/80 backdrop-blur-md sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg text-foreground">Your Order</h2>
                  {isDelivery ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      🏠 Home Delivery
                    </span>
                  ) : tableSession ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                      Table #{tableSession.table_number}
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      🍽️ Dine-In
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{cart.length} unique items in cart</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Order Mode Switcher (Dine-In vs Order from Home) */}
            <div className="px-4 pt-3 pb-1 border-b border-border/70 bg-secondary/20">
              <span className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Ordering For:
              </span>
              <div className="grid grid-cols-2 gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => setOrderType("delivery")}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    isDelivery
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                      : "bg-card border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Order from Home</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderType("dine_in")}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    !isDelivery
                      ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/20"
                      : "bg-card border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Dine-In at Shop</span>
                </button>
              </div>
            </div>

            {/* Cart Item List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <span className="text-4xl mb-2">🍽️</span>
                  <p className="font-semibold text-sm">Your order is empty</p>
                  <p className="text-xs mt-1">Explore our menu and add something delicious!</p>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div
                      key={item.cart_id}
                      className="flex gap-3 bg-secondary/30 rounded-2xl p-3 border border-border/70 items-center"
                    >
                      {item.menu_item.image_url && (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-900">
                          <Image
                            src={item.menu_item.image_url}
                            alt={item.menu_item.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-semibold text-xs text-foreground truncate">
                            {item.menu_item.name}
                          </h4>
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                            {formatCurrency(item.total_price)}
                          </span>
                        </div>

                        {/* Customization Badges */}
                        {item.customizations && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(item.customizations).map(([k, v]) => {
                              if (!v) return null;
                              const text = Array.isArray(v)
                                ? v.map((x: any) => (typeof x === "object" ? x.name : x)).join(", ")
                                : String(v);
                              return (
                                <span
                                  key={k}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100/70 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 font-medium"
                                >
                                  {text}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="flex items-center border border-border rounded-lg bg-card">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.cart_id, -1)}
                              className="p-1 hover:bg-secondary rounded-l-lg text-muted-foreground hover:text-foreground"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-bold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.cart_id, 1)}
                              className="p-1 hover:bg-secondary rounded-r-lg text-muted-foreground hover:text-foreground"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cart_id)}
                            className="text-[11px] text-muted-foreground hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Customer Account Banner */}
                  <div className="p-3 rounded-2xl bg-secondary/50 border border-border/80 flex items-center justify-between">
                    {customer ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">
                            Logged in as {customer.full_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            Saved phone & address loaded
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground">Have an online account?</p>
                          <p className="text-[10px] text-muted-foreground">Sign in to save your address</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-2.5 py-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline shrink-0"
                    >
                      {customer ? "Manage" : "Sign In"}
                    </button>
                  </div>

                  {/* Customer Details Form */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        {isDelivery ? "Your Name *" : "Guest Name (Optional)"}
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required={isDelivery}
                          placeholder="e.g. Alex Johnson"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-orange-500/50"
                        />
                      </div>
                    </div>

                    {/* Online Delivery Fields */}
                    {isDelivery && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1">
                            Phone Number * (for delivery driver)
                          </label>
                          <div className="relative">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="tel"
                              required
                              placeholder="e.g. +1 555-0199"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-orange-500/50"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1">
                            Delivery Location / Address *
                          </label>
                          <div className="relative">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
                            <textarea
                              rows={2}
                              required
                              placeholder="House/Apt #, Street, City, Landmark"
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-orange-500/50 resize-none"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Special Instructions {isDelivery ? "(Gate code, doorbell, etc.)" : "(Optional)"}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Please ring doorbell"
                        value={specialRequests}
                        onChange={(e) => setSpecialRequests(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-input bg-background text-foreground focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>

                  {/* Tip Selector */}
                  <div className="pt-3 border-t border-border/70">
                    <span className="block text-xs font-semibold text-foreground mb-1.5">
                      Tip the Kitchen & {isDelivery ? "Driver" : "Staff"}
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {tipOptions.map((opt) => {
                        const amount = Math.round(subtotal * opt.rate * 100) / 100;
                        const isSelected = tip === amount;
                        return (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() => setTip(amount)}
                            className={`py-1.5 px-2 rounded-xl text-center text-xs font-semibold border transition-all ${
                              isSelected
                                ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="pt-3 border-t border-border/70">
                    <span className="block text-xs font-semibold text-foreground mb-1.5">
                      Payment Method
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("mock_card")}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                          paymentMethod === "mock_card"
                            ? "bg-orange-50 border-orange-500 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200 shadow-sm"
                            : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-orange-600" />
                        <span className="text-[10px] font-bold">Online Card</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("aba_pay")}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                          paymentMethod === "aba_pay"
                            ? "bg-orange-50 border-orange-500 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200 shadow-sm"
                            : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        <QrCode className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-bold">KHQR / ABA</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod(isDelivery ? "cash_on_delivery" : "cash")}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 text-center transition-all ${
                          paymentMethod === "cash" || paymentMethod === "cash_on_delivery"
                            ? "bg-orange-50 border-orange-500 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200 shadow-sm"
                            : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span className="text-[10px] font-bold">
                          {isDelivery ? "Cash on Delivery" : "Pay at Counter"}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Checkout Footer */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-border bg-card/90 backdrop-blur-md space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax (8%)</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  {tip > 0 && (
                    <div className="flex justify-between text-orange-600 dark:text-orange-400 font-medium">
                      <span>{isDelivery ? "Driver Tip" : "Staff Tip"}</span>
                      <span>{formatCurrency(tip)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-1.5 border-t border-border">
                    <span>Total Amount</span>
                    <span className="text-orange-600 dark:text-orange-400">{formatCurrency(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Transmitting Order...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {isDelivery
                        ? `Place Delivery Order (${formatCurrency(total)})`
                        : `Place Dine-In Order (${formatCurrency(total)})`}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Account Dialog */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
