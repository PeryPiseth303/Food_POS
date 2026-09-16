"use client";

import { useState } from "react";
import { StaffNotification } from "@/lib/types";
import { formatTime, formatDate } from "@/lib/utils";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
  Utensils,
  Check
} from "lucide-react";

interface StaffNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: StaffNotification[];
  onResolve: (id: number) => Promise<void>;
  onClearAll: () => Promise<void>;
  isLoading?: boolean;
}

export default function StaffNotificationModal({
  isOpen,
  onClose,
  notifications,
  onResolve,
  onClearAll,
  isLoading = false,
}: StaffNotificationModalProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "resolved">("all");
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return n.status === "unread";
    if (filter === "resolved") return n.status === "resolved";
    return true;
  });

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    try {
      await onResolve(id);
    } finally {
      setResolvingId(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await onClearAll();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card h-full border-l border-border shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/70 bg-secondary/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white flex items-center justify-center shadow-md shadow-rose-600/25 shrink-0">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-foreground flex items-center gap-2">
                  <span>Staff Calls & Alerts</span>
                  {unreadCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                      {unreadCount} Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      All Clear
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Real-time waiter calls from dining tables
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Bar & Clear Actions */}
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
            <div className="flex p-0.5 bg-secondary/60 rounded-xl border border-border/80 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filter === "all"
                    ? "bg-card text-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filter === "unread"
                    ? "bg-card text-rose-600 dark:text-rose-400 shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Active ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter("resolved")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filter === "resolved"
                    ? "bg-card text-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Done
              </button>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className="text-[11px] font-bold text-muted-foreground hover:text-rose-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10"
              >
                <Check className="w-3 h-3" />
                <span>{isClearing ? "Resolving..." : "Resolve All"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
          {filteredNotifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="font-extrabold text-sm text-foreground">
                {filter === "unread" ? "No active staff calls" : "No notifications"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {filter === "unread"
                  ? "All dining tables have been serviced! New requests will appear here instantly."
                  : "Customer calls and table requests will be logged here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUnread = notif.status === "unread";
              return (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isUnread
                      ? "bg-gradient-to-r from-rose-500/10 via-red-500/5 to-orange-500/5 border-rose-500/30 shadow-xs"
                      : "bg-secondary/30 border-border/70 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                          isUnread
                            ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30 animate-pulse"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <Utensils className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-foreground">
                            Table #{notif.table_number}
                          </span>
                          {isUnread ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                              Needs Staff
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold">
                              <Check className="w-2.5 h-2.5 text-emerald-500" />
                              Resolved
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-foreground/90 mt-1 font-medium leading-relaxed">
                          {notif.message}
                        </p>

                        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(notif.created_at)}</span>
                          <span>•</span>
                          <span>{formatDate(notif.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resolve Button */}
                    {isUnread && (
                      <button
                        type="button"
                        disabled={resolvingId === notif.id}
                        onClick={() => handleResolve(notif.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                        title="Mark as serviced"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{resolvingId === notif.id ? "..." : "Done"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border/60 bg-secondary/20 text-center">
          <p className="text-[11px] text-muted-foreground">
            Notifications update automatically in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
