"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/lib/store";
import { registerCustomer, loginCustomer, updateCustomerProfile, getCustomerOrders } from "@/lib/api";
import { Order } from "@/lib/types";
import { formatCurrency, formatTime, getStatusInfo } from "@/lib/utils";
import { X, User, Lock, Mail, Phone, MapPin, Loader2, LogOut, Package, Check, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export default function CustomerAuthModal({
  isOpen,
  onClose,
  defaultTab = "login",
}: CustomerAuthModalProps) {
  const { customer, customerToken, loginCustomerStore, logoutCustomerStore, updateCustomerStore } = useCart();

  const [activeTab, setActiveTab] = useState<"login" | "register" | "profile" | "orders">(
    customer ? "profile" : defaultTab
  );

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Orders state
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (customer) {
      setActiveTab("profile");
      setFullName(customer.full_name || "");
      setPhone(customer.phone || "");
      setAddress(customer.delivery_address || "");
    } else {
      setActiveTab(defaultTab);
    }
  }, [customer, defaultTab, isOpen]);

  // Load past orders when clicking the orders tab
  useEffect(() => {
    if (isOpen && activeTab === "orders" && customerToken) {
      setLoadingOrders(true);
      getCustomerOrders(customerToken)
        .then((data) => setPastOrders(data))
        .catch((err) => console.error("Error loading customer orders", err))
        .finally(() => setLoadingOrders(false));
    }
  }, [isOpen, activeTab, customerToken]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await loginCustomer({ email: email.trim(), password });
      loginCustomerStore(res.customer, res.access_token);
      toast.success(`Welcome back, ${res.customer.full_name}!`);
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please verify your confirm password.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await registerCustomer({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
      loginCustomerStore(res.customer, res.access_token);
      toast.success(`Welcome, ${res.customer.full_name}! Your account has been created.`);
      setPassword("");
      setConfirmPassword("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updated = await updateCustomerProfile({
        full_name: fullName,
        phone,
        delivery_address: address,
      }, customerToken || undefined);
      updateCustomerStore(updated);
      toast.success("Profile and delivery details updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logoutCustomerStore();
    toast.info("Signed out from customer account.");
    setActiveTab("login");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-border overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">
                {customer ? `Hi, ${customer.full_name}` : "Customer Online Account"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {customer ? "Manage your address & view orders" : "Order from home & save your delivery info"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/70 bg-secondary/30 px-3 py-1 text-xs font-semibold">
          {!customer ? (
            <>
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2 text-center rounded-lg transition-all ${
                  activeTab === "login"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab("register")}
                className={`flex-1 py-2 text-center rounded-lg transition-all ${
                  activeTab === "register"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex-1 py-2 text-center rounded-lg transition-all ${
                  activeTab === "profile"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                My Profile & Address
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`flex-1 py-2 text-center rounded-lg transition-all ${
                  activeTab === "orders"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                My Orders
              </button>
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: LOGIN */}
          {activeTab === "login" && !customer && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="text-center pb-2">
                <h3 className="font-extrabold text-base text-foreground">Sign In to Your Account</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign in to auto-fill your delivery address and track past orders.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In & Continue"}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-xs font-bold text-orange-600 hover:underline"
                >
                  Create one here
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {activeTab === "register" && !customer && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="text-center pb-1">
                <h3 className="font-extrabold text-base text-foreground">Create Your Account</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sign up with your name and email. Phone and delivery location will be requested when you place an order.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 chars"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Helpful Info Notice */}
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80 flex items-start gap-2.5 text-xs text-muted-foreground">
                <MapPin className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <span>
                  Your contact phone and delivery location will be requested at checkout when you place your order.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-muted-foreground">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-xs font-bold text-orange-600 hover:underline"
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PROFILE (LOGGED IN) */}
          {activeTab === "profile" && customer && (
            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-600 text-white font-black text-sm flex items-center justify-center shadow">
                  {customer.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{customer.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                  Active
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Saved Delivery Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your home delivery address..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center gap-1 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: ORDERS (LOGGED IN) */}
          {activeTab === "orders" && customer && (
            <div className="space-y-3">
              {loadingOrders ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-600 mb-2" />
                  <p className="text-xs">Loading your order history...</p>
                </div>
              ) : pastOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="font-bold text-sm">No orders yet</p>
                  <p className="text-xs mt-1">Explore our menu and place your first online order!</p>
                </div>
              ) : (
                pastOrders.map((ord) => {
                  const statusInfo = getStatusInfo(ord.status);
                  return (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-2xl bg-secondary/30 border border-border space-y-2 hover:border-orange-500/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-foreground">#{ord.order_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>{ord.order_type === "delivery" ? "🏠 Delivery" : `🍽️ Table #${ord.table_number}`}</span>
                        <span className="font-bold text-foreground">{formatCurrency(ord.total_amount)}</span>
                      </div>

                      <div className="text-[11px] text-muted-foreground line-clamp-1 border-t border-border/50 pt-1.5">
                        {ord.items.map((it) => `${it.quantity}x ${it.item_name}`).join(", ")}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
