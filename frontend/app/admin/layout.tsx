"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChefHat,
  ClipboardList,
  UtensilsCrossed,
  QrCode,
  BarChart3,
  LogOut,
  Radio,
  Menu,
  X,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Bell,
  BellRing
} from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { StaffNotification } from "@/lib/types";
import { getStaffNotifications, resolveStaffNotification, clearAllNotifications } from "@/lib/api";
import StaffNotificationModal from "@/components/admin/StaffNotificationModal";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("Staff");
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  // Don't show admin sidebar if on login page
  const isLoginPage = pathname === "/admin/login";

  const fetchNotifs = async () => {
    try {
      const list = await getStaffNotifications();
      setNotifications(list);
    } catch {}
  };

  useEffect(() => {
    if (!isLoginPage) {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
      }
      const userStr = localStorage.getItem("admin_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          setUserEmail(u.email || u.user_name || "Staff");
        } catch {}
      }
      fetchNotifs();

      // Setup WebSocket connection to /api/v1/ws/admin for real-time staff calls
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const wsUrl = apiBase.replace(/^http/, "ws") + "/api/v1/ws/admin";

      let ws: WebSocket | null = null;
      let reconnectTimeout: any = null;

      const connectWs = () => {
        try {
          ws = new WebSocket(wsUrl);

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              const isCall = data.type === "staff_call" || data.event === "staff_call";
              const notif = data.notification || data.data;

              if (isCall && notif) {
                setNotifications((prev) => [
                  notif,
                  ...prev.filter((n) => n.id !== notif.id),
                ]);
              } else if (data.type === "staff_call_resolved" || data.event === "staff_call_resolved") {
                const resId = data.notification_id || data.data?.notification_id;
                if (resId) {
                  setNotifications((prev) =>
                    prev.map((n) =>
                      n.id === resId ? { ...n, status: "resolved" } : n
                    )
                  );
                }
              } else if (data.type === "staff_calls_cleared" || data.event === "staff_calls_cleared") {
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, status: "resolved" }))
                );
              }
            } catch {}
          };

          ws.onclose = () => {
            reconnectTimeout = setTimeout(connectWs, 3000);
          };
        } catch {
          reconnectTimeout = setTimeout(connectWs, 3000);
        }
      }

      connectWs();
      const interval = setInterval(fetchNotifs, 15000);

      return () => {
        clearInterval(interval);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (ws) ws.close();
      };
    }
  }, [pathname, isLoginPage, router]);

  const handleResolveNotif = async (id: number) => {
    try {
      const updated = await resolveStaffNotification(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
      toast.success(`Table #${updated.table_number} request marked as resolved.`);
    } catch {
      toast.error("Failed to resolve notification");
    }
  };

  const handleClearAllNotifs = async () => {
    try {
      await clearAllNotifications();
      setNotifications((prev) => prev.map((n) => ({ ...n, status: "resolved" })));
      toast.success("All active notifications marked as resolved.");
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    toast.success("Logged out successfully");
    router.push("/admin/login");
  };

  const navItems = [
    { label: "Live Orders", href: "/admin/dashboard", icon: ClipboardList },
    { label: "Menu Manager", href: "/admin/menu", icon: UtensilsCrossed },
    { label: "Tables & QR", href: "/admin/tables", icon: QrCode },
    { label: "Sales Analytics", href: "/admin/analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden border-b border-border/80 bg-card/95 backdrop-blur-xl px-4 h-16 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-foreground block leading-tight">
              Bistro Kitchen
            </span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time Admin</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Notification Bell Button */}
          <button
            type="button"
            onClick={() => setIsNotifOpen(true)}
            className="relative w-9 h-9 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center text-foreground border border-border transition-all active:scale-95"
            title="View Staff Notifications"
            aria-label="View Staff Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-sm">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <ThemeToggle variant="ghost" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground border border-border transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-in Drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-4/5 max-w-xs bg-card h-full border-r border-border p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <span className="font-black text-sm tracking-tight">Kitchen Portal</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Notifications shortcut in mobile drawer */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsNotifOpen(true);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20 active:scale-95 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <BellRing className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Staff Calls & Alerts</span>
                </div>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                    {unreadCount} Active
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-medium">0 active</span>
                )}
              </button>

              {/* Navigation Items */}
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-500/25"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-border/70 space-y-3 pb-safe">
              <div className="flex items-center justify-between px-2">
                <div className="truncate">
                  <p className="text-xs font-bold text-foreground truncate">{userEmail}</p>
                  <p className="text-[10px] text-muted-foreground">Admin Access</p>
                </div>
                <ThemeToggle variant="ghost" />
              </div>

              <Link
                href="/"
                target="_blank"
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-xs font-bold text-foreground border border-border/70 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-orange-600" />
                  <span>Customer Menu</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 border border-rose-500/20 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card p-5 flex-col justify-between shrink-0 sticky top-0 h-screen">
        <div className="space-y-6">
          {/* Brand & Notification Bell */}
          <div className="flex items-center justify-between gap-2.5 px-2 pt-1 pb-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-sm tracking-tight text-foreground leading-tight truncate">
                  Bistro Kitchen
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-semibold text-muted-foreground truncate">Live WebSockets</span>
                </div>
              </div>
            </div>

            {/* Desktop Notification Bell Button */}
            <button
              type="button"
              onClick={() => setIsNotifOpen(true)}
              className="relative w-9 h-9 rounded-xl bg-secondary/80 hover:bg-secondary flex items-center justify-center text-foreground border border-border/80 transition-all active:scale-95 group shrink-0"
              title="View Staff Notifications"
              aria-label="View Staff Notifications"
            >
              <Bell className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse shadow-md shadow-rose-600/30">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-500/25 scale-[1.02]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Settings */}
        <div className="space-y-3.5 pt-4 border-t border-border/80">
          <div className="flex items-center justify-between px-2">
            <div className="truncate">
              <p className="text-xs font-bold truncate text-foreground">{userEmail}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>Kitchen Admin</span>
              </p>
            </div>
            <ThemeToggle variant="ghost" />
          </div>

          <div className="space-y-1.5">
            <Link
              href="/"
              target="_blank"
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent hover:border-border transition-all"
            >
              <div className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-orange-500" />
                <span>Customer View</span>
              </div>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all text-left"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Page Body */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>

      {/* Staff Call Notifications Modal / Drawer */}
      <StaffNotificationModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        onResolve={handleResolveNotif}
        onClearAll={handleClearAllNotifs}
        isLoading={isLoadingNotifs}
      />
    </div>
  );
}

