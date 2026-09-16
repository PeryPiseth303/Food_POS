"use client";

import { useEffect, useState } from "react";
import { getSalesAnalytics } from "@/lib/api";
import { AnalyticsSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Clock,
  Award,
  Users,
  Loader2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  Utensils
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import { toast } from "sonner";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await getSalesAnalytics();
        setData(res);
      } catch (err) {
        toast.error("Failed to load analytics data");
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
        <p className="text-xs text-muted-foreground font-semibold">Calculating restaurant analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No analytics data available yet.</p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Gross Revenue",
      value: formatCurrency(data.total_revenue),
      subtext: `${data.total_orders} lifetime orders placed`,
      icon: DollarSign,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    {
      title: "Today's Revenue",
      value: formatCurrency(data.today_revenue),
      subtext: `${data.today_orders} orders received today`,
      icon: TrendingUp,
      color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    {
      title: "Average Check (AOV)",
      value: formatCurrency(data.average_order_value),
      subtext: "Average per table check",
      icon: ShoppingBag,
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      title: "Active Kitchen Orders",
      value: data.active_orders_count.toString(),
      subtext: "Currently cooking or queued",
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
  ];

  return (
    <div className="p-3.5 sm:p-6 space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
          Sales & Dining Analytics
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time business performance metrics, revenue trajectories, and top-performing dishes
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="modern-card rounded-2xl sm:rounded-3xl p-4 sm:p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{card.title}</span>
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center border shadow-2xs ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight block">
                  {card.value}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">{card.subtext}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts & Top Sellers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Daily Sales Chart */}
        <div className="lg:col-span-2 modern-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
                Daily Revenue Trajectory
              </h3>
              <p className="text-[11px] text-muted-foreground">7-day gross sales volume</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-xl border border-border/70">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              <span className="font-bold text-[11px]">Past 7 Days</span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_sales}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.7)" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "16px",
                    boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)",
                    fontSize: "12px",
                    fontWeight: 600
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total_sales"
                  stroke="#f97316"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#salesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="modern-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">Top Selling Dishes</h3>
              <p className="text-[11px] text-muted-foreground">Highest demand menu items</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {data.top_selling_items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No sales data logged yet</p>
            ) : (
              data.top_selling_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-secondary/40 border border-border/70 text-xs transition-all hover:border-orange-500/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-orange-600/10 text-orange-700 dark:text-orange-300 font-black flex items-center justify-center text-[10px] shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <h4 className="font-bold text-foreground truncate">{item.name}</h4>
                      <span className="text-[10px] text-muted-foreground">
                        {item.quantity_sold} sold
                      </span>
                    </div>
                  </div>

                  <span className="font-black text-foreground shrink-0 pl-2">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Table Activity Breakdown */}
      <div className="modern-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-foreground tracking-tight">
              Table Performance & Turnover
            </h3>
            <p className="text-[11px] text-muted-foreground">Sales by physical dining table</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {data.table_stats.map((t, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-secondary/40 border border-border/70 text-center space-y-1 transition-all hover:border-orange-500/30"
            >
              <span className="text-xs font-extrabold text-muted-foreground block">Table #{t.table_number}</span>
              <p className="text-base font-black text-orange-600 dark:text-orange-400">{formatCurrency(t.total_spent)}</p>
              <span className="text-[10px] text-muted-foreground block font-medium">{t.order_count} order{t.order_count !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
