"use client";

import { useEffect, useState, useRef } from "react";
import { getAdminOrders, updateOrderStatus, getStaffNotifications, resolveStaffNotification } from "@/lib/api";
import { Order, OrderStatus, StaffNotification } from "@/lib/types";
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
  Phone,
  Layers,
  ArrowRight,
  Filter,
  Check,
  Bike,
  Sparkles,
  Utensils
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboardPage() {
  const [staffCalls, setStaffCalls] = useState<StaffNotification[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchTable, setSearchTable] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "preparing" | "ready" | "served">("all");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 1. Fetch Orders & Staff Calls Initial
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

  const loadStaffCalls = async () => {
    try {
      const notifs = await getStaffNotifications();
      setStaffCalls(notifs.filter((n) => n.status === "unread"));
    } catch {}
  };

  useEffect(() => {
    loadOrders();
    loadStaffCalls();
  }, []);

  const handleResolveCall = async (id: number, tableNum: string) => {
    try {
      await resolveStaffNotification(id);
      setStaffCalls((prev) => prev.filter((n) => n.id !== id));
      toast.success(`Table #${tableNum} call marked as attended.`);
    } catch {
      toast.error("Failed to resolve staff call");
    }
  };

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

          // Handle Staff Call Alert
          if (payload.event === "staff_call" || payload.type === "staff_call") {
            const notif: StaffNotification = payload.data || payload.notification;
            if (notif) {
              setStaffCalls((prev) => [
                notif,
                ...prev.filter((n) => n.id !== notif.id),
              ]);

              // High-urgency audio chime
              try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = "sine";
                osc.frequency.setValueAtTime(880, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.4);
              } catch {}
            }
          } else if (payload.event === "staff_call_resolved" || payload.type === "staff_call_resolved") {
            const resolvedId = payload.notification_id || payload.data?.notification_id;
            if (resolvedId) {
              setStaffCalls((prev) => prev.filter((n) => n.id !== resolvedId));
            }
          } else if (payload.event === "staff_calls_cleared" || payload.type === "staff_calls_cleared") {
            setStaffCalls([]);
          } else if (payload.event === "new_order") {
            const newOrder: Order = payload.data;
            setOrders((prev) => [newOrder, ...prev]);
            const msg =
              newOrder.order_type === "delivery"
                ? `🏠 New Online Delivery Order #${newOrder.order_number} for ${newOrder.customer_name || "Customer"}!`
                : `🍽️ New Order #${newOrder.order_number} received from Table #${newOrder.table_number || "1"}!`;
            toast.success(msg, {
              duration: 5000,
            });
            // Audio chime if permitted
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
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
          } else if (payload.event === "order_payment_received") {
            const updatedOrder: Order = payload.data;
            setOrders((prev) =>
              prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
            );
            if (selectedOrder && selectedOrder.id === updatedOrder.id) {
              setSelectedOrder(updatedOrder);
            }
            toast.success(`💳 Payment Received for Order #${updatedOrder.order_number}!`, {
              description: `${updatedOrder.payment_method.toUpperCase()}: $${Number(updatedOrder.total_amount).toFixed(2)} confirmed.`,
              duration: 5000,
            });
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
      loadStaffCalls();
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
      color: "border-amber-500/40 bg-amber-500/5",
      headerBg: "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300",
      items: pendingOrders,
      nextStatus: "preparing" as OrderStatus,
      nextLabel: "🔥 Start Cooking",
    },
    {
      id: "preparing",
      title: "In Kitchen",
      badge: "Cooking",
      count: preparingOrders.length,
      color: "border-orange-500/40 bg-orange-500/5",
      headerBg: "bg-orange-100 text-orange-900 dark:bg-orange-950/80 dark:text-orange-300",
      items: preparingOrders,
      nextStatus: "ready" as OrderStatus,
      nextLabel: "🔔 Mark Ready",
    },
    {
      id: "ready",
      title: "Ready to Serve",
      badge: "Pass",
      count: readyOrders.length,
      color: "border-emerald-500/40 bg-emerald-500/5",
      headerBg: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300",
      items: readyOrders,
      nextStatus: "served" as OrderStatus,
      nextLabel: "✅ Mark Served",
    },
    {
      id: "served",
      title: "Completed",
      badge: "Finished",
      count: servedOrders.length,
      color: "border-border/70 bg-secondary/30",
      headerBg: "bg-secondary text-foreground",
      items: servedOrders,
      nextStatus: null,
      nextLabel: null,
    },
  ];

  // For responsive single column selection on small screens
  const visibleColumns =
    activeTab === "all"
      ? columns
      : columns.filter((col) => col.id === activeTab);

  return (
    <div className="p-3.5 sm:p-6 space-y-5 sm:space-y-6">
      {/* Real-Time Staff Call Alert Banner */}
      {staffCalls.length > 0 && (
        <div className="rounded-2xl bg-rose-600/10 dark:bg-rose-950/40 border-2 border-rose-500 p-4 sm:p-5 shadow-lg shadow-rose-500/15 animate-in slide-in-from-top-3 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30 animate-pulse">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-rose-700 dark:text-rose-400 tracking-tight">
                    🚨 Staff Call Alert ({staffCalls.length} Active)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                    Urgent
                  </span>
                </div>
                <p className="text-xs text-rose-600/90 dark:text-rose-300/90 font-medium mt-0.5">
                  Customers are calling waitstaff to their tables right now.
                </p>
              </div>
            </div>

            {/* List of calling tables */}
            <div className="flex flex-wrap items-center gap-2">
              {staffCalls.map((call) => (
                <div
                  key={call.id}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-card border-2 border-rose-500/40 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-black text-xs text-foreground">
                    <Utensils className="w-3.5 h-3.5 text-rose-600" />
                    <span>Table #{call.table_number}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatTime(call.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleResolveCall(call.id, call.table_number)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                    title="Mark as attended"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Attended</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            Live Kitchen Order Board
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 font-extrabold">
              {orders.length}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time orders streamed instantly from customer table QR scans and online delivery
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* WebSocket Status Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-foreground border border-border/80 shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span className="text-[11px] font-bold">
              {wsConnected ? "Kitchen Live Feed" : "Reconnecting..."}
            </span>
          </div>

          <button
            onClick={loadOrders}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 transition-all active:scale-95 shadow-2xs"
            title="Refresh order board"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Responsive Segmented Filters */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Table #, Order #, Guest name, or Courier address..."
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-card border border-input focus:outline-none focus:ring-2 focus:ring-orange-500/40 text-foreground transition-all shadow-2xs"
          />
          {searchTable && (
            <button
              onClick={() => setSearchTable("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile & Tablet Column Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              activeTab === "all"
                ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs"
                : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All Columns ({filteredOrders.length})
          </button>
          {columns.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveTab(col.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === col.id
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs"
                  : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{col.badge}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === col.id ? "bg-white/20 text-white dark:bg-black/20 dark:text-black font-bold" : "bg-secondary text-muted-foreground"
                }`}
              >
                {col.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div
        className={`grid gap-4 items-start ${
          activeTab === "all"
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            : "grid-cols-1 max-w-2xl mx-auto"
        }`}
      >
        {visibleColumns.map((col) => (
          <div
            key={col.id}
            className={`rounded-3xl border ${col.color} p-3.5 sm:p-4 flex flex-col xl:max-h-[calc(100vh-200px)] overflow-hidden shadow-2xs`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-foreground">{col.title}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.headerBg}`}>
                  {col.count}
                </span>
              </div>
            </div>

            {/* Column Cards Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
              {col.items.length === 0 ? (
                <div className="h-32 rounded-2xl border border-dashed border-border/80 flex flex-col items-center justify-center text-center text-xs text-muted-foreground bg-card/40 p-4">
                  <span>No orders in this state</span>
                </div>
              ) : (
                col.items.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="modern-card rounded-2xl p-3.5 transition-all cursor-pointer space-y-2.5 active:scale-[0.99] group"
                  >
                    {/* Card Header: Table/Delivery + Time */}
                    <div className="flex items-center justify-between gap-2">
                      {order.order_type === "delivery" ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-800 dark:text-blue-300 font-extrabold text-xs">
                          <Bike className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Delivery</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-orange-500/15 text-orange-800 dark:text-orange-300 font-extrabold text-xs">
                          <Utensils className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                          <span>Table #{order.table_number || "1"}</span>
                        </div>
                      )}
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {formatTime(order.created_at)}
                      </span>
                    </div>

                    {/* Order Number & Price */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-foreground">
                          #{order.order_number}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-orange-600 dark:text-orange-400">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 ${
                          order.payment_status === "paid"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                        }`}>
                          <span>{order.payment_method === "aba_pay" ? "ABA KHQR" : order.payment_method} • {order.payment_status}</span>
                        </span>
                      </div>
                      {order.customer_name && (
                        <p className="text-[11px] text-muted-foreground">
                          Guest: <strong className="text-foreground">{order.customer_name}</strong>
                        </p>
                      )}
                      {order.order_type === "delivery" && order.delivery_address && (
                        <div className="flex items-start gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="truncate">{order.delivery_address}</span>
                        </div>
                      )}
                    </div>

                    {/* Items List Preview */}
                    <div className="border-t border-border/60 pt-2 space-y-1">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between text-xs text-foreground"
                        >
                          <span className="truncate">
                            <strong className="text-orange-600 dark:text-orange-400 font-extrabold">{item.quantity}x</strong>{" "}
                            {item.item_name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Special Requests Alert */}
                    {order.special_requests && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-[11px] font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{order.special_requests}</span>
                      </div>
                    )}

                    {/* Action Button */}
                    {col.nextStatus && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(order.id, col.nextStatus!);
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs shadow-sm shadow-orange-600/20 transition-all active:scale-95"
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

      {/* Detailed Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-3xl border border-border/80 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between bg-card shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                    Order #{selectedOrder.order_number}
                  </h3>
                  {selectedOrder.order_type === "delivery" ? (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <Bike className="w-3 h-3" />
                      Delivery
                    </span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                      Table #{selectedOrder.table_number || "1"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Placed at {formatTime(selectedOrder.created_at)} • {selectedOrder.customer_name || "Guest"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Close details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Items List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Delivery Info */}
              {selectedOrder.order_type === "delivery" && (
                <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Delivery Details
                    </span>
                    {selectedOrder.customer_phone && (
                      <a
                        href={`tel:${selectedOrder.customer_phone}`}
                        className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-bold"
                      >
                        <Phone className="w-3 h-3" />
                        {selectedOrder.customer_phone}
                      </a>
                    )}
                  </div>
                  <div className="text-foreground">
                    Customer: <strong>{selectedOrder.customer_name || "Guest"}</strong>
                  </div>
                  {selectedOrder.delivery_address && (
                    <div className="flex items-start gap-1.5 text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <span>Address: <strong>{selectedOrder.delivery_address}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Order Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Order Line Items
                </h4>
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-secondary/40 border border-border/80 text-xs space-y-1"
                  >
                    <div className="flex justify-between font-bold text-foreground">
                      <span>
                        <span className="text-orange-600 font-extrabold">{item.quantity}x</span> {item.item_name}
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
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200">
                  <strong>Special Requests:</strong> {selectedOrder.special_requests}
                </div>
              )}

              {/* Payment Status & Action */}
              <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                    selectedOrder.payment_status === "paid" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                  }`}>
                    {selectedOrder.payment_status === "paid" ? "✓" : "!"}
                  </div>
                  <div>
                    <p className="font-extrabold text-foreground">
                      {selectedOrder.payment_method === "aba_pay" ? "ABA Pay (KHQR)" : selectedOrder.payment_method.toUpperCase()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Payment: <strong className="capitalize">{selectedOrder.payment_status}</strong>
                    </p>
                  </div>
                </div>
                {selectedOrder.payment_status !== "paid" && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { simulatePaymentApproval } = await import("@/lib/api");
                        await simulatePaymentApproval(selectedOrder.id);
                        toast.success("Order marked as PAID!");
                        setSelectedOrder((prev) => prev ? { ...prev, payment_status: "paid" } : null);
                        setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? { ...o, payment_status: "paid" } : o));
                      } catch (err: any) {
                        toast.error("Failed to update payment status");
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    Mark Paid
                  </button>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/80 space-y-1.5 text-xs">
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
                <div className="flex justify-between text-sm font-black pt-1.5 border-t border-border text-foreground">
                  <span>Total Amount</span>
                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-border/80 bg-card flex flex-wrap gap-2 pb-safe shrink-0">
              {["pending", "preparing", "ready", "served", "cancelled"].map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(selectedOrder.id, st as OrderStatus)}
                  className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    selectedOrder.status === st
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/30"
                      : "bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
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
