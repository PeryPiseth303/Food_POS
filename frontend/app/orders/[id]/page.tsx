"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getOrder } from "@/lib/api";
import { Order } from "@/lib/types";
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
  User
} from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Initial Order Fetch
  const fetchOrderDetails = async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
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
            const statusInfo = getStatusInfo(msg.data.status);
            toast.info(`Order updated: ${statusInfo.label}`);
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
        <RefreshCw className="w-8 h-8 text-orange-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-muted-foreground">Loading your order status...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <p className="text-3xl mb-2">❓</p>
        <h2 className="text-lg font-bold">Order Not Found</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">We couldn’t find an order with this ID.</p>
        <Link
          href="/"
          className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Table
        </Link>
      </div>
    );
  }

  const steps = [
    { id: "pending", label: "Order Received", icon: Clock },
    { id: "preparing", label: "In Kitchen", icon: ChefHat },
    { id: "ready", label: "Ready to Serve", icon: BellRing },
    { id: "served", label: "Served & Enjoy", icon: CheckCircle2 },
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
    <div className="min-h-screen bg-background text-foreground pb-20">
      {/* Top Bar */}
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={order.order_type === "delivery" ? "/menu?mode=delivery" : `/menu?table=${order.table_number || "1"}`}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Order More</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="outline" />
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-muted-foreground">
                {wsConnected ? "Live Status" : "Updating"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">
        {/* Status Hero Card */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm text-center relative overflow-hidden">
          {order.order_type === "delivery" ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold mb-3">
              <Home className="w-3.5 h-3.5 text-blue-600" />
              Online Home Delivery
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-bold mb-3">
              <Utensils className="w-3.5 h-3.5" />
              Table #{order.table_number}
            </div>
          )}

          <h1 className="text-2xl font-black text-foreground">
            {isCancelled
              ? "Order Cancelled"
              : order.status === "served"
              ? "Bon Appétit! 🎉"
              : order.status === "ready"
              ? "Food is Ready! 🔔"
              : order.status === "preparing"
              ? "Kitchen is Cooking 🍳"
              : "Order Received ⏱️"}
          </h1>

          <p className="text-xs text-muted-foreground mt-1">
            Order #{order.order_number} • Placed at {formatTime(order.created_at)}
          </p>

          {/* Prep time estimate */}
          {!isCancelled && order.status !== "served" && (
            <div className="mt-4 p-3 rounded-2xl bg-secondary/50 inline-flex items-center gap-2 text-xs font-medium">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>
                Estimated preparation: <strong>~{order.estimated_prep_minutes} minutes</strong>
              </span>
            </div>
          )}

          {/* Live Progress Stepper */}
          {!isCancelled && (
            <div className="mt-8 pt-6 border-t border-border/70">
              <div className="grid grid-cols-4 gap-2 relative">
                {steps.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div key={step.id} className="flex flex-col items-center text-center">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                            : isCurrent
                            ? "bg-orange-600 text-white shadow-lg shadow-orange-600/30 scale-110 ring-4 ring-orange-500/20 animate-pulse"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={`text-[11px] font-bold mt-2 leading-tight ${
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

        {/* Order Receipt Details */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-600" />
              <h3 className="font-bold text-sm text-foreground">Order Summary</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
              {order.payment_status.toUpperCase()}
            </span>
          </div>

          {/* Online Delivery Destination Info */}
          {order.order_type === "delivery" && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-blue-600" />
                  Delivery Destination
                </span>
                {order.customer_phone && (
                  <a
                    href={`tel:${order.customer_phone}`}
                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    <Phone className="w-3 h-3" />
                    {order.customer_phone}
                  </a>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-foreground/90">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Customer: <strong>{order.customer_name}</strong></span>
              </div>

              {order.delivery_address && (
                <div className="flex items-start gap-1.5 text-foreground/90">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>Deliver to: <strong>{order.delivery_address}</strong></span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-600">{item.quantity}x</span>
                    <span className="font-semibold text-foreground">{item.item_name}</span>
                  </div>
                  {item.customizations && typeof item.customizations === "object" && (
                    <div className="text-[11px] text-muted-foreground pl-5 mt-0.5 space-y-0.5">
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
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 pl-5 mt-0.5">
                      Note: {item.notes}
                    </div>
                  )}
                </div>

                <span className="font-bold text-foreground shrink-0">
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
                <span>Staff Tip</span>
                <span>{formatCurrency(order.tip)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-foreground pt-2 border-t border-border">
              <span>Total Paid</span>
              <span className="text-orange-600 dark:text-orange-400">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Assistance Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() =>
              toast.success(
                order.order_type === "delivery"
                  ? "Support team has been notified. We will call you shortly!"
                  : `A staff member has been notified and is coming to Table #${order.table_number || "1"}`
              )
            }
            className="py-3 px-4 rounded-2xl bg-secondary/80 hover:bg-secondary text-foreground text-xs font-bold flex items-center justify-center gap-2 border border-border transition-colors"
          >
            <PhoneCall className="w-4 h-4 text-orange-600" />
            <span>{order.order_type === "delivery" ? "Help & Support" : "Call Staff"}</span>
          </button>

          <Link
            href={order.order_type === "delivery" ? "/menu?mode=delivery" : `/menu?table=${order.table_number || "1"}`}
            className="py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-600/20 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Order More</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
