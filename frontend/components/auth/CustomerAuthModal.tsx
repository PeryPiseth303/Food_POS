"use client";

import { useState, useEffect, useRef } from "react";
import { useCart } from "@/lib/store";
import { registerCustomer, loginCustomer, verifyCustomerOtp, resendCustomerOtp, requestCustomerLoginOtp, loginWithCustomerOtp, updateCustomerProfile, getCustomerOrders } from "@/lib/api";
import { Order, CustomerUser } from "@/lib/types";
import { formatCurrency, formatTime, getStatusInfo } from "@/lib/utils";
import { X, User, Lock, Mail, Phone, MapPin, Loader2, LogOut, Package, Check, Sparkles, AlertCircle, ShoppingBag, Clock, KeyRound, ArrowLeft, RefreshCw, ShieldCheck, Edit2, ExternalLink, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

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
  const [otpMode, setOtpMode] = useState<"login" | "register">("login");

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
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

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

  // Reset transient OTP state when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setOtpSent(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpCode("");
    }
  }, [isOpen]);

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

  // Focus the first OTP input box when OTP is sent or when switching to verify tab
  useEffect(() => {
    if (isOpen && ((activeTab === "login" && otpSent) || activeTab === "verify")) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, otpSent]);

  if (!isOpen) return null;

  const handleSendLoginOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      toast.error("Please enter your email address to receive a login code.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await requestCustomerLoginOtp(cleanEmail);
      setPendingEmail(cleanEmail);
      setOtpMode("login");
      setOtpSent(true);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpCode("");
      setResendCooldown(60);
      toast.success(res.message || `6-digit login code sent to ${cleanEmail}!`);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      toast.error(err.message || "Failed to send login code. Please check your email.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      await handleSendLoginOtp();
      return;
    }
    const fullCode = otpDigits.join("").trim();
    if (fullCode.length !== 6) {
      toast.error("Please enter the complete 6-digit security code.");
      return;
    }
    await verifyWithCode(fullCode);
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
      setOtpMode("register");
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpCode("");
      setActiveTab("verify");
      setResendCooldown(60);
      toast.success(res.message || "Verification code sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create account.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyWithCode = async (codeToVerify: string) => {
    const cleanOtp = codeToVerify.trim();
    if (cleanOtp.length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      const targetEmail = pendingEmail || email.trim();
      const res =
        otpMode === "login"
          ? await loginWithCustomerOtp({
              email: targetEmail,
              otp_code: cleanOtp,
            })
          : await verifyCustomerOtp({
              email: targetEmail,
              otp_code: cleanOtp,
            });

      loginCustomerStore(res.customer, res.access_token);
      toast.success(`Welcome back, ${res.customer.full_name}!`);
      setPassword("");
      setConfirmPassword("");
      setOtpCode("");
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpSent(false);
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = (otpCode.trim() || otpDigits.join("").trim());
    verifyWithCode(cleanOtp);
  };

  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      setOtpCode(next.join(""));
      return;
    }

    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      for (let i = 0; i < 6; i++) {
        next[i] = chars[i] || "";
      }
      setOtpDigits(next);
      const full = next.join("");
      setOtpCode(full);
      const focusIndex = Math.min(chars.length, 5);
      inputRefs.current[focusIndex]?.focus();
      if (full.length === 6) {
        verifyWithCode(full);
      }
      return;
    }

    const next = [...otpDigits];
    next[index] = cleaned.charAt(cleaned.length - 1);
    setOtpDigits(next);
    const full = next.join("");
    setOtpCode(full);

    if (index < 5 && cleaned) {
      inputRefs.current[index + 1]?.focus();
    }

    if (full.length === 6) {
      verifyWithCode(full);
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const next = [...otpDigits];
        next[index - 1] = "";
        setOtpDigits(next);
        setOtpCode(next.join(""));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const chars = pasted.split("");
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < 6; i++) {
      next[i] = chars[i] || "";
    }
    setOtpDigits(next);
    const full = next.join("");
    setOtpCode(full);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
    if (full.length === 6) {
      verifyWithCode(full);
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
      const res =
        otpMode === "login"
          ? await requestCustomerLoginOtp(targetEmail)
          : await resendCustomerOtp({ email: targetEmail });

      setOtpDigits(["", "", "", "", "", ""]);
      setOtpCode("");
      setResendCooldown(60);
      toast.success(res.message || `A fresh code was sent to ${targetEmail}.`);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend code.");
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
                {customer ? `Hi, ${customer.full_name}` : (activeTab === "verify" ? "Account Verification" : (activeTab === "login" ? "Google OTP Sign In" : "Customer Online Account"))}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {customer ? "Manage your address & view orders" : (activeTab === "verify" ? "Enter the 6-digit code sent to your email" : (activeTab === "login" ? "Passwordless sign in with 6-digit OTP" : "Order online & save your delivery location"))}
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
                onClick={() => {
                  setActiveTab("login");
                  setOtpMode("login");
                }}
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
                  className="flex-1 py-2 text-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Verify Account</span>
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

          {/* TAB 1: LOGIN (PASSWORDLESS GOOGLE OTP) */}
          {activeTab === "login" && !customer && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-center pb-0.5">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-2.5 shadow-inner border border-orange-500/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-foreground tracking-tight flex items-center justify-center gap-2">
                  <GoogleIcon className="w-4 h-4" />
                  <span>Google OTP Sign In</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs mx-auto">
                  Enter your email to receive a secure 6-digit one-time passcode. No password needed!
                </p>
              </div>

              {/* Email Address with Inline Send/Resend Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Email Address
                  </label>
                  {otpSent && (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpDigits(["", "", "", "", "", ""]);
                        setOtpCode("");
                      }}
                      className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" /> Change email
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full pl-9 pr-28 py-2.5 text-xs sm:text-sm rounded-xl bg-secondary/40 border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/40 font-medium"
                  />
                  <button
                    type="button"
                    disabled={isLoading || isResending || !email.trim() || resendCooldown > 0}
                    onClick={() => handleSendLoginOtp()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-[11px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {isResending || (isLoading && !otpSent) ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : resendCooldown > 0 ? (
                      <span>{resendCooldown}s</span>
                    ) : otpSent ? (
                      <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Resend</span>
                    ) : (
                      <span className="flex items-center gap-1"><GoogleIcon className="w-3 h-3" /> Get Code</span>
                    )}
                  </button>
                </div>
              </div>

              {/* 6-Digit OTP Boxes (Fits exactly where the password box used to be) */}
              <div className="space-y-2 pt-0.5">
                <div className="flex items-center justify-between px-0.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span>6-Digit Security Code</span>
                  </label>
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <span>Open Gmail</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>

                {/* 6 Individual Digit Boxes */}
                <div
                  className="flex items-center justify-center gap-2 sm:gap-2.5 py-1"
                  onPaste={handleDigitPaste}
                >
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete={idx === 0 ? "one-time-code" : "off"}
                      value={digit}
                      disabled={!otpSent}
                      onClick={() => {
                        if (!otpSent) {
                          if (!email.trim()) {
                            toast.info("Please enter your email first to receive the code.");
                          } else {
                            handleSendLoginOtp();
                          }
                        }
                      }}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      placeholder="•"
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono font-black text-2xl sm:text-3xl rounded-2xl border-2 transition-all outline-none select-none placeholder:text-muted-foreground/30 ${
                        !otpSent
                          ? "border-border/60 bg-secondary/20 text-muted-foreground/40 cursor-pointer"
                          : digit
                          ? "border-orange-500 bg-orange-500/10 text-foreground shadow-sm shadow-orange-500/15"
                          : "border-border/80 bg-secondary/30 text-foreground hover:border-border focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 focus:bg-card"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>⏱️ Code expires in 10 minutes</span>
                  {resendCooldown > 0 ? (
                    <span className="text-orange-600 dark:text-orange-400 font-medium">Resend available in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={!email.trim() || isResending}
                      className="text-orange-600 dark:text-orange-400 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isLoading || !email.trim() || (otpSent && otpDigits.join("").trim().length !== 6)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !otpSent ? (
                  <>
                    <GoogleIcon className="w-4 h-4" />
                    <span>Send 6-Digit Code & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify & Sign In</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1 border-t border-border/60">
                <span className="text-xs text-muted-foreground">Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
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

          {/* TAB: VERIFY OTP (6-CELL OTP DESIGN) */}
          {activeTab === "verify" && !customer && (
            <div className="space-y-4">
              {/* Header */}
              <div className="text-center pb-0.5">
                <div className="relative inline-flex items-center justify-center mb-2.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500/15 via-amber-500/15 to-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shadow-inner border border-orange-500/20">
                    <Mail className="w-7 h-7" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border-2 border-card">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-foreground tracking-tight">
                  {otpMode === "login" ? "Enter 6-Digit Login Code" : "Verify Your Email Address"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We've sent a one-time passcode to:
                </p>

                {/* Email Chip with Edit and Open Gmail Actions */}
                <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/80 text-xs font-semibold max-w-full">
                  <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-foreground font-mono truncate max-w-[170px] sm:max-w-[210px]">
                    {pendingEmail || email}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(otpMode === "login" ? "login" : "register");
                      setOtpDigits(["", "", "", "", "", ""]);
                      setOtpCode("");
                    }}
                    className="p-1 rounded-full hover:bg-card text-muted-foreground hover:text-orange-600 transition-colors cursor-pointer"
                    title="Change email address"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-0.5 font-bold cursor-pointer"
                  >
                    Open Gmail <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>

              {/* 6 Individual Digit Boxes */}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <label className="text-xs font-semibold text-foreground">
                      6-Digit Security Code
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      Paste or type digits
                    </span>
                  </div>

                  <div
                    className="flex items-center justify-center gap-2 sm:gap-2.5 py-1"
                    onPaste={handleDigitPaste}
                  >
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete={idx === 0 ? "one-time-code" : "off"}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        className={`w-11 h-14 sm:w-12 sm:h-14 text-center font-mono font-black text-2xl sm:text-3xl rounded-2xl border-2 transition-all outline-none select-none ${
                          digit
                            ? "border-orange-500 bg-orange-500/10 text-foreground shadow-sm shadow-orange-500/15"
                            : "border-border/80 bg-secondary/30 text-foreground hover:border-border focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 focus:bg-card"
                        }`}
                      />
                    ))}
                  </div>

                  <p className="text-[11px] text-center text-muted-foreground mt-2.5">
                    ⏱️ Code expires in 10 minutes. Check your inbox, spam, or promotions.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading || otpDigits.join("").trim().length !== 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : otpMode === "login" ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify & Sign In</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Activate Account</span>
                    </>
                  )}
                </button>

                {/* Footer options */}
                <div className="flex items-center justify-between text-xs pt-1 px-1 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(otpMode === "login" ? "login" : "register");
                      setOtpDigits(["", "", "", "", "", ""]);
                      setOtpCode("");
                    }}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to {otpMode === "login" ? "Login" : "Register"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isResending}
                    onClick={handleResendOtp}
                    className="text-orange-600 dark:text-orange-400 font-semibold hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5 cursor-pointer"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : resendCooldown > 0 ? (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Resend in {resendCooldown}s</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Resend Code</span>
                      </>
                    )}
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
