"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import * as staffService from "@/services/staff";
import { formatCurrency } from "@/components/salon-dashboard/types";
import type { Staff } from "@/types/staff";
import { useAppData } from "@/context/AppDataContext";
import { CalendarDays, CreditCard, TrendingUp } from "lucide-react";
import Link from "next/link";
import { BillingTerminal } from "@/components/billing/BillingTerminal";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { AddExpenseModal } from "@/components/expenses/AddExpenseModal";

// ── D: Active time helper ──────────────────────────────────────────────────
function computeTodayActiveTime(clockLogs: any[] = []): string {
  if (!clockLogs || clockLogs.length === 0) return "0 mins";

  const getLocalDateKey = (d: Date) => {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };

  const today = new Date();
  const todayKey = getLocalDateKey(today);

  // 1. Parse and sort all logs by time ascending
  const parsedLogs = clockLogs
    .map((log) => {
      let dateObj: Date;
      if (log.timestamp && typeof log.timestamp.toDate === "function") {
        dateObj = log.timestamp.toDate();
      } else if (log.timestamp && typeof log.timestamp.seconds === "number") {
        dateObj = new Date(log.timestamp.seconds * 1000);
      } else {
        dateObj = new Date(log.timestamp || 0);
      }
      return {
        event: log.event as "clockIn" | "clockOut",
        date: dateObj,
        time: dateObj.getTime(),
      };
    })
    .sort((a, b) => a.time - b.time);

  // 2. Build sessions from logs
  interface Session {
    clockIn: typeof parsedLogs[0];
    clockOut: typeof parsedLogs[0] | null;
  }
  const sessions: Session[] = [];
  let currentSessionStart: typeof parsedLogs[0] | null = null;

  for (const log of parsedLogs) {
    if (log.event === "clockIn") {
      if (currentSessionStart) {
        sessions.push({ clockIn: currentSessionStart, clockOut: null });
      }
      currentSessionStart = log;
    } else if (log.event === "clockOut") {
      if (currentSessionStart) {
        sessions.push({ clockIn: currentSessionStart, clockOut: log });
        currentSessionStart = null;
      }
    }
  }
  if (currentSessionStart) {
    sessions.push({ clockIn: currentSessionStart, clockOut: null });
  }

  // 3. Filter sessions where clockIn occurs on today's calendar date
  const todaySessions = sessions.filter((session) => {
    return getLocalDateKey(session.clockIn.date) === todayKey;
  });

  // 4. Calculate total duration
  let totalMs = 0;
  for (const session of todaySessions) {
    if (session.clockOut) {
      totalMs += session.clockOut.time - session.clockIn.time;
    } else {
      totalMs += Date.now() - session.clockIn.time;
    }
  }

  const mins = Math.floor(totalMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} hrs ${m} mins` : `${mins} mins`;
}

export default function DashboardPage() {
  const { staff, loadingAppData } = useAppData();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const staffLoaded = !loadingAppData;
  const [tick, setTick] = useState(0);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  useEffect(() => {
    if (isBillingOpen || isCustomerOpen || isExpenseOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isBillingOpen, isCustomerOpen, isExpenseOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const staffWithActiveTimes = useMemo(() => {
    return staff.map((member) => ({
      ...member,
      activeTime: computeTodayActiveTime(member.clockLogs),
    }));
  }, [staff, tick]);

  useEffect(() => {
    // ── A: Scope query to current month only ──────────────────────────────
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const qInvoices = query(
      collection(db, "invoices"),
      where("date", ">=", Timestamp.fromDate(startOfMonth))
    );

    const unsubInvoices = onSnapshot(
      qInvoices,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setInvoices(list);
        setInvoicesLoaded(true);
      },
      (err) => console.error("Invoices listener error:", err)
    );

    return () => {
      unsubInvoices();
    };
  }, []);

  // ── C: Clock log on duty toggle ─────────────────────────────────────────
  const toggleDutyStatus = async (member: Staff) => {
    if (!member.id) return;
    const current = member.dutyStatus || "offDuty";
    const next = current === "onDuty" ? "offDuty" : "onDuty";
    const logEvent = next === "onDuty" ? "clockIn" : "clockOut";
    try {
      await staffService.update(member.id, {
        dutyStatus: next,
        clockLogs: arrayUnion({
          event: logEvent,
          timestamp: Timestamp.now(),
        }) as any,
      });
    } catch (err) {
      console.error("Failed to update duty status:", err);
    }
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayRevenue = 0;
    let monthlyRevenue = 0;
    let todayVisits = 0;
    let cashToday = 0;
    let upiToday = 0;
    let cardToday = 0;

    invoices.forEach((inv) => {
      const cash =
        inv.paymentSplit?.cash ??
        inv.payments?.cash ??
        (inv.paymentMethod === "Cash" ? inv.grandTotal || 0 : 0);
      const upi =
        inv.paymentSplit?.upi ??
        inv.payments?.upi ??
        (inv.paymentMethod === "UPI" ? inv.grandTotal || 0 : 0);
      const card =
        inv.paymentSplit?.card ??
        inv.payments?.card ??
        (inv.paymentMethod === "Card" ? inv.grandTotal || 0 : 0);

      const invDateStr =
        inv.date instanceof Timestamp
          ? inv.date.toDate().toISOString().split("T")[0]
          : inv.date;

      if (invDateStr === todayStr) {
        todayRevenue += cash + upi + card;
        todayVisits += 1;
        cashToday += cash;
        upiToday += upi;
        cardToday += card;
      }

      const invDate =
        inv.date instanceof Timestamp ? inv.date.toDate() : new Date(inv.date);
      if (
        invDate.getMonth() === currentMonth &&
        invDate.getFullYear() === currentYear
      ) {
        monthlyRevenue += cash + upi + card;
      }
    });

    return {
      todayRevenue,
      monthlyRevenue,
      todayVisits,
      cashToday,
      upiToday,
      cardToday,
      onDutyCount: staff.filter((s) => s.dutyStatus === "onDuty").length,
    };
  }, [invoices, staff]);

  // ── B: Today's invoices sorted newest first by creation time ────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const todayInvoices = invoices
    .filter((inv) => {
      const d =
        inv.date instanceof Timestamp
          ? inv.date.toDate().toISOString().split("T")[0]
          : inv.date;
      return d === todayStr;
    })
    .sort((a, b) => {
      const aTime =
        a.createdAt && typeof a.createdAt.toDate === "function"
          ? a.createdAt.seconds
          : a.date instanceof Timestamp
          ? a.date.seconds
          : 0;
      const bTime =
        b.createdAt && typeof b.createdAt.toDate === "function"
          ? b.createdAt.seconds
          : b.date instanceof Timestamp
          ? b.date.seconds
          : 0;
      return bTime - aTime;
    });

  if (!(invoicesLoaded && staffLoaded)) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Analytics
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Dashboard Overview
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1.2fr]">
        {/* Left — stats + quick actions */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* Today's Collection */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-sm font-bold">Today's Collection</span>
                <TrendingUp size={20} className="opacity-80 text-stone-600" />
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {formatCurrency(stats.todayRevenue)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-center">
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Cash</p>
                  <p className="text-xs font-bold text-stone-900">{formatCurrency(stats.cashToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">UPI</p>
                  <p className="text-xs font-bold text-stone-900">{formatCurrency(stats.upiToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Card</p>
                  <p className="text-xs font-bold text-stone-900">{formatCurrency(stats.cardToday)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Revenue */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-stone-500">
                  <span className="text-sm font-bold">Monthly Revenue</span>
                  <CreditCard size={20} className="opacity-80 text-stone-600" />
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                  {formatCurrency(stats.monthlyRevenue)}
                </p>
              </div>
              <p className="mt-2 text-xs text-stone-400">Sales in current month</p>
            </div>

            {/* Today's Visits */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-stone-500">
                  <span className="text-sm font-bold">Today's Visits</span>
                  <CalendarDays size={20} className="opacity-80 text-stone-600" />
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                  {stats.todayVisits}
                </p>
              </div>
              <p className="mt-2 text-xs text-stone-400">Customers served today</p>
            </div>
          </div>

          {/* Quick Actions */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => setIsBillingOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-800 transition shadow-sm cursor-pointer"
              >
                Open Billing Terminal
              </button>
              <button
                type="button"
                onClick={() => setIsCustomerOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-900 hover:bg-stone-50 transition shadow-sm cursor-pointer"
              >
                Add Customer
              </button>
              <button
                type="button"
                onClick={() => setIsExpenseOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-900 hover:bg-stone-50 transition shadow-sm cursor-pointer"
              >
                Add Expense
              </button>
              <Link
                href="/staff"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-900 hover:bg-stone-50 transition shadow-sm"
              >
                Manage Staff
              </Link>
            </div>
          </section>
        </div>

        {/* ── E: Right — horizontal staff cards ─────────────────────────── */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-stone-900">Stylists Floor Board</h2>
            <p className="text-xs text-stone-400">Real-time status and floor hours today</p>
          </div>
          {staff.length === 0 ? (
            <p className="text-xs text-stone-400 italic">No registered staff found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {staffWithActiveTimes.map((member) => {
                const isOnDuty = member.dutyStatus === "onDuty";
                const activeTime = member.activeTime;
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-stone-200 bg-stone-50 p-4 flex flex-col justify-between hover:border-stone-400 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-900 text-sm">
                          {member.name}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${isOnDuty
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-stone-100 text-stone-600 border-stone-300"
                            }`}
                        >
                          {isOnDuty ? "On Duty" : "Off Duty"}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">{member.role}</p>
                      <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2 text-xs">
                        <span className="text-stone-500">Active today</span>
                        <span className="font-bold text-stone-900">{activeTime}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDutyStatus(member)}
                      className={`mt-3 h-8 w-full rounded-xl text-xs font-bold text-white transition ${isOnDuty
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                    >
                      {isOnDuty ? "Go Off Duty" : "Go On Duty"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── B: Today's invoices list ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-stone-900">Today's Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm text-stone-600">
            <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 font-bold">Invoice #</th>
                <th className="px-4 py-3 font-bold">Customer</th>
                <th className="px-4 py-3 font-bold">Staff</th>
                <th className="px-4 py-3 font-bold">Time</th>
                <th className="px-4 py-3 font-bold text-right">Amount</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {todayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400 italic">
                    No bills recorded today.
                  </td>
                </tr>
              ) : (
                todayInvoices.map((inv) => {
                  const staffListStr = Array.from(
                    new Set(
                      (inv.services || [])
                        .map((s: any) => s.staffName || s.staff)
                        .filter(Boolean)
                    )
                  ).join(", ");

                  const timeSource =
                    inv.createdAt && typeof inv.createdAt.toDate === "function"
                      ? inv.createdAt
                      : inv.date;
                  const time =
                    timeSource && typeof timeSource.toDate === "function"
                      ? timeSource
                        .toDate()
                        .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "—";
                  return (
                    <tr key={inv.id} className="hover:bg-stone-50 transition">
                      <td className="px-4 py-3 font-bold text-stone-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-800">
                        {inv.customerName}
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {staffListStr || (
                          <span className="italic text-stone-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500">{time}</td>
                      <td className="px-4 py-3 font-bold text-stone-900 text-right">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 hover:text-black hover:border-black transition"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isBillingOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 md:p-10 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsBillingOpen(false)}
        >
          <div 
            className="relative w-full max-w-7xl bg-[#F5F5F5] rounded-3xl border border-stone-200 shadow-2xl p-4 sm:p-6 md:p-8 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <BillingTerminal
              onClose={() => setIsBillingOpen(false)}
            />
          </div>
        </div>
      )}

      {isCustomerOpen && (
        <AddCustomerModal
          onClose={() => setIsCustomerOpen(false)}
          onSuccess={() => setIsCustomerOpen(false)}
        />
      )}

      {isExpenseOpen && (
        <AddExpenseModal
          onClose={() => setIsExpenseOpen(false)}
          onSuccess={() => setIsExpenseOpen(false)}
        />
      )}
    </div>
  );
}