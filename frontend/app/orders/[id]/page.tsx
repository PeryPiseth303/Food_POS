"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOrder, callStaff, getTableActiveOrders } from "@/lib/api";
import { Order } from "@/lib/types";
import { useCart } from "@/lib/store";
import { formatCurrency, formatTime, getStatusInfo } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  BellRing,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Receipt,
  Utensils,
  Home,
  MapPin,
  Phone,
  PhoneCall,
  User,
  QrCode,
  Check,
  ShieldCheck,
  Bike
} from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { KhqrPaymentModal } from "@/components/cart/KhqrPaymentModal";

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const { setActiveOrderId, addActiveOrderId, activeOrderIds } = useCart();
  const { setScope } = useTheme();

  const [order, setOrder] = useState<Order | null>(null);
  const [relatedOrders, setRelatedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [isCallingStaff, setIsCallingStaff] = useState(false);
  const [isKhqrModalOpen, setIsKhqrModalOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const handleCallStaff = async () => {
    const tbl = String(order?.table_number || "1");
    setIsCallingStaff(true);
    try {
      await callStaff(tbl);
      toast(
        <div className="flex items-center gap-3 text-white font-sans">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 text-white animate-bounce" />
          </div>
          <div>
            <p className="font-extrabold text-sm text-white">Staff Called to Table #{tbl}!</p>
            <p className="text-xs text-white/90">A waiter has been alerted and is coming to assist your table.</p>
          </div>
        </div>,
        {
          duration: 6000,
          style: {
            backgroundColor: "#dc2626",
            color: "#ffffff",
            borderColor: "#b91c1c",
            boxShadow: "0 10px 25px -5px rgba(220, 38, 38, 0.5)",
          },
          className: "!bg-red-600 !text-white !border-red-700 shadow-xl",
        }
      );
    } catch (err: any) {
      toast.error("Failed to notify staff. Please alert a staff member directly.", {
        style: {
          backgroundColor: "#dc2626",
          color: "#ffffff",
          borderColor: "#b91c1c",
        },
      });
    } finally {
      setIsCallingStaff(false);
    }
  };

  // 1. Initial Order Fetch
  const fetchOrderDetails = async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
      setActiveOrderId(data.id);
      addActiveOrderId(data.id);
    } catch (err) {
      toast.error("Failed to load order details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  useEffect(() => {
    if (order?.order_type === "dine_in") {
      setScope("dine_in");
    } else if (order?.order_type === "delivery") {
      setScope("delivery");
    }
  }, [order?.order_type, setScope]);

  // Load all active / related orders for this table or customer session
  useEffect(() => {
    let isMounted = true;
    const loadRelated = async () => {
      try {
        const orderList: Order[] = [];
        const seen = new Set<number>();

        // 1. Fetch table active orders if dine-in
        const tblNum = order?.table_number;
        if (tblNum && tblNum !== "Delivery") {
          try {
            const tblOrders = await getTableActiveOrders(tblNum);
            for (const o of tblOrders) {
              if (!seen.has(o.id)) {
                seen.add(o.id);
                orderList.push(o);
              }
            }
          } catch (e) {}
        }

        // 2. Fetch from activeOrderIds
        const uniqueIds = Array.from(new Set([orderId, ...activeOrderIds])).filter((id) => !seen.has(id));
        if (uniqueIds.length > 0) {
          const results = await Promise.all(uniqueIds.map((id) => getOrder(id).catch(() => null)));
          for (const o of results) {
            if (o && !seen.has(o.id)) {
              seen.add(o.id);
              orderList.push(o);
            }
          }
        }

        if (isMounted) {
          const valid = orderList.filter((o) => o.status !== "cancelled");
          valid.sort((a, b) => a.id - b.id);
          setRelatedOrders(valid);
        }
      } catch (e) {}
    };

    loadRelated();
  }, [orderId, order?.table_number, activeOrderIds]);

  // 2. Real-Time WebSocket for Live Order Tracking
  useEffect(() => {
    if (!orderId) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiBase.replace(/^http/, "ws") + `/api/v1/ws/orders/${orderId}`;

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === "status_changed" || msg.event === "order_status_updated") {
            setOrder(msg.data);
            setActiveOrderId(msg.data.id);
            const statusInfo = getStatusInfo(msg.data.status);
            toast.info(`Order status: ${statusInfo.label}`);
          } else if (msg.event === "payment_confirmed") {
            setOrder(msg.data);
            setActiveOrderId(msg.data.id);
            toast.success("🎉 Payment confirmed via ABA / KHQR!", {
              description: "Thank you! Our kitchen is preparing your order now.",
            });
          }
        } catch (e) {
          console.error("WS message parse error", e);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn("WebSocket connection failed, falling back to polling", err);
    }

    // Polling fallback every 8 seconds
    const interval = setInterval(() => {
      fetchOrderDetails();
    }, 8000);

    return () => {
      clearInterval(interval);
      if (socket) socket.close();
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <RefreshCw className="w-9 h-9 text-orange-600 animate-spin mb-3" />
        <p className="text-sm font-bold text-foreground">Retrieving live order status...</p>
        <p className="text-xs text-muted-foreground mt-1">Connecting to kitchen feed</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mb-3">
          <Utensils className="w-8 h-8 opacity-40 text-foreground" />
        </div>
        <h2 className="text-xl font-extrabold text-foreground tracking-tight">Order Not Found</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-5 max-w-xs">
          We couldn’t find an order with this reference number.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-orange-600/25 transition-all"
        >
          Return to Menu
        </Link>
      </div>
    );
  }

  const steps = [
    { id: "pending", label: "Received", icon: Clock },
    { id: "preparing", label: "In Kitchen", icon: ChefHat },
    { id: "ready", label: "Ready", icon: BellRing },
    { id: "served", label: order.order_type === "delivery" ? "Delivered" : "Served", icon: CheckCircle2 },
  ];

  const currentStepIdx =
    order.status === "pending" || order.status === "confirmed"
      ? 0
      : order.status === "preparing"
      ? 1
      : order.status === "ready"
      ? 2
      : order.status === "served"
      ? 3
      : 0;

  const isCancelled = order.status === "cancelled";

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Top Sticky Bar */}
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={order.order_type === "delivery" ? "/menu?mode=delivery" : `/menu?table=${order.table_number || "1"}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-xs font-bold text-foreground border border-border/70 transition-all active:scale-95 shadow-2xs"
            title="Go back to Home & Menu"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home / Menu</span>
          </Link>

          <div className="flex items-center gap-2">
            {order.order_type !== "delivery" && (
              <button
                type="button"
                onClick={handleCallStaff}
                disabled={isCallingStaff}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-black shadow-sm shadow-rose-600/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Call waiter to Table"
              >
                <BellRing className={`w-3.5 h-3.5 ${isCallingStaff ? "animate-spin" : "animate-bounce"}`} />
                <span>Call Staff</span>
              </button>
            )}
            <ThemeToggle variant="outline" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/80 border border-border/70 text-xs">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-[11px] font-bold text-foreground">
                {wsConnected ? "Live Feed" : "Syncing"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3.5 sm:px-6 pt-5 sm:pt-7 space-y-5">
        {/* Multi-Order Switcher Bar (when customer has multiple active orders) */}
        {relatedOrders.length > 1 && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-secondary/80 border border-border/80 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-foreground flex items-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5 text-orange-600" />
                <span>Your Active Orders ({relatedOrders.length})</span>
              </span>
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                {relatedOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0)} total dishes ordered
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {relatedOrders.map((ord, idx) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => router.push(`/orders/${ord.id}`)}
                  className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                    ord.id === orderId
                      ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/25 scale-[1.02]"
                      : "bg-background hover:bg-background/80 text-foreground border border-border/70 hover:border-orange-500/40"
                  }`}
                >
                  <span>Order #{ord.order_number}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    ord.id === orderId
                      ? "bg-white/25 text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {getStatusInfo(ord.status).label}
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">
                    ({ord.items.reduce((s, it) => s + it.quantity, 0)} items)
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ABA Pay / KHQR Payment Action Banner */}
        {order.payment_method === "aba_pay" && (
          order.payment_status === "pending" ? (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-red-600/10 via-rose-500/10 to-amber-500/10 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md shadow-red-500/5 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex flex-col items-center justify-center font-black shadow-md shadow-red-500/20 shrink-0">
                  <span className="text-[10px] leading-none">KH</span>
                  <span className="text-[11px] leading-none">QR</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-foreground">ABA Pay / KHQR Pending</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold animate-pulse">
                      Awaiting Scan
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Amount: <strong className="text-foreground">${order.total_amount.toFixed(2)}</strong> (≈ ៛{Math.round(order.total_amount * 4100).toLocaleString()})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKhqrModalOpen(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-black shadow-md shadow-red-600/25 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan & Pay Now</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-200 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Paid with ABA Pay / KHQR</span>
              </div>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                ${order.total_amount.toFixed(2)}
              </span>
            </div>
          )
        )}

        {/* Status Hero Card */}
        <div className="modern-card rounded-3xl p-5 sm:p-7 text-center relative overflow-hidden">
          {/* Subtle top glow accent */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500" />

          {order.order_type === "delivery" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-xs font-extrabold mb-3">
              <Bike className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Online Home Delivery
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 text-orange-700 dark:text-orange-300 text-xs font-extrabold mb-3 select-none">
              <Utensils className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>Table #{order.table_number || "1"}</span>
            </div>
          )}

          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {isCancelled
              ? "Order Cancelled"
              : order.status === "served"
              ? (order.order_type === "delivery" ? "Order Delivered! 🛵🎉" : "Bon Appétit! 🎉")
              : order.status === "ready"
              ? (order.order_type === "delivery" ? "Dispatched & On The Way! 🚀" : "Food is Ready to Serve! 🔔")
              : order.status === "preparing"
              ? "Kitchen is Cooking 🍳"
              : "Order Received & Confirmed ⏱️"}
          </h1>

          <p className="text-xs text-muted-foreground mt-1">
            Order <span className="font-mono font-bold text-foreground">#{order.order_number}</span> • Placed at {formatTime(order.created_at)}
          </p>

          {/* Prep time estimate */}
          {!isCancelled && order.status !== "served" && (
            <div className="mt-4 p-2.5 sm:p-3 rounded-2xl bg-secondary/60 border border-border/70 inline-flex items-center gap-2 text-xs font-semibold">
              <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
              <span>
                Estimated preparation: <strong className="text-foreground">~{order.estimated_prep_minutes} minutes</strong>
              </span>
            </div>
          )}

          {/* Live Progress Stepper */}
          {!isCancelled && (
            <div className="mt-7 pt-6 border-t border-border/70">
              <div className="grid grid-cols-4 gap-1.5 sm:gap-3 relative">
                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div key={step.id} className="flex flex-col items-center text-center">
                      <div
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                            : isCurrent
                            ? "bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/30 ring-4 ring-orange-500/20 animate-pulse scale-105"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                        ) : (
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs font-extrabold mt-2 leading-tight ${
                          isCurrent
                            ? "text-orange-600 dark:text-orange-400"
                            : isDone
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Order Details & Summary Card */}
        <div className="modern-card rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-600" />
              <h3 className="font-extrabold text-sm text-foreground">Order Summary</h3>
            </div>
            <span className={`text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full font-extrabold border uppercase tracking-wider ${
              order.payment_status === "paid"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                : order.payment_status === "failed"
                ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25"
            }`}>
              {order.payment_status === "paid" ? "Paid" : "Payment Pending"}
            </span>
          </div>

          {/* Online Delivery Destination Info */}
          {order.order_type === "delivery" && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-blue-950 dark:text-blue-200">
                <span className="flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-blue-600" />
                  Delivery Destination
                </span>
                {order.customer_phone && (
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    <Phone className="w-3 h-3" />
                    {order.customer_phone}
                  </a>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Recipient: <strong>{order.customer_name}</strong></span>
              </div>

              {order.delivery_address && (
                <div className="flex items-start gap-1.5 text-foreground">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>Address: <strong>{order.delivery_address}</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Dine-In Table Info */}
          {order.order_type !== "delivery" && (
            <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-orange-950 dark:text-orange-200">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-orange-600" />
                  Dine-In Table: Table #{order.table_number || "1"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-800 dark:text-orange-300 font-bold">
                  Dine-In
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Dishes in this order will be served directly to Table #{order.table_number || "1"}.
              </p>
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-3 pt-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 text-xs sm:text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-orange-600 dark:text-orange-400 shrink-0">
                      {item.quantity}x
                    </span>
                    <span className="font-bold text-foreground truncate">{item.item_name}</span>
                  </div>
                  {item.customizations && typeof item.customizations === "object" && (
                    <div className="text-[11px] text-muted-foreground pl-6 mt-0.5 space-y-0.5">
                      {Object.entries(item.customizations).map(([k, v]) => {
                        if (!v) return null;
                        const text = Array.isArray(v)
                          ? v.map((x: any) => (typeof x === "object" ? x.name : x)).join(", ")
                          : String(v);
                        return <div key={k}>• {text}</div>;
                      })}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 pl-6 mt-0.5">
                      Note: {item.notes}
                    </div>
                  )}
                </div>

                <span className="font-extrabold text-foreground shrink-0">
                  {formatCurrency(item.item_total)}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing breakdown */}
          <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatCurrency(order.tax)}</span>
            </div>
            {order.tip > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Staff & Kitchen Tip</span>
                <span>{formatCurrency(order.tip)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm sm:text-base font-black text-foreground pt-2 border-t border-border/80">
              <span>Total Paid</span>
              <span className="text-orange-600 dark:text-orange-400 tracking-tight">
                {formatCurrency(order.total_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Assistance Buttons */}
        <div className="pt-1">
          {order.order_type === "delivery" ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  toast.success("Support team has been notified. We will contact you shortly!")
                }
                className="py-3 px-4 rounded-2xl bg-secondary hover:bg-secondary/80 text-foreground text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border border-border/80 transition-all active:scale-[0.98]"
              >
                <PhoneCall className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Customer Support</span>
              </button>

              <Link
                href="/menu?mode=delivery"
                className="py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Order More</span>
              </Link>
            </div>
          ) : (
            <Link
              href={`/menu?table=${order.table_number || "1"}`}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Order More Food & Drinks</span>
            </Link>
          )}
        </div>
      </main>

      {/* KHQR & ABA Pay Payment Modal */}
      {order && (
        <KhqrPaymentModal
          orderId={order.id}
          isOpen={isKhqrModalOpen}
          onClose={() => setIsKhqrModalOpen(false)}
          onPaymentSuccess={() => {
            setIsKhqrModalOpen(false);
            setOrder((prev) => (prev ? { ...prev, payment_status: "paid", status: "confirmed" } : null));
          }}
        />
      )}
    </div>
  );
}
