"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminLogin } from "@/lib/api";
import { Lock, Mail, ArrowRight, Loader2, ChefHat, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your admin email address.");
      return;
    }
    if (!password) {
      toast.error("Please enter your admin password.");
      return;
    }
    setIsLoading(true);
    try {
      await adminLogin(email.trim().toLowerCase(), password);
      toast.success("Welcome back, Administrator!");
      router.push("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Invalid administrator credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500/5 via-background to-background dark:from-stone-950 dark:to-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="absolute top-4 right-4">
        <ThemeToggle variant="outline" />
      </div>

      <div className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 animate-in zoom-in-95 duration-200">
        {/* Brand Icon */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/25">
          <ChefHat className="w-6 h-6" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-center tracking-tight text-foreground">
          Restaurant Admin Portal
        </h1>
        <p className="text-xs text-muted-foreground text-center mt-1 mb-6">
          Sign in to manage live orders, catalog, tables, and analytics
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-input text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-input text-foreground text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] disabled:opacity-50 mt-3 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border/70 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-muted-foreground hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            ← Return to Customer Ordering View
          </Link>
        </div>
      </div>
    </div>
  );
}
