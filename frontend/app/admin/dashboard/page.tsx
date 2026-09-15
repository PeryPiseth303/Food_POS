"use client";

import { useEffect, useState, useRef } from "react";
import { getAdminOrders, updateOrderStatus } from "@/lib/api";
import { Order, OrderStatus } from "@/lib/types";
import { formatCurrency, formatTime, getStatusInfo } from "@/lib/utils";
import {
  Clock,
  ChefHat,
  BellRing,
  CheckCircle2,
  RefreshCw,
  Search,
  Receipt,
  X,
  AlertCircle,
  Radio,
  Volume2,
  Home,
  MapPin,
  Phone
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTable, setSearchTable] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Fetch Orders Initial
  const loadOrders = async () => {
    try {
      const data = await getAdminOrders();
      setOrders(data);
    } catch (err) {
      toast.error("Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // 2. Setup Real-time WebSocket connection to /ws/admin
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiBase.replace(/^http/, "ws") + "/api/v1/ws/admin";

    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "new_order") {
            const newOrder: Order = payload.data;
            setOrders((prev) => [newOrder, ...prev]);
            const msg =
              newOrder.order_type === "delivery"
                ? `🏠 New Online Delivery Order #${newOrder.order_number} for ${newOrder.customer_name || "Customer"}!`
                : `🍽️ New Order #${newOrder.order_number} received from Table #${newOrder.table_number || "1"}!`;
            toast.success(msg, {
              duration: 5000,
            });
            // Try playing a gentle browser audio chime if user interacted
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.3);
            } catch {}
          } else if (payload.event === "order_status_updated") {
            const updatedOrder: Order = payload.data;
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            if (selectedOrder && selectedOrder.id === updatedOrder.id) {
              setSelectedOrder(updatedOrder);
            }
          }
        } catch (e) {
          console.error("WS event parse error", e);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
      };
    } catch (e) {
      console.warn("Could not connect to Admin WebSocket", e);
    }

    // Polling fallback
    const interval = setInterval(() => {
      loadOrders();
    }, 10000);

    return () => {
      clearInterval(interval);
      if (socket) socket.close();
    };
  }, [selectedOrder]);

  // 3. Status update handler
  const handleStatusChange = async (orderId: number, nextStatus: OrderStatus) => {
    try {
      const updated = await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
      toast.success(`Order #${updated.order_number} moved to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    }
  };

  // Filter orders by search input (table number, customer name, delivery address, or phone)
  const filteredOrders = orders.filter((o) => {
    if (!searchTable) return true;
    const q = searchTable.toLowerCase();
    return (
      (o.table_number && o.table_number.toLowerCase().includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.delivery_address && o.delivery_address.toLowerCase().includes(q)) ||
      (o.customer_phone && o.customer_phone.includes(q)) ||
      (o.order_number && o.order_number.toLowerCase().includes(q))
    );
  });

  const pendingOrders = filteredOrders.filter(
    (o) => o.status === "pending" || o.status === "confirmed"
  );
  const preparingOrders = filteredOrders.filter((o) => o.status === "preparing");
  const readyOrders = filteredOrders.filter((o) => o.status === "ready");
  const servedOrders = filteredOrders.filter(
    (o) => o.status === "served" || o.status === "cancelled"
  );

  const columns = [
    {
      id: "pending",
      title: "New Orders",
      badge: "Pending",
      count: pendingOrders.length,
      color: "border-amber-500/50 bg-amber-500/5",
      headerBg: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
      items: pendingOrders,
      nextStatus: "preparing" as OrderStatus,
      nextLabel: "🔥 Start Cooking",
    },
    {
      id: "preparing",
      title: "In Kitchen",
      badge: "Cooking",
      count: preparingOrders.length,
      color: "border-orange-500/50 bg-orange-500/5",
      headerBg: "bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300",
      items: preparingOrders,
      nextStatus: "ready" as OrderStatus,
      nextLabel: "🔔 Mark Ready",
    },
    {
      id: "ready",
      title: "Ready to Serve",
      badge: "Pass",
      count: readyOrders.length,
      color: "border-emerald-500/50 bg-emerald-500/5",
      headerBg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
      items: readyOrders,
      nextStatus: "served" as OrderStatus,
      nextLabel: "✅ Mark Served",
    },
    {
      id: "served",
      title: "Completed",
      badge: "Finished",
      count: servedOrders.length,
      color: "border-slate-500/30 bg-secondary/30",
      headerBg: "bg-secondary text-foreground",
      items: servedOrders,
      nextStatus: null,
      nextLabel: null,
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Live Kitchen Order Board
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 font-bold">
              {orders.length} Total
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time orders streamed directly from customer table QR scans
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* WebSocket Status Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-muted-foreground border border-border">
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>{wsConnected ? "Live Feed Active" : "Connecting..."}</span>
          </div>

          <button
            onClick={loadOrders}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors"
            title="Refresh orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Table #, Order #, or Guest..."
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-card border border-input focus:ring-2 focus:ring-orange-500/50 text-foreground"
          />
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => (
          <div
            key={col.id}
            className={`rounded-2xl border ${col.color} p-3 flex flex-col max-h-[calc(100vh-210px)] overflow-hidden`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">{col.title}</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${col.headerBg}`}>
                  {col.count}
                </span>
              </div>
            </div>

            {/* Column Cards Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {col.items.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center text-xs text-muted-foreground">
                  <span>No orders in this state</span>
                </div>
              ) : (
                col.items.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="bg-card border border-border/80 hover:border-orange-500/50 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
                  >
                    {/* Card Header: Table/Delivery + Time */}
                    <div className="flex items-center justify-between">
                      {order.order_type === "delivery" ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 font-extrabold text-xs">
                          <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Delivery</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-200 font-extrabold text-xs">
                          <span>Table #{order.table_number || "1"}</span>
                        </div>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatTime(order.created_at)}
                      </span>
                    </div>

                    {/* Order Number & Customer Name */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          {order.order_number}
                        </span>
                        <span className="text-xs font-black text-foreground">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>
                      {order.customer_name && (
                        <p className="text-[11px] text-muted-foreground">
                          Guest: <strong>{order.customer_name}</strong>
                        </p>
                      )}
                      {order.order_type === "delivery" && order.delivery_address && (
                        <div className="flex items-start gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="truncate">{order.delivery_address}</span>
                        </div>
                      )}
                      {order.order_type === "delivery" && order.customer_phone && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Phone className="w-2.5 h-2.5 shrink-0" />
                          <span>{order.customer_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Items Preview */}
                    <div className="border-t border-border/60 pt-2 space-y-1">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between text-xs text-foreground"
                        >
                          <span className="truncate">
                            <strong className="text-orange-600">{item.quantity}x</strong>{" "}
                            {item.item_name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Special Requests Alert */}
                    {order.special_requests && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[11px] font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{order.special_requests}</span>
                      </div>
                    )}

                    {/* Action Button */}
                    {col.nextStatus && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(order.id, col.nextStatus!);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-transform active:scale-95"
                      >
                        {col.nextLabel}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Order Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    Order #{selectedOrder.order_number}
                  </h3>
                  {selectedOrder.order_type === "delivery" ? (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <Home className="w-3 h-3" />
                      Online Delivery
                    </span>
                  ) : (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                      Table #{selectedOrder.table_number || "1"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Placed at {formatTime(selectedOrder.created_at)} • {selectedOrder.customer_name || "Guest"}
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Items List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Delivery Contact & Address if delivery order */}
              {selectedOrder.order_type === "delivery" && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Home Delivery Info
                    </span>
                    {selectedOrder.customer_phone && (
                      <a
                        href={`tel:${selectedOrder.customer_phone}`}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        <Phone className="w-3 h-3" />
                        {selectedOrder.customer_phone}
                      </a>
                    )}
                  </div>
                  <div className="text-foreground">
                    Recipient: <strong>{selectedOrder.customer_name || "Guest"}</strong>
                  </div>
                  {selectedOrder.delivery_address && (
                    <div className="flex items-start gap-1.5 text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>Address: <strong>{selectedOrder.delivery_address}</strong></span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Order Line Items
                </h4>
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-secondary/40 border border-border/80 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-bold">
                      <span>
                        <span className="text-orange-600">{item.quantity}x</span> {item.item_name}
                      </span>
                      <span>{formatCurrency(item.item_total)}</span>
                    </div>

                    {item.customizations && typeof item.customizations === "object" && (
                      <div className="text-muted-foreground text-[11px] pl-4 space-y-0.5">
                        {Object.entries(item.customizations).map(([k, v]) => {
                          if (!v) return null;
                          const txt = Array.isArray(v)
                            ? v.map((x: any) => (typeof x === "object" ? x.name : x)).join(", ")
                            : String(v);
                          return <div key={k}>• {txt}</div>;
                        })}
                      </div>
                    )}

                    {item.notes && (
                      <div className="text-amber-600 dark:text-amber-400 font-medium pl-4 text-[11px]">
                        Note: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedOrder.special_requests && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Special Requests:</strong> {selectedOrder.special_requests}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="p-4 rounded-xl bg-secondary/30 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatCurrency(selectedOrder.tax)}</span>
                </div>
                {selectedOrder.tip > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tip</span>
                    <span>{formatCurrency(selectedOrder.tip)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black pt-1.5 border-t border-border">
                  <span>Total Amount</span>
                  <span className="text-orange-600">{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-border bg-card flex flex-wrap gap-2">
              {["pending", "preparing", "ready", "served", "cancelled"].map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(selectedOrder.id, st as OrderStatus)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all ${
                    selectedOrder.status === st
                      ? "bg-orange-600 text-white shadow-md"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
