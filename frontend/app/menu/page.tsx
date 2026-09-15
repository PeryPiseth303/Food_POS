"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { getPublicMenu, validateTable } from "@/lib/api";
import { useCart } from "@/lib/store";
import { FullMenuResponse, MenuItem, Category } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
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
  User
} from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
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
    total
  } = useCart();

  const [menuData, setMenuData] = useState<FullMenuResponse | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dietaryFilter, setDietaryFilter] = useState("all");
  const [selectedItemForModal, setSelectedItemForModal] = useState<MenuItem | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tableValidationStatus, setTableValidationStatus] = useState<"valid" | "error">("valid");
  const [tableErrorMessage, setTableErrorMessage] = useState("");

  // Sync mode parameter
  useEffect(() => {
    if (modeParam === "delivery") {
      setOrderType("delivery");
    } else if (tableParam) {
      setOrderType("dine_in");
    }
  }, [modeParam, tableParam, setOrderType]);

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
    if (item.customizations && item.customizations.length > 0) {
      setSelectedItemForModal(item);
    } else {
      addToCart(item, 1);
      toast.success(`Added 1x ${item.name}`);
    }
  };

  const handleScrollToCategory = (catId: number) => {
    setActiveCategory(catId);
    const element = document.getElementById(`category-${catId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Top Sticky Bar: Restaurant & Table Badge */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-sm">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base leading-tight">
                {menuData?.restaurant_name || "Bistro Moderne"}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="w-3 h-3 text-orange-500" />
                <span>{orderType === "delivery" ? "Online Home Delivery" : "Dine-In Menu"}</span>
              </div>
            </div>
          </div>

          {/* Action buttons: ThemeToggle, Account, Mode Badge */}
          <div className="flex items-center gap-2">
            <ThemeToggle variant="outline" />

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border shadow-xs transition-colors"
              title={customer ? `Signed in as ${customer.full_name}` : "Sign in / Register"}
            >
              <User className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span className="hidden sm:inline">
                {customer ? customer.full_name.split(" ")[0] : "Account"}
              </span>
            </button>

            {orderType === "delivery" ? (
              <button
                onClick={() => setOrderType("dine_in")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-sm hover:bg-blue-500/20 transition-all"
                title="Click to switch to Dine-In at table"
              >
                <Home className="w-3.5 h-3.5 text-blue-500" />
                <span>Delivery</span>
              </button>
            ) : tableValidationStatus === "error" ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Table Error</span>
              </div>
            ) : (
              <button
                onClick={() => setOrderType("delivery")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-sm hover:bg-emerald-500/20 transition-all"
                title="Click to switch to Order from Home"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Table #{tableSession?.table_number || tableParam || "1"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Delivery Info Banner */}
        {orderType === "delivery" && (
          <div className="bg-blue-500/10 border-t border-b border-blue-500/20 px-4 py-2">
            <div className="max-w-4xl mx-auto flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 truncate">
                <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-semibold truncate">
                  {deliveryAddress ? `Delivering to: ${deliveryAddress}` : "Ordering from Home • Fill address in cart checkout"}
                </span>
              </div>
              <button
                onClick={() => setOrderType("dine_in")}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2"
              >
                Switch to Dine-In
              </button>
            </div>
          </div>
        )}

        {/* Search & Dietary Filters */}
        <div className="max-w-4xl mx-auto px-4 pb-3 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search burgers, pizzas, cocktails, desserts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-secondary/50 border border-input focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
            />
          </div>

          {/* Dietary Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 text-xs font-medium">
            {[
              { id: "all", label: "All Items" },
              { id: "popular", label: "⭐ Popular" },
              { id: "vegetarian", label: "🥦 Veggie" },
              { id: "spicy", label: "🔥 Spicy" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDietaryFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  dietaryFilter === f.id
                    ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-bold shadow-sm"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Sticky Nav Tabs */}
          {menuData && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-border/50">
              {menuData.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleScrollToCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    activeCategory === cat.id
                      ? "text-orange-600 dark:text-orange-400 border-b-2 border-orange-600 dark:border-orange-400"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-10">
        {/* Table Warning Banner if error */}
        {tableValidationStatus === "error" && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{tableErrorMessage || "Table could not be verified."}</span>
            </div>
            <button
              onClick={() => router.push("/")}
              className="font-bold underline ml-3"
            >
              Choose Table
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="h-6 w-36 bg-secondary rounded-md" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="h-32 bg-secondary rounded-2xl" />
                  <div className="h-32 bg-secondary rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Menu Categories and Items */}
        {!isLoading && filteredCategories.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-3xl mb-2">🔍</p>
            <p className="font-bold text-sm">No dishes found matching your criteria</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setDietaryFilter("all");
              }}
              className="mt-3 text-xs text-orange-600 font-semibold underline"
            >
              Reset filters
            </button>
          </div>
        )}

        {!isLoading &&
          filteredCategories.map((category) => (
            <section
              key={category.id}
              id={`category-${category.id}`}
              className="scroll-mt-40 space-y-4"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                  {category.name}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                  {category.items.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group bg-card hover:border-orange-500/50 border border-border rounded-2xl p-3.5 flex gap-3.5 transition-all cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99] relative overflow-hidden"
                  >
                    {/* Item Image */}
                    {item.image_url && (
                      <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-stone-100 dark:bg-stone-900">
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 96px, 112px"
                        />
                        {item.is_popular && (
                          <div className="absolute top-1.5 left-1.5 bg-orange-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow">
                            POPULAR
                          </div>
                        )}
                      </div>
                    )}

                    {/* Item Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-bold text-sm text-foreground group-hover:text-orange-600 transition-colors line-clamp-1">
                            {item.name}
                          </h3>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Dietary Tags */}
                        {item.dietary_tags && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {item.dietary_tags.split(",").map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-medium capitalize"
                              >
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Price & Add Button */}
                      <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-border/40">
                        <span className="font-black text-sm text-foreground">
                          {formatCurrency(item.price)}
                        </span>

                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
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

      {/* Floating Cart Button (Mobile-first) */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-5">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center justify-between shadow-xl shadow-orange-600/30 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center font-extrabold text-xs">
                {itemCount}
              </div>
              <span className="text-sm">View Order</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold">{formatCurrency(total)}</span>
              <ShoppingBag className="w-4 h-4" />
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
          onAddToCart={addToCart}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Customer Account Modal */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
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
          <p className="text-xs text-muted-foreground font-semibold">Opening Menu...</p>
        </div>
      }
    >
      <MenuContent />
    </Suspense>
  );
}
