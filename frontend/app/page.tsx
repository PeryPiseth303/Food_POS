"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  QrCode,
  ArrowRight,
  Utensils,
  ChefHat,
  Sparkles,
  Smartphone,
  CheckCircle,
  ShieldCheck,
  Home,
  User,
  ShoppingBag,
  MapPin,
  Clock
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import CustomerAuthModal from "@/components/auth/CustomerAuthModal";
import { useCart } from "@/lib/store";

export default function HomePage() {
  const router = useRouter();
  const { customer, setOrderType } = useCart();
  const [selectedTable, setSelectedTable] = useState("3");
  const [customTable, setCustomTable] = useState("");
  const [activeChannel, setActiveChannel] = useState<"dine_in" | "delivery">("dine_in");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleSimulateScan = (tableNum: string) => {
    setOrderType("dine_in");
    router.push(`/menu?table=${tableNum}`);
  };

  const handleOnlineOrder = () => {
    setOrderType("delivery");
    router.push(`/menu?mode=delivery`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50/50 via-background to-background dark:from-stone-950 dark:to-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg block leading-none">Bistro Moderne</span>
              <span className="text-xs text-muted-foreground">Smart Dining & Online Delivery</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="outline" />

            {/* Customer Account Button */}
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground border border-border shadow-xs transition-colors"
            >
              <User className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>{customer ? `Hi, ${customer.full_name.split(" ")[0]}` : "Customer Login"}</span>
            </button>

            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity shadow-sm"
            >
              <ChefHat className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Kitchen</span> Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-10 text-center flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-medium mx-auto mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          Dine-In At Shop & Online Home Delivery
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto leading-tight sm:leading-tight">
          How Would You Like to Order Today?
        </h1>

        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
          Scan your table code if dining in at our restaurant, or order straight from home with fast delivery right to your door.
        </p>

        {/* Ordering Channel Selector Cards */}
        <div className="mt-8 max-w-2xl mx-auto w-full">
          {/* Toggle Pills */}
          <div className="inline-flex p-1.5 rounded-2xl bg-secondary/70 border border-border mb-6">
            <button
              onClick={() => setActiveChannel("dine_in")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeChannel === "dine_in"
                  ? "bg-card text-foreground shadow-sm scale-102"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Utensils className="w-4 h-4 text-orange-600" />
              <span>Dine-In at Shop</span>
            </button>

            <button
              onClick={() => setActiveChannel("delivery")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeChannel === "delivery"
                  ? "bg-card text-foreground shadow-sm scale-102"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Home className="w-4 h-4 text-blue-600" />
              <span>Order from Home</span>
            </button>
          </div>

          {/* CHANNEL 1: DINE-IN AT TABLE */}
          {activeChannel === "dine_in" && (
            <div className="bg-card border border-border shadow-xl shadow-orange-500/5 rounded-3xl p-6 sm:p-8 text-left animate-in fade-in">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Table QR Ordering</h2>
                  <p className="text-xs text-muted-foreground">Select your table to simulate scanning the table stand QR code:</p>
                </div>
              </div>

              {/* Quick Table Buttons */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
                {["1", "2", "3", "5", "8", "12"].map((tableNum) => (
                  <button
                    key={tableNum}
                    onClick={() => setSelectedTable(tableNum)}
                    className={`py-2.5 px-2 rounded-xl text-center font-bold text-sm border transition-all ${
                      selectedTable === tableNum
                        ? "bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-500/25 scale-105"
                        : "bg-secondary/60 hover:bg-secondary border-border text-foreground"
                    }`}
                  >
                    Table {tableNum}
                  </button>
                ))}
              </div>

              {/* Custom Table Input */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Or enter Table ID (e.g. VIP-1)"
                  value={customTable}
                  onChange={(e) => {
                    setCustomTable(e.target.value);
                    if (e.target.value) setSelectedTable(e.target.value);
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Launch Button */}
              <button
                onClick={() => handleSimulateScan(selectedTable)}
                className="w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-transform active:scale-[0.98]"
              >
                <Smartphone className="w-4 h-4" />
                Open Dine-In Menu for Table #{selectedTable}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {/* CHANNEL 2: ORDER FROM HOME (ONLINE DELIVERY) */}
          {activeChannel === "delivery" && (
            <div className="bg-card border border-border shadow-xl shadow-blue-500/5 rounded-3xl p-6 sm:p-8 text-left animate-in fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base">Online Home Delivery</h2>
                  <p className="text-xs text-muted-foreground">Order from home with address auto-save & Telegram alerts</p>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-2xl p-4 border border-border/70 space-y-2 mb-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>No table needed • Enter delivery location at checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>Freshly prepared and dispatched within ~20-30 minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-orange-500" />
                  <span>Save your account to keep your delivery address remembered</span>
                </div>
              </div>

              <button
                onClick={handleOnlineOrder}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-transform active:scale-[0.98]"
              >
                <ShoppingBag className="w-4 h-4" />
                Browse Menu & Order from Home
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {/* Feature Badges */}
          <div className="mt-8 pt-5 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>QR Anti-Spoof</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Home Delivery</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Telegram Dispatch</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Customer Accounts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>Bistro Moderne • Smart QR Dining & Online Home Delivery System</p>
      </footer>

      {/* Customer Account Modal */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </main>
  );
}
