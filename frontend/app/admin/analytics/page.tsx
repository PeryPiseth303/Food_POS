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
  Sparkles
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
        <p className="text-xs text-muted-foreground font-semibold">Calculating sales metrics...</p>
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
      title: "Total Revenue",
      value: formatCurrency(data.total_revenue),
      subtext: `${data.total_orders} lifetime orders`,
      icon: DollarSign,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    {
      title: "Today's Sales",
      value: formatCurrency(data.today_revenue),
      subtext: `${data.today_orders} orders received today`,
      icon: TrendingUp,
      color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
    {
      title: "Average Order Value",
      value: formatCurrency(data.average_order_value),
      subtext: "Per table check",
      icon: ShoppingBag,
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      title: "Active Orders",
      value: data.active_orders_count.toString(),
      subtext: "In kitchen or pending",
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Sales & Dining Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time business performance, revenue trends, and popular menu items
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{card.title}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-foreground tracking-tight block">
                  {card.value}
                </span>
                <span className="text-[11px] text-muted-foreground">{card.subtext}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Sales Chart */}
        <div className="lg:col-span-2 bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground">Revenue Trend (Last 7 Days)</h3>
              <p className="text-[11px] text-muted-foreground">Daily gross order volume</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Past Week</span>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_sales}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
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
                    borderRadius: "12px",
                    fontSize: "12px"
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
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-orange-600" />
            <div>
              <h3 className="font-bold text-sm text-foreground">Top Selling Dishes</h3>
              <p className="text-[11px] text-muted-foreground">Highest volume items</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {data.top_selling_items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No sales data yet</p>
            ) : (
              data.top_selling_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border/60 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-extrabold flex items-center justify-center text-[11px] shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <h4 className="font-bold text-foreground truncate">{item.name}</h4>
                      <span className="text-[10px] text-muted-foreground">
                        {item.quantity_sold} portions ordered
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

      {/* Table Performance */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-600" />
          <div>
            <h3 className="font-bold text-sm text-foreground">Table Activity Breakdown</h3>
            <p className="text-[11px] text-muted-foreground">Dining tables with most orders</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {data.table_stats.map((t, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-secondary/40 border border-border text-center space-y-1"
            >
              <span className="text-xs font-bold text-muted-foreground">Table #{t.table_number}</span>
              <p className="text-base font-black text-foreground">{formatCurrency(t.total_spent)}</p>
              <span className="text-[10px] text-muted-foreground block">{t.order_count} orders</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
