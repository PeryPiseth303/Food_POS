"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { getPublicMenu, validateTable, callStaff, getOrder, getTableActiveOrders } from "@/lib/api";
import { useCart } from "@/lib/store";
import { FullMenuResponse, MenuItem, Category, TableSession, Order } from "@/lib/types";
import { formatCurrency, getStatusInfo } from "@/lib/utils";
import CustomizationModal from "@/components/menu/CustomizationModal";
import CartDrawer from "@/components/cart/CartDrawer";
import {
  Utensils,
  Search,
  Flame,
  Sparkles,
  ShoppingBag,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Plus,
  Loader2,
  Home,
  User,
  LogIn,
  Bike,
  Camera,
  QrCode,
  X,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  BellRing,
  ChefHat,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import CustomerAuthModal from "@/components/auth/CustomerAuthModal";

function MenuContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modeParam = searchParams.get("mode");
  const tableParam = searchParams.get("table");
  const tokenParam = searchParams.get("token") || "";

  const {
    tableSession,
    setTableSession,
    orderType,
    setOrderType,
    customer,
    deliveryAddress,
    addToCart,
    itemCount,
    total,
    activeOrderId,
    setActiveOrderId,
    activeOrderIds,
    addActiveOrderId,
    removeActiveOrderId,
  } = useCart();

  const { setScope } = useTheme();

  const [menuData, setMenuData] = useState<FullMenuResponse | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState("all");
  const [selectedItemForModal, setSelectedItemForModal] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState("");
  const [pendingItemToAdd, setPendingItemToAdd] = useState<MenuItem | null>(null);
  const [isCallingStaff, setIsCallingStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tableValidationStatus, setTableValidationStatus] = useState<"valid" | "error">("valid");
  const [tableErrorMessage, setTableErrorMessage] = useState("");
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);

  // Poll all active orders for this table or customer to keep food process status live
  useEffect(() => {
    let isMounted = true;
    const fetchAllActiveOrders = async () => {
      try {
        const orderList: Order[] = [];
        const seenIds = new Set<number>();

        // 1. If dine-in, fetch all active orders for this table from backend
        const currentTable = tableParam || (tableSession ? tableSession.table_number : null);
        if (currentTable && orderType !== "delivery") {
          try {
            const tableActive = await getTableActiveOrders(currentTable);
            for (const ord of tableActive) {
              if (!seenIds.has(ord.id)) {
                seenIds.add(ord.id);
                orderList.push(ord);
              }
            }
          } catch (e) {}
        }

        // 2. Also fetch any orders stored in activeOrderIds (localStorage)
        const idsToFetch = activeOrderIds.filter((id) => !seenIds.has(id));
        if (idsToFetch.length > 0) {
          const results = await Promise.all(
            idsToFetch.map((id) => getOrder(id).catch(() => null))
          );
          for (const ord of results) {
            if (ord && !seenIds.has(ord.id)) {
              seenIds.add(ord.id);
              orderList.push(ord);
            }
          }
        }

        if (isMounted) {
          const nonCancelled = orderList.filter((o) => o.status !== "cancelled");
          // Sort by creation time desc (newest first)
          nonCancelled.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setActiveOrders(nonCancelled);
        }
      } catch (e) {
        console.warn("Could not fetch active orders", e);
      }
    };

    fetchAllActiveOrders();
    const interval = setInterval(fetchAllActiveOrders, 7000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeOrderIds, tableParam, tableSession, orderType]);

  const handleCallStaff = async () => {
    const tableNum = tableSession?.table_number || tableParam || "1";
    setIsCallingStaff(true);
    try {
      await callStaff(tableNum);
      // Red toast requirement: "when click call the staff have toast red"
      toast(
        <div className="flex items-center gap-3 text-white font-sans">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4 text-white animate-bounce" />
          </div>
          <div>
            <p className="font-extrabold text-sm text-white">Staff Called to Table #{tableNum}!</p>
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

  // Route logic:
  // 1. If customer scanned table QR stand (e.g. table 1): activate Dine-In for that table
  // 2. If customer did not scan a QR code: automatically default to Online Delivery
  useEffect(() => {
    if (tableParam) {
      setOrderType("dine_in");
      setScope("dine_in");
    } else {
      setOrderType("delivery");
      setScope("delivery");
    }
  }, [tableParam, modeParam, setOrderType, setScope]);



  // 1. Validate Table QR on load only when dining in
  useEffect(() => {
    let isMounted = true;
    if (orderType === "delivery" || modeParam === "delivery") {
      setTableValidationStatus("valid");
      return;
    }

    const currentTable = tableParam || (tableSession ? tableSession.table_number : "1");

    if (tableSession && tableSession.table_number === currentTable && tableSession.is_valid) {
      setTableValidationStatus("valid");
      return;
    }

    async function initTable() {
      try {
        const session = await validateTable(currentTable, tokenParam || undefined);
        if (isMounted) {
          setTableSession(session);
          setTableValidationStatus("valid");
          if (tableParam) {
            toast.success(`🍽️ Welcome to Table #${currentTable}!`, {
              description: `Dishes ordered will be served directly to Table #${currentTable}.`,
              duration: 4000,
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setTableValidationStatus("error");
          setTableErrorMessage(err.message || "Failed to validate table QR code.");
        }
      }
    }

    initTable();

    return () => {
      isMounted = false;
    };
  }, [tableParam, tokenParam, orderType, modeParam]);

  // 2. Fetch Menu Data
  useEffect(() => {
    async function loadMenu() {
      try {
        setIsLoading(true);
        const data = await getPublicMenu();
        setMenuData(data);
        if (data.categories.length > 0) {
          setActiveCategory(data.categories[0].id);
        }
      } catch (err) {
        toast.error("Failed to load restaurant menu. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    }
    loadMenu();
  }, []);

  // Filter items based on search and dietary tags
  const filteredCategories = useMemo(() => {
    if (!menuData) return [];
    return menuData.categories
      .map((cat) => {
        const filteredItems = cat.items.filter((item) => {
          const matchesSearch =
            !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase());

          let matchesDiet = true;
          if (dietaryFilter === "popular") {
            matchesDiet = item.is_popular;
          } else if (dietaryFilter === "vegetarian") {
            matchesDiet = item.dietary_tags?.includes("vegetarian") || item.dietary_tags?.includes("vegan") || false;
          } else if (dietaryFilter === "spicy") {
            matchesDiet = item.dietary_tags?.includes("spicy") || false;
          }

          return matchesSearch && matchesDiet;
        });

        return { ...cat, items: filteredItems };
      })
      .filter((cat) => cat.items.length > 0);
  }, [menuData, searchQuery, dietaryFilter]);

  const handleItemClick = (item: MenuItem) => {
    // Delivery mode: customers must sign in or register before adding food
    if (orderType === "delivery" && !customer) {
      setPendingItemToAdd(item);
      setAuthModalMessage(`Please sign in or create an account to order "${item.name}" for food delivery.`);
      setIsAuthModalOpen(true);
      toast.info("Account Required for Delivery", {
        description: `Please sign in or create an account to add "${item.name}" to your delivery order.`,
      });
      return;
    }

    if (item.customizations && item.customizations.length > 0) {
      setSelectedItemForModal(item);
    } else {
      addToCart(item, 1);
      toast.success(`Added 1x ${item.name}`, {
        duration: 2500,
      });
    }
  };

  const handleScrollToCategory = (catId: number) => {
    setActiveCategory(catId);
    const element = document.getElementById(`category-${catId}`);
    if (element) {
      const yOffset = -140; // account for sticky header height
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      {/* Top Sticky Bar: Restaurant & Table Badge */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/80 shadow-xs transition-colors">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
          {/* Main Top Row */}
          <div className="flex items-center justify-between gap-2.5">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <Utensils className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight text-foreground truncate">
                  {menuData?.restaurant_name || "Bistro Moderne"}
                </h1>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                  <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                  <span className="truncate">
                    {orderType === "delivery" ? "Online Doorstep Delivery" : "Dine-In Restaurant"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons: ThemeToggle, Account, Mode Badge, Track Food */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ThemeToggle variant="outline" className="inline-flex shrink-0" />

              {/* Customer Account Button */}
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border border-border/80 shadow-2xs transition-all active:scale-95"
                title={customer ? `Signed in as ${customer.full_name}` : "Sign in / Register"}
              >
                <div className="w-5 h-5 rounded-lg bg-orange-600/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <User className="w-3 h-3" />
                </div>
                <span className="hidden sm:inline font-bold">
                  {customer ? customer.full_name.split(" ")[0] : "Account"}
                </span>
              </button>

              {/* Dining Status Pill: Simple static badge */}
              {orderType === "delivery" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-2xs select-none">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <Bike className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="hidden xs:inline">Online Delivery</span>
                  <span className="xs:hidden">Delivery</span>
                </div>
              ) : tableValidationStatus === "error" ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold select-none">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Table Error</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-700 dark:text-orange-300 text-xs font-bold shadow-2xs select-none">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    <Utensils className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span>Table #{tableSession?.table_number || tableParam || "1"}</span>
                  </div>

                  {/* Call Staff Button */}
                  <button
                    type="button"
                    onClick={handleCallStaff}
                    disabled={isCallingStaff}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-extrabold shadow-sm shadow-rose-600/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                    title="Call waiter to your table"
                  >
                    <BellRing className={`w-3.5 h-3.5 ${isCallingStaff ? "animate-spin" : "animate-bounce"}`} />
                    <span className="hidden xs:inline">Call Staff</span>
                    <span className="xs:hidden">Staff</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search & Dietary Filters */}
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search delicious dishes, ingredients, drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl bg-secondary/50 hover:bg-secondary/70 focus:bg-background border border-border/80 focus:border-orange-500/80 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Dietary Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs font-medium">
              {[
                { id: "all", label: "All Items" },
                { id: "popular", label: "⭐ Popular", icon: Sparkles },
                { id: "vegetarian", label: "🥦 Vegetarian" },
                { id: "spicy", label: "🔥 Spicy", icon: Flame },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setDietaryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all flex items-center gap-1 ${
                    dietaryFilter === f.id
                      ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-bold shadow-xs scale-102"
                      : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {/* Category Sticky Nav Tabs */}
            {menuData && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1.5 border-t border-border/60">
                {menuData.categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleScrollToCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      activeCategory === cat.id
                        ? "bg-orange-600 text-white shadow-sm shadow-orange-600/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        activeCategory === cat.id
                          ? "bg-white/20 text-white font-bold"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {cat.items.length}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 pt-5 sm:pt-7 space-y-9">
        {/* Active Orders Food Process Banner */}
        {activeOrders.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/10 border border-orange-500/30 space-y-3.5 shadow-xs animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/25">
                  <ChefHat className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-foreground">
                      Food In Progress ({activeOrders.reduce((sum, o) => sum + o.items.reduce((s, it) => s + it.quantity, 0), 0)} items across {activeOrders.length} {activeOrders.length === 1 ? "order" : "rounds"})
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {orderType === "delivery" ? "• Online Delivery" : `• Table #${tableParam || tableSession?.table_number || "1"}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your dishes are actively being prepared and cooked by our kitchen staff.
                  </p>
                </div>
              </div>
            </div>

            {/* Order Cards Grid */}
            <div className={`grid gap-3 ${activeOrders.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {activeOrders.map((ord, idx) => (
                <div
                  key={ord.id}
                  className="p-3.5 rounded-2xl bg-background/90 dark:bg-card/90 border border-border/80 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-orange-500/40 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span className="text-xs font-black text-foreground">
                        Order #{ord.order_number}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        ord.status === "ready"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/50"
                          : ord.status === "preparing"
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-300/50"
                          : ord.status === "served"
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/50"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/50"
                      }`}>
                        {getStatusInfo(ord.status).label}
                      </span>
                    </div>
                    {ord.status === "served" && (
                      <button
                        type="button"
                        onClick={() => removeActiveOrderId(ord.id)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title="Dismiss served order"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* List items inside this order */}
                  <div className="bg-secondary/40 dark:bg-secondary/20 rounded-xl p-2 space-y-1">
                    {ord.items.map((it) => (
                      <div key={it.id} className="flex justify-between items-center text-xs">
                        <span className="truncate">
                          <strong className="text-orange-600 dark:text-orange-400">{it.quantity}x</strong> {it.item_name}
                        </span>
                        <span className="font-bold text-foreground text-[11px] shrink-0">
                          {formatCurrency(it.item_total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      Total: <strong className="text-foreground">{formatCurrency(ord.total_amount)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push(`/orders/${ord.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-black flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Track Food Process</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Table Warning Banner if error */}
        {tableValidationStatus === "error" && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{tableErrorMessage || "Table could not be verified."}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="font-bold underline ml-2 shrink-0 hover:text-rose-950 dark:hover:text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Delivery Mode Login Notice Banner */}
        {orderType === "delivery" && !customer && !isLoading && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border border-orange-500/25 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-orange-600/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-extrabold text-foreground">
                  Sign In Required for Food Delivery
                </div>
                <div className="text-[11px] text-muted-foreground truncate sm:text-clip">
                  Please log in or register before adding food to your delivery order.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAuthModalMessage("Please sign in or create an account to order food delivery.");
                setIsAuthModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shrink-0 shadow-xs active:scale-95 transition-all"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-8">
            {[1, 2].map((group) => (
              <div key={group} className="space-y-4">
                <div className="h-6 w-40 rounded-xl bg-secondary skeleton-shimmer" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-28 rounded-2xl sm:rounded-3xl bg-secondary/50 border border-border/60 skeleton-shimmer p-4 flex gap-4"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredCategories.length === 0 && (
          <div className="text-center py-20 px-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-base text-foreground">No dishes found</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              We couldn't find any dishes matching "{searchQuery}" with the selected filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setDietaryFilter("all");
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold border border-border transition-all"
            >
              Reset Search & Filters
            </button>
          </div>
        )}

        {/* Menu Categories and Items */}
        {!isLoading &&
          filteredCategories.map((category) => (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="scroll-mt-36 space-y-3.5"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground">
                    {category.name}
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-bold">
                    {category.items.length}
                  </span>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group modern-card rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 flex gap-3 sm:gap-4 transition-all cursor-pointer relative overflow-hidden active:scale-[0.99]"
                  >
                    {/* Item Image */}
                    {item.image_url ? (
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl sm:rounded-2xl overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-900 border border-border/50">
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 96px, 112px"
                        />
                        {item.is_popular && (
                          <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-orange-600 to-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            POPULAR
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl sm:rounded-2xl bg-secondary/80 flex items-center justify-center shrink-0 border border-border/50 text-muted-foreground">
                        <Utensils className="w-6 h-6 opacity-40" />
                      </div>
                    )}

                    {/* Item Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-1">
                          {item.name}
                        </h3>

                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Dietary Tags */}
                        {item.dietary_tags && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.dietary_tags.split(",").map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.2 rounded-md bg-secondary/90 text-muted-foreground font-semibold capitalize"
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Price & Add Button */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
                        <span className="font-black text-sm sm:text-base text-foreground tracking-tight">
                          {formatCurrency(item.price)}
                        </span>

                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-orange-600/20 transition-transform active:scale-95 group-hover:shadow-md"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </main>

      {/* Floating Bottom Bar: Cart */}
      {itemCount > 0 && (
        <div className="fixed bottom-safe inset-x-3 sm:inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-5 duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-4 sm:px-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:from-orange-700 hover:to-amber-600 text-white font-extrabold flex items-center justify-between shadow-xl shadow-orange-500/30 transition-all active:scale-[0.98] border border-white/20"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-white/25 backdrop-blur-xs flex items-center justify-center font-black text-xs text-white">
                {itemCount}
              </div>
              <span className="text-xs sm:text-sm font-bold">View Current Order</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-black tracking-tight">
                {formatCurrency(total)}
              </span>
              <ShoppingBag className="w-4 h-4 text-white/90" />
            </div>
          </button>
        </div>
      )}

      {/* Customization Modal */}
      {selectedItemForModal && (
        <CustomizationModal
          item={selectedItemForModal}
          isOpen={!!selectedItemForModal}
          onClose={() => setSelectedItemForModal(null)}
          onAddToCart={(item, qty, cust, notes) => {
            if (orderType === "delivery" && !customer) {
              setSelectedItemForModal(null);
              setPendingItemToAdd(item);
              setAuthModalMessage(`Please sign in or create an account to order "${item.name}" for delivery.`);
              setIsAuthModalOpen(true);
              toast.info("Account Required for Delivery", {
                description: `Please sign in or create an account to add "${item.name}" to your delivery order.`,
              });
              return;
            }
            addToCart(item, qty, cust, notes);
          }}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
      />

      {/* Customer Account Modal */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setAuthModalMessage("");
          setPendingItemToAdd(null);
        }}
        message={authModalMessage}
        onLoginSuccess={(loggedCustomer) => {
          if (pendingItemToAdd) {
            const itemToProcess = pendingItemToAdd;
            setPendingItemToAdd(null);
            if (itemToProcess.customizations && itemToProcess.customizations.length > 0) {
              setSelectedItemForModal(itemToProcess);
            } else {
              addToCart(itemToProcess, 1);
              toast.success(`Added 1x ${itemToProcess.name}`, {
                description: `Welcome, ${loggedCustomer.full_name}! Added to your delivery order.`,
                duration: 3000,
              });
            }
          }
        }}
      />
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-2" />
          <p className="text-xs text-muted-foreground font-semibold">Opening Bistro Menu...</p>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
