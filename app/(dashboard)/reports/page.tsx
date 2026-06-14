"use client";

import { useEffect, useMemo, useState } from "react";
import * as invoicesService from "@/services/invoices";
import * as expensesService from "@/services/expenses";
import { useAppData } from "@/context/AppDataContext";
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
  BarChart,
  Bar,
} from "recharts";

export default function ReportsPage() {
  const { services, staff } = useAppData();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Date range — default to current month
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  );
  const [dateTo, setDateTo] = useState(
    now.toISOString().split("T")[0]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);

        const [invData, expData] = await Promise.all([
          invoicesService.getByDateRange(start, end),
          expensesService.getByDateRange(start, end),
        ]);
        setInvoices(invData);
        setExpenses(expData);
      } catch (err) {
        console.error("Failed to load reports data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFrom, dateTo]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getDateStr(inv: any): string {
    if (inv.date?.toDate) return inv.date.toDate().toISOString().split("T")[0];
    return inv.date || "";
  }

  function getPayment(inv: any) {
    return {
      cash:
        inv.paymentSplit?.cash ??
        inv.payments?.cash ??
        (inv.paymentMethod === "Cash" ? inv.grandTotal || 0 : 0),
      upi:
        inv.paymentSplit?.upi ??
        inv.payments?.upi ??
        (inv.paymentMethod === "UPI" ? inv.grandTotal || 0 : 0),
      card:
        inv.paymentSplit?.card ??
        inv.payments?.card ??
        (inv.paymentMethod === "Card" ? inv.grandTotal || 0 : 0),
    };
  }

  // ── Scoped invoices within date range ─────────────────────────────────────
  const scopedInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const d = getDateStr(inv);
        return d >= dateFrom && d <= dateTo;
      }),
    [invoices, dateFrom, dateTo]
  );

  const scopedExpenses = useMemo(
    () =>
      expenses.filter((exp) => exp.date >= dateFrom && exp.date <= dateTo),
    [expenses, dateFrom, dateTo]
  );

  const todayStr = now.toISOString().split("T")[0];
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let revenue = 0;
    let cashToday = 0, upiToday = 0, cardToday = 0;
    let cashMonthly = 0, upiMonthly = 0, cardMonthly = 0;

    scopedInvoices.forEach((inv) => {
      const { cash, upi, card } = getPayment(inv);
      revenue += cash + upi + card;

      const d = getDateStr(inv);
      if (d === todayStr) {
        cashToday += cash; upiToday += upi; cardToday += card;
      }
      const dt = new Date(d);
      if (dt.getMonth() === currentMonth && dt.getFullYear() === currentYear) {
        cashMonthly += cash; upiMonthly += upi; cardMonthly += card;
      }
    });

    const totalExpenses = scopedExpenses.reduce((s, e) => s + e.amount, 0);

    return {
      revenue,
      expenses: totalExpenses,
      profit: revenue - totalExpenses,
      cashToday, upiToday, cardToday,
      cashMonthly, upiMonthly, cardMonthly,
    };
  }, [scopedInvoices, scopedExpenses]);

  // ── 7-day chart ───────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) =>
      subDays(now, i).toISOString().split("T")[0]
    ).reverse();

    const map: Record<string, { revenue: number; expenses: number }> = {};
    days.forEach((d) => (map[d] = { revenue: 0, expenses: 0 }));

    invoices.forEach((inv) => {
      const d = getDateStr(inv);
      if (map[d]) {
        const { cash, upi, card } = getPayment(inv);
        map[d].revenue += cash + upi + card;
      }
    });
    expenses.forEach((exp) => {
      if (map[exp.date]) map[exp.date].expenses += exp.amount;
    });

    return days.map((d) => ({
      date: format(new Date(d), "MMM d"),
      Revenue: map[d].revenue,
      Expenses: map[d].expenses,
      Profit: map[d].revenue - map[d].expenses,
    }));
  }, [invoices, expenses]);

  // ── H(a): Revenue by service ──────────────────────────────────────────────
  const revenueByService = useMemo(() => {
    const map: Record<string, number> = {};
    scopedInvoices.forEach((inv) => {
      (inv.services || []).forEach((s: any) => {
        const name = s.serviceName || s.service || "Unknown";
        const amount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
        map[name] = (map[name] || 0) + amount;
      });
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [scopedInvoices]);

  // ── H(b): Revenue by staff ────────────────────────────────────────────────
  const revenueByStaff = useMemo(() => {
    const map: Record<string, number> = {};
    scopedInvoices.forEach((inv) => {
      (inv.services || []).forEach((s: any) => {
        const name = s.staffName || s.staff || "Unassigned";
        const amount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
        map[name] = (map[name] || 0) + amount;
      });
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [scopedInvoices]);

  // ── H(c): Top customers by spend ─────────────────────────────────────────
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; total: number; visits: number }> = {};
    scopedInvoices.forEach((inv) => {
      const key = inv.customerPhone || inv.customerMobile || inv.customerName;
      if (!key) return;
      if (!map[key]) map[key] = { name: inv.customerName, total: 0, visits: 0 };
      const { cash, upi, card } = getPayment(inv);
      map[key].total += cash + upi + card;
      map[key].visits += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [scopedInvoices]);

  // ── H(d): Membership vs Regular split ────────────────────────────────────
  const customerSplit = useMemo(() => {
    let membership = 0;
    let regular = 0;
    scopedInvoices.forEach((inv) => {
      const { cash, upi, card } = getPayment(inv);
      const total = cash + upi + card;
      if (inv.customerType === "membership") membership += total;
      else regular += total;
    });
    return { membership, regular };
  }, [scopedInvoices]);

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
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Intelligence
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Reports & Analytics
          </h1>
        </div>

        {/* I: Date range selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-stone-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-black"
          />
          <span className="text-xs text-stone-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-800 shadow-sm outline-none focus:border-black"
          />
        </div>
      </div>

      {reportsEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md max-w-4xl">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <BarChart3 size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Financial Records Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Generate invoices or log expenses to calculate profit curves.
          </p>
          <div className="flex gap-4 mt-6">
            <a
              href="/billing"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-800 transition"
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
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-sm font-bold">Total Revenue</span>
                <TrendingUp size={20} className="text-emerald-600" />
              </div>
              <p className="mt-3 text-3xl font-bold text-stone-900">
                {formatCurrency(totals.revenue)}
              </p>
              <p className="mt-1 text-xs text-stone-400">Within selected date range</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-sm font-bold">Operations Outflow</span>
                <TrendingDown size={20} className="text-red-500" />
              </div>
              <p className="mt-3 text-3xl font-bold text-stone-900">
                {formatCurrency(totals.expenses)}
              </p>
              <p className="mt-1 text-xs text-stone-400">Total operational expenses</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-700">
                <span className="text-sm font-bold">Net Profit</span>
                <DollarSign size={20} className="text-stone-900" />
              </div>
              <p className="mt-3 text-3xl font-bold text-stone-900">
                {formatCurrency(totals.profit)}
              </p>
              <p className="mt-1 text-xs text-stone-400">Revenue − Expenses</p>
            </div>
          </div>

          {/* Today's split */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Today's Split Collections</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Cash Today", value: totals.cashToday },
                { label: "UPI Today", value: totals.upiToday },
                { label: "Card Today", value: totals.cardToday },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                  <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">{label}</p>
                  <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Monthly split */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Monthly Split Collections</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Cash Monthly", value: totals.cashMonthly },
                { label: "UPI Monthly", value: totals.upiMonthly },
                { label: "Card Monthly", value: totals.cardMonthly },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                  <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">{label}</p>
                  <p className="mt-2 text-xl font-bold text-stone-900">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 7-day trend chart */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center gap-3 border-b border-stone-100 pb-4">
              <Calendar size={18} />
              <h2 className="text-lg font-bold text-stone-900">Daily Performance (Last 7 Days)</h2>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#000" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="date" stroke="#78716c" fontSize={12} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", borderColor: "#e5e5e5", borderRadius: "12px" }} />
                  <Area type="monotone" dataKey="Revenue" stroke="#000" fill="url(#gRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Profit" stroke="#10B981" fill="url(#gPro)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* H(a): Revenue by service */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Revenue by Service</h2>
            {revenueByService.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No service data in selected range.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByService} margin={{ top: 4, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                    <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                    <YAxis stroke="#78716c" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", borderColor: "#e5e5e5", borderRadius: "12px" }} formatter={(v: any) => formatCurrency(v)} />
                    <Bar dataKey="total" fill="#1c1917" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* H(b): Revenue by staff */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Revenue by Staff</h2>
            {revenueByStaff.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No staff data in selected range.</p>
            ) : (
              <div className="space-y-3">
                {revenueByStaff.map((s, i) => {
                  const max = revenueByStaff[0].total;
                  const pct = max > 0 ? Math.round((s.total / max) * 100) : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-stone-800">
                          {i + 1}. {s.name}
                        </span>
                        <span className="font-bold text-stone-900">{formatCurrency(s.total)}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-stone-800 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* H(c): Top customers */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Top Customers by Spend</h2>
            {topCustomers.length === 0 ? (
              <p className="text-sm text-stone-400 italic">No customer data in selected range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] border-collapse text-left text-sm text-stone-600">
                  <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3 font-bold">Rank</th>
                      <th className="px-4 py-3 font-bold">Customer</th>
                      <th className="px-4 py-3 font-bold">Visits</th>
                      <th className="px-4 py-3 font-bold text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {topCustomers.map((c, i) => (
                      <tr key={c.name} className="hover:bg-stone-50 transition">
                        <td className="px-4 py-3 font-bold text-stone-400">#{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-stone-900">{c.name}</td>
                        <td className="px-4 py-3 text-stone-600">{c.visits}</td>
                        <td className="px-4 py-3 font-bold text-stone-900 text-right">
                          {formatCurrency(c.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* H(d): Membership vs Regular split */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Membership vs Regular Revenue</h2>
            {customerSplit.membership === 0 && customerSplit.regular === 0 ? (
              <p className="text-sm text-stone-400 italic">No data in selected range.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Membership Customers", value: customerSplit.membership, color: "bg-stone-900" },
                  { label: "Regular Customers", value: customerSplit.regular, color: "bg-stone-300" },
                ].map(({ label, value, color }) => {
                  const grandTotal = customerSplit.membership + customerSplit.regular;
                  const pct = grandTotal > 0 ? Math.round((value / grandTotal) * 100) : 0;
                  return (
                    <div key={label} className="rounded-xl border border-stone-100 bg-stone-50 p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</p>
                      <p className="mt-2 text-2xl font-bold text-stone-900">{formatCurrency(value)}</p>
                      <div className="mt-3 w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-stone-500 font-medium">{pct}% of total revenue</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}