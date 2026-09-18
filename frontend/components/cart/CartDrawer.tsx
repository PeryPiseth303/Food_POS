"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { createOrder, updateCustomerProfile, validateTable } from "@/lib/api";
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
  LogIn,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Edit3
} from "lucide-react";
import { toast } from "sonner";
import CustomerAuthModal from "@/components/auth/CustomerAuthModal";
import { KhqrPaymentModal } from "./KhqrPaymentModal";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRescanTable?: () => void;
}

export default function CartDrawer({ isOpen, onClose, onRescanTable }: CartDrawerProps) {
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
    setTableSession,
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
    setActiveOrderId,
    addActiveOrderId,
  } = useCart();

  const [paymentMethod, setPaymentMethod] = useState("aba_pay");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [khqrOrderId, setKhqrOrderId] = useState<number | null>(null);
  const [isKhqrOpen, setIsKhqrOpen] = useState<boolean>(false);

  const handleKhqrPaymentSuccess = (paidOrderId: number) => {
    setIsKhqrOpen(false);
    clearCart();
    onClose();
    router.push(`/orders/${paidOrderId}`);
  };

  const handleKhqrModalClose = () => {
    setIsKhqrOpen(false);
    if (khqrOrderId) {
      clearCart();
      onClose();
      router.push(`/orders/${khqrOrderId}`);
    }
  };

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
      if (!customer) {
        setIsAuthModalOpen(true);
        toast.info("Account Required for Delivery", {
          description: "Please sign in or create an account to complete your delivery order.",
        });
        return;
      }
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
        try {
          const fallbackSession = await validateTable("1");
          setTableSession(fallbackSession);
        } catch {
          toast.error("Please select a dining table or switch to Home Delivery.");
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        order_type: orderType,
        table_id: isDelivery ? null : tableSession?.table_id || 1,
        session_token: isDelivery ? null : tableSession?.session_token || null,
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

      addActiveOrderId(createdOrder.id);
      setActiveOrderId(createdOrder.id);

      if (paymentMethod === "aba_pay") {
        setKhqrOrderId(createdOrder.id);
        setIsKhqrOpen(true);
        toast.info(`KHQR Payment Generated for Order #${createdOrder.order_number}`, {
          description: "Please scan the KHQR code with ABA Mobile or any banking app to confirm.",
          duration: 4500,
        });
        return;
      }

      if (isDelivery) {
        toast.success(`🛵 Delivery Order #${createdOrder.order_number} Confirmed!`, {
          description: "Our kitchen has begun preparation. Courier will deliver fresh to your address.",
          duration: 5500,
        });
      } else {
        toast.success(`🍽️ Dine-In Order #${createdOrder.order_number} Confirmed!`, {
          description: `Sent directly to kitchen. Dishes will be served to Table #${createdOrder.table_number || tableSession?.table_number || "1"}.`,
          duration: 5500,
        });
      }
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
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="absolute inset-y-0 right-0 max-w-full flex w-full justify-end">
          <div className="w-full sm:max-w-md bg-card border-l border-border/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between bg-card/90 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-base sm:text-lg text-foreground tracking-tight">Your Order</h2>
                    {isDelivery ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                        🛵 Delivery
                      </span>
                    ) : tableSession ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300">
                        Table #{tableSession.table_number}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        🍽️ Dine-In
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{cart.length} item{cart.length !== 1 ? "s" : ""} selected</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors shrink-0"
                aria-label="Close cart"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dining Mode Banner */}
            {isDelivery ? (
              <div className="mx-3.5 sm:mx-4 mt-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Home className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                      Online Delivery Order
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Dishes will be delivered fresh to your address
                  </span>
                </div>
              </div>
            ) : (
              <div className="mx-3.5 sm:mx-4 mt-3 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-orange-950 dark:text-orange-200">
                      Table #{tableSession?.table_number || "1"}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Food will be served directly to this table
                  </span>
                </div>
              </div>
            )}

            {/* Cart Item List */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
              {cart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground px-4">
                  <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mb-3">
                    <ShoppingBag className="w-8 h-8 opacity-40 text-foreground" />
                  </div>
                  <p className="font-extrabold text-sm text-foreground">Your order is empty</p>
                  <p className="text-xs mt-1 text-muted-foreground max-w-xs">
                    Explore our menu and add your favorite dishes to begin!
                  </p>
                </div>
              ) : (
                <>
                  {cart.map((item) => (
                    <div
                      key={item.cart_id}
                      className="flex gap-3 bg-secondary/30 rounded-2xl p-3 border border-border/80 items-center transition-all hover:border-orange-500/30"
                    >
                      {item.menu_item.image_url ? (
                        <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-900 border border-border/50">
                          <Image
                            src={item.menu_item.image_url}
                            alt={item.menu_item.name}
                            fill
                            className="object-cover"
                            sizes="72px"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground">
                          <Utensils className="w-5 h-5 opacity-40" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {item.menu_item.name}
                          </h4>
                          <span className="text-xs sm:text-sm font-extrabold text-orange-600 dark:text-orange-400 shrink-0">
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
                                  className="text-[10px] px-1.5 py-0.2 rounded-md bg-orange-100/80 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 font-medium truncate max-w-[200px]"
                                >
                                  {text}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between gap-2 mt-2.5">
                          <div className="flex items-center border border-border/80 rounded-xl bg-card shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.cart_id, -1)}
                              className="p-1.5 hover:bg-secondary rounded-l-xl text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2.5 text-xs font-bold min-w-[24px] text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isDelivery && !customer) {
                                  setIsAuthModalOpen(true);
                                  toast.info("Account Required for Delivery", {
                                    description: "Please sign in or create an account to order food delivery.",
                                  });
                                  return;
                                }
                                updateQuantity(item.cart_id, 1);
                              }}
                              className="p-1.5 hover:bg-secondary rounded-r-xl text-muted-foreground hover:text-foreground active:scale-90 transition-all"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cart_id)}
                            className="text-[11px] text-muted-foreground hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Customer Account Banner */}
                  <div className="p-3 rounded-2xl bg-secondary/50 border border-border/80 flex items-center justify-between gap-2">
                    {customer ? (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">
                            {customer.full_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            Saved delivery details loaded
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-600 flex items-center justify-center font-bold text-xs shrink-0">
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
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        {isDelivery ? "Your Full Name *" : "Guest Name (Optional)"}
                      </label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required={isDelivery}
                          placeholder="e.g. Alex Johnson"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          autoComplete="name"
                          className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                        />
                      </div>
                    </div>

                    {/* Online Delivery Fields */}
                    {isDelivery && (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1">
                            Phone Number * (for delivery courier)
                          </label>
                          <div className="relative">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="tel"
                              required
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder="e.g. +1 555-0199"
                              value={customerPhone}
                              onChange={(e) => setCustomerPhone(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
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
                              autoComplete="street-address"
                              placeholder="Building/Apt #, Street, District, Landmark"
                              value={deliveryAddress}
                              onChange={(e) => setDeliveryAddress(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
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
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                      />
                    </div>
                  </div>

                  {/* Tip Selector */}
                  <div className="pt-3 border-t border-border/70">
                    <span className="block text-xs font-semibold text-foreground mb-2">
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
                            className={`py-2 px-1 rounded-xl text-center text-xs font-bold border transition-all ${
                              isSelected
                                ? "bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-600/30 scale-102"
                                : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Method - Only QR Payment (KHQR / ABA Pay) */}
                  <div className="pt-3 border-t border-border/70">
                    <div className="flex items-center justify-between mb-2">
                      <span className="block text-xs font-semibold text-foreground">
                        Payment Method
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400">
                        Official KHQR
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 text-foreground flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#003B64] to-[#0073B7] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span>ABA PayWay</span>
                            <span className="px-1.5 py-0.2 rounded font-extrabold bg-[#0073B7] text-white uppercase text-[9px]">
                              ABA PAY
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Scan or tap to pay directly with ABA Mobile App
                          </p>
                        </div>
                      </div>
                      <div className="w-4 h-4 rounded-full border-2 border-blue-600 flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-blue-600" />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Checkout Footer */}
            {cart.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-border/80 bg-card/95 backdrop-blur-md space-y-3 pb-safe">
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
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-1.5 border-t border-border/80">
                    <span>Total Amount</span>
                    <span className="text-orange-600 dark:text-orange-400">{formatCurrency(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
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
        message="Please sign in or create an account to order food delivery."
      />

      {/* KHQR & ABA Pay Payment Dialog */}
      {khqrOrderId && (
        <KhqrPaymentModal
          orderId={khqrOrderId}
          isOpen={isKhqrOpen}
          onClose={handleKhqrModalClose}
          onPaymentSuccess={handleKhqrPaymentSuccess}
        />
      )}
    </>
  );
}
