"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/lib/store";
import { registerCustomer, loginCustomer, verifyCustomerOtp, resendCustomerOtp, updateCustomerProfile, getCustomerOrders } from "@/lib/api";
import { Order, CustomerUser } from "@/lib/types";
import { formatCurrency, formatTime, getStatusInfo } from "@/lib/utils";
import { X, User, Lock, Mail, Phone, MapPin, Loader2, LogOut, Package, Check, Sparkles, AlertCircle, ShoppingBag, Clock, KeyRound, ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
  message?: string;
  onLoginSuccess?: (customer: CustomerUser) => void;
}

export default function CustomerAuthModal({
  isOpen,
  onClose,
  defaultTab = "login",
  message,
  onLoginSuccess,
}: CustomerAuthModalProps) {
  const { customer, customerToken, loginCustomerStore, logoutCustomerStore, updateCustomerStore } = useCart();

  const [activeTab, setActiveTab] = useState<"login" | "register" | "profile" | "orders" | "verify">(
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

  // OTP Verification states
  const [otpCode, setOtpCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

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
      if (activeTab !== "verify") {
        setActiveTab(defaultTab);
      }
    }
  }, [customer, defaultTab, isOpen]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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
      if (onLoginSuccess) {
        onLoginSuccess(res.customer);
      }
      onClose();
    } catch (err: any) {
      if (err.requiresVerification || (err.message && err.message.includes("EMAIL_NOT_VERIFIED"))) {
        setPendingEmail(email.trim());
        setActiveTab("verify");
        setResendCooldown(60);
        toast.info("Please verify your email address. A verification code has been dispatched.");
      } else {
        toast.error(err.message || "Failed to sign in. Please check credentials.");
      }
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
      setPendingEmail(res.email || email.trim());
      setDebugOtp(res.debug_otp || null);
      if (res.debug_otp) {
        setOtpCode(res.debug_otp);
      }
      setActiveTab("verify");
      setResendCooldown(60);
      toast.success(res.message || "Verification code sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (cleanOtp.length !== 6) {
      toast.error("Please enter the 6-digit verification code.");
      return;
    }
    setIsLoading(true);
    try {
      const targetEmail = pendingEmail || email.trim();
      const res = await verifyCustomerOtp({
        email: targetEmail,
        otp_code: cleanOtp,
      });
      loginCustomerStore(res.customer, res.access_token);
      toast.success(`Account verified! Welcome to Bistro Moderne, ${res.customer.full_name}!`);
      setPassword("");
      setConfirmPassword("");
      setOtpCode("");
      if (onLoginSuccess) {
        onLoginSuccess(res.customer);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Verification failed. Please check the code and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    const targetEmail = pendingEmail || email.trim();
    if (!targetEmail) {
      toast.error("No email address specified for verification.");
      return;
    }
    setIsResending(true);
    try {
      const res = await resendCustomerOtp({ email: targetEmail });
      if (res.debug_otp) {
        setDebugOtp(res.debug_otp);
        setOtpCode(res.debug_otp);
      }
      setResendCooldown(60);
      toast.success(res.message || `A fresh verification code was sent to ${targetEmail}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification code.");
    } finally {
      setIsResending(false);
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col shadow-2xl border border-border/80 overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center bg-card">
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-600/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-2xs font-bold">
              {activeTab === "verify" ? <KeyRound className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                {customer ? `Hi, ${customer.full_name}` : (activeTab === "verify" ? "Email Verification" : "Customer Online Account")}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {customer ? "Manage your address & view orders" : (activeTab === "verify" ? "Enter the 6-digit OTP code sent to your email" : "Order online & save your delivery location")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/70 bg-secondary/30 px-3 py-1 text-xs font-semibold">
          {!customer ? (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2 text-center rounded-xl transition-all ${
                  activeTab === "login"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                className={`flex-1 py-2 text-center rounded-xl transition-all ${
                  activeTab === "register"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Create Account
              </button>
              {activeTab === "verify" && (
                <button
                  type="button"
                  className="flex-1 py-2 text-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                >
                  Verify Code
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={`flex-1 py-2 text-center rounded-xl transition-all ${
                  activeTab === "profile"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Profile & Address
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("orders")}
                className={`flex-1 py-2 text-center rounded-xl transition-all ${
                  activeTab === "orders"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Past Orders
              </button>
            </>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 pb-safe">
          {message && !customer && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-orange-950 dark:text-orange-200 text-xs shadow-2xs">
              <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{message}</div>
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {activeTab === "login" && !customer && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="text-center pb-1">
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
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
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
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In & Continue"}
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
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
                  Sign up with your name and email to save your favorites and orders.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
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
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
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
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 chars"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
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
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    />
                  </div>
                </div>
              </div>

              {/* Helpful Info Notice */}
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80 flex items-start gap-2.5 text-xs text-muted-foreground">
                <MapPin className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                <span>
                  Your contact phone and delivery location will be saved automatically when you place orders.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-1"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
              </button>

              <div className="text-center pt-1">
                <span className="text-xs text-muted-foreground">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("login")}
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}

          {/* TAB: VERIFY OTP */}
          {activeTab === "verify" && !customer && (
            <div className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-foreground">Verify Your Email Address</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                  We've sent a 6-digit verification code to <span className="font-semibold text-foreground break-all">{pendingEmail || email}</span>
                </p>
              </div>

              {debugOtp && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Dev Helper Code: <strong className="font-mono font-bold tracking-widest text-sm">{debugOtp}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpCode(debugOtp)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs transition-colors"
                  >
                    Quick Fill
                  </button>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2 text-center">
                    Enter 6-Digit OTP Code
                  </label>
                  <div className="max-w-[280px] mx-auto">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      className="w-full text-center tracking-[0.5em] font-mono text-2xl sm:text-3xl py-3 px-4 rounded-2xl bg-secondary/50 border-2 border-orange-500/40 focus:border-orange-500 text-foreground focus:outline-none focus:ring-4 focus:ring-orange-500/20 transition-all font-black placeholder:text-muted-foreground/30 placeholder:tracking-widest"
                    />
                  </div>
                  <p className="text-[11px] text-center text-muted-foreground mt-2">
                    Code expires in 10 minutes. Please check your inbox or spam folder.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otpCode.trim().length !== 6}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Activate Account"}
                </button>

                <div className="flex items-center justify-between text-xs pt-1 px-1 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("register");
                      setOtpCode("");
                    }}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to form
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isResending}
                    onClick={handleResendOtp}
                    className="text-orange-600 dark:text-orange-400 font-semibold hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
                  >
                    {isResending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend Code"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PROFILE (LOGGED IN) */}
          {activeTab === "profile" && customer && (
            <form onSubmit={handleUpdateProfile} className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white font-black text-sm flex items-center justify-center shadow-xs">
                  {customer.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{customer.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                  Active
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Saved Delivery Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                  <textarea
                    rows={2}
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your home delivery address..."
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40 resize-none"
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
                  <p className="text-xs font-semibold">Loading your order history...</p>
                </div>
              ) : pastOrders.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-2 text-muted-foreground">
                    <Package className="w-6 h-6 opacity-60" />
                  </div>
                  <p className="font-bold text-sm text-foreground">No orders yet</p>
                  <p className="text-xs mt-1 text-muted-foreground">Explore our menu and place your first online order!</p>
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
                        <span className="font-extrabold text-foreground">{formatCurrency(ord.total_amount)}</span>
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
