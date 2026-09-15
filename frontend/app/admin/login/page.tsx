"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminLogin } from "@/lib/api";
import { Utensils, Lock, Mail, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@restaurant.com");
  const [password, setPassword] = useState("admin123");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await adminLogin(email, password);
      toast.success("Welcome back, Chef!");
      router.push("/admin/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail("admin@restaurant.com");
    setPassword("admin123");
    toast.info("Demo credentials loaded!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 via-background to-background dark:from-stone-950 dark:to-background text-foreground flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="outline" />
      </div>

      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Icon */}
        <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/30">
          <Utensils className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-black text-center tracking-tight text-foreground">Kitchen & Staff Portal</h1>
        <p className="text-xs text-muted-foreground text-center mt-1 mb-6">
          Sign in to manage live table orders, menu, and analytics
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Staff Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@restaurant.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Quick Demo Fill Button */}
          <button
            type="button"
            onClick={handleDemoFill}
            className="w-full py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 border border-border transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-orange-500" />
            <span>Use Demo Account (admin@restaurant.com)</span>
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 transition-transform active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                Sign In to Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border text-center">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-orange-600 transition-colors"
          >
            ← Back to Customer Menu Simulator
          </Link>
        </div>
      </div>
    </div>
  );
}
