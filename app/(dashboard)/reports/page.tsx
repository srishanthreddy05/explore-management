"use client";

import { useEffect, useState } from "react";
import * as invoicesService from "@/services/invoices";
import * as expensesService from "@/services/expenses";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { format, subDays } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    revenue: 0,
    expenses: 0,
    profit: 0,
    cashToday: 0,
    upiToday: 0,
    cardToday: 0,
    cashMonthly: 0,
    upiMonthly: 0,
    cardMonthly: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    async function loadReportsData() {
      try {
        const invoices = await invoicesService.getAll();
        const expenses = await expensesService.getAll();

        const todayStr = new Date().toISOString().split("T")[0];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let totalRevenue = 0;
        let cashToday = 0;
        let upiToday = 0;
        let cardToday = 0;
        let cashMonthly = 0;
        let upiMonthly = 0;
        let cardMonthly = 0;

        invoices.forEach((inv) => {
          const cash = inv.payments?.cash ?? (inv.paymentMethod === "Cash" ? (inv.grandTotal || 0) : 0);
          const upi = inv.payments?.upi ?? (inv.paymentMethod === "UPI" ? (inv.grandTotal || 0) : 0);
          const card = inv.payments?.card ?? (inv.paymentMethod === "Card" ? (inv.grandTotal || 0) : 0);
          const totalPaid = cash + upi + card;

          totalRevenue += totalPaid;

          const isToday = inv.date === todayStr;

          const invDate = new Date(inv.date);
          const isThisMonth = invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;

          if (isToday) {
            cashToday += cash;
            upiToday += upi;
            cardToday += card;
          }

          if (isThisMonth) {
            cashMonthly += cash;
            upiMonthly += upi;
            cardMonthly += card;
          }
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        setTotals({
          revenue: totalRevenue,
          expenses: totalExpenses,
          profit: totalRevenue - totalExpenses,
          cashToday,
          upiToday,
          cardToday,
          cashMonthly,
          upiMonthly,
          cardMonthly,
        });

        const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
          const d = subDays(new Date(), i);
          return d.toISOString().split("T")[0];
        }).reverse();

        const chartMap = last7DaysDates.reduce((acc, date) => {
          acc[date] = { date, revenue: 0, expenses: 0 };
          return acc;
        }, {} as Record<string, { date: string; revenue: number; expenses: number }>);

        invoices.forEach((inv) => {
          if (chartMap[inv.date]) {
            const cash = inv.payments?.cash ?? (inv.paymentMethod === "Cash" ? (inv.grandTotal || 0) : 0);
            const upi = inv.payments?.upi ?? (inv.paymentMethod === "UPI" ? (inv.grandTotal || 0) : 0);
            const card = inv.payments?.card ?? (inv.paymentMethod === "Card" ? (inv.grandTotal || 0) : 0);
            chartMap[inv.date].revenue += (cash + upi + card);
          }
        });

        expenses.forEach((exp) => {
          if (chartMap[exp.date]) {
            chartMap[exp.date].expenses += exp.amount;
          }
        });

        const formattedChartData = last7DaysDates.map((date) => ({
          date: format(new Date(date), "MMM d"),
          Revenue: chartMap[date].revenue,
          Expenses: chartMap[date].expenses,
          Profit: chartMap[date].revenue - chartMap[date].expenses,
        }));

        setChartData(formattedChartData);
      } catch (error) {
        console.error("Failed to load reports data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  const reportsEmpty = totals.revenue === 0 && totals.expenses === 0;

  return (
    <div className="space-y-6 text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Reports & Analytics
          </h1>
        </div>
      </div>

      {reportsEmpty ? (
        // Empty State
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md max-w-4xl">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <BarChart3 size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Financial Records Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Generate invoices in billing or log expenses in tracker to calculate profit curves.
          </p>
          <div className="flex gap-4 mt-6">
            <a
              href="/billing"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-850 transition"
            >
              Generate Bill
            </a>
            <a
              href="/expenses"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 px-6 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
            >
              Log Expense
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-sm font-bold">Total Revenue</span>
                <TrendingUp size={20} className="text-emerald-600" />
              </div>
              <p className="mt-3 text-3xl font-bold text-stone-900">{formatCurrency(totals.revenue)}</p>
              <p className="mt-1 text-xs text-stone-400">Total collected cash & bank receipts</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-sm font-bold">Operations Outflow</span>
                <TrendingDown size={20} className="text-red-500" />
              </div>
              <p className="mt-3 text-3xl font-bold text-stone-900">{formatCurrency(totals.expenses)}</p>
              <p className="mt-1 text-xs text-stone-400">Total operational business expenses</p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm bg-stone-50/50">
              <div className="flex items-center justify-between text-stone-700">
                <span className="text-sm font-bold">Net Profit</span>
                <DollarSign size={20} className="text-stone-900" />
              </div>
              <p className="mt-3 text-3xl font-bold text-stone-900">{formatCurrency(totals.profit)}</p>
              <p className="mt-1 text-xs text-stone-400">Earnings (Revenue - Expenses)</p>
            </div>
          </div>

          {/* Today's Collections Section */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Today's Split Collections</h2>
              <p className="text-xs text-stone-400">Daily breakdown by payment method</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-4">
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Cash Today</p>
                <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(totals.cashToday)}</p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-4">
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">UPI Today</p>
                <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(totals.upiToday)}</p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-4">
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Card Today</p>
                <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(totals.cardToday)}</p>
              </div>
            </div>
          </section>

          {/* Monthly Collections Section */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Monthly Split Collections</h2>
              <p className="text-xs text-stone-400">Current month total breakdown by payment method</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-4">
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Cash Monthly</p>
                <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(totals.cashMonthly)}</p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-4">
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">UPI Monthly</p>
                <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(totals.upiMonthly)}</p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50/40 p-4">
                <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Card Monthly</p>
                <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(totals.cardMonthly)}</p>
              </div>
            </div>
          </section>

          {/* Area Chart visualization */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md">
            <div className="mb-6 flex items-center gap-3 border-b border-stone-100 pb-4 text-stone-900">
              <Calendar size={18} />
              <h2 className="text-lg font-bold text-stone-900">Daily Performance (Last 7 Days)</h2>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" stroke="#78716c" fontSize={12} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#e5e5e5",
                      borderRadius: "12px",
                      color: "#1c1917",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Revenue"
                    stroke="#000000"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Profit"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorProfit)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
