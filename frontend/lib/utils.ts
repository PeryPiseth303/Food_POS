import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, symbol: string = "$"): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export function getStatusInfo(status: string) {
  switch (status.toLowerCase()) {
    case "pending":
      return {
        label: "Pending",
        bg: "bg-amber-100 dark:bg-amber-950/50",
        text: "text-amber-800 dark:text-amber-300",
        border: "border-amber-300 dark:border-amber-700",
        dot: "bg-amber-500",
        step: 1
      };
    case "confirmed":
      return {
        label: "Confirmed",
        bg: "bg-blue-100 dark:bg-blue-950/50",
        text: "text-blue-800 dark:text-blue-300",
        border: "border-blue-300 dark:border-blue-700",
        dot: "bg-blue-500",
        step: 2
      };
    case "preparing":
      return {
        label: "In Kitchen",
        bg: "bg-orange-100 dark:bg-orange-950/50",
        text: "text-orange-800 dark:text-orange-300",
        border: "border-orange-300 dark:border-orange-700",
        dot: "bg-orange-500",
        step: 2
      };
    case "ready":
      return {
        label: "Ready to Serve",
        bg: "bg-emerald-100 dark:bg-emerald-950/50",
        text: "text-emerald-800 dark:text-emerald-300",
        border: "border-emerald-300 dark:border-emerald-700",
        dot: "bg-emerald-500",
        step: 3
      };
    case "served":
      return {
        label: "Served",
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-800 dark:text-slate-300",
        border: "border-slate-300 dark:border-slate-700",
        dot: "bg-slate-500",
        step: 4
      };
    case "cancelled":
      return {
        label: "Cancelled",
        bg: "bg-rose-100 dark:bg-rose-950/50",
        text: "text-rose-800 dark:text-rose-300",
        border: "border-rose-300 dark:border-rose-700",
        dot: "bg-rose-500",
        step: 0
      };
    default:
      return {
        label: status,
        bg: "bg-slate-100 dark:bg-slate-800",
        text: "text-slate-700 dark:text-slate-300",
        border: "border-slate-300 dark:border-slate-700",
        dot: "bg-slate-400",
        step: 1
      };
  }
}
