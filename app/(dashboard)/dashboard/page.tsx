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
  doc,
  getDoc,
} from "firebase/firestore";
import * as staffService from "@/services/staff";
import { formatCurrency } from "@/components/salon-dashboard/types";
import type { Staff } from "@/types/staff";
import { useAppData } from "@/context/AppDataContext";
import { CalendarDays, CreditCard, TrendingUp, ShieldCheck, Users, Receipt, BarChart2, UsersRound, UserPlus, PiggyBank } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { BillingTerminal } from "@/components/billing/BillingTerminal";
import { AddCustomerModal } from "@/components/customers/AddCustomerModal";
import { AddExpenseModal } from "@/components/expenses/AddExpenseModal";
import * as customerService from "@/services/customers";
import { toLocalDateString } from "@/lib/utils/date";


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
  const [isSettlementsOpen, setIsSettlementsOpen] = useState(false);

  useEffect(() => {
    const anyOpen = isBillingOpen || isCustomerOpen || isExpenseOpen || isSettlementsOpen;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isBillingOpen, isCustomerOpen, isExpenseOpen, isSettlementsOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Revert expired memberships and record alerts in DB on mount
    customerService.checkAndExpireMemberships();
  }, []);

  const staffWithActiveTimes = useMemo(() => {
    return staff.map((member) => ({
      ...member,
      activeTime: computeTodayActiveTime(member.clockLogs),
    }));
  }, [staff, tick]);

  const [monthlyStats, setMonthlyStats] = useState<{ totalRevenue: number; totalVisits: number } | null>(null);
  const [staffMonthlyStats, setStaffMonthlyStats] = useState<Record<string, { revenue: number; productCost: number }>>({});

  const fetchMonthlyStats = async (force = false) => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;

      const cacheKey = `monthlyStats_${monthKey}`;
      if (!force) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, expiry } = JSON.parse(cached);
          if (Date.now() < expiry) {
            setMonthlyStats(data);
            return;
          }
        }
      }

      const docRef = doc(db, "stats", `revenue_${monthKey}`);
      const snap = await getDoc(docRef);
      let data = { totalRevenue: 0, totalVisits: 0 };
      if (snap.exists()) {
        const d = snap.data();
        data = {
          totalRevenue: d.totalRevenue ?? 0,
          totalVisits: d.totalVisits ?? 0,
        };
      }
      setMonthlyStats(data);
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        expiry: Date.now() + 60000,
      }));
    } catch (err) {
      console.error("Failed to fetch monthly stats:", err);
    }
  };

  const fetchStaffMonthlyStats = async (force = false) => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;

      const cacheKey = `staffMonthlyStats_${monthKey}`;
      if (!force) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, expiry } = JSON.parse(cached);
          if (Date.now() < expiry) {
            setStaffMonthlyStats(data);
            return;
          }
        }
      }

      const map: Record<string, { revenue: number; productCost: number }> = {};
      await Promise.all(
        staff.map(async (member) => {
          if (!member.id) return;
          const ref = doc(db, "stats", `staff_${member.id}_${monthKey}`);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const d = snap.data();
            map[member.id] = {
              revenue: d.revenue ?? 0,
              productCost: d.productCost ?? 0,
            };
          } else {
            map[member.id] = { revenue: 0, productCost: 0 };
          }
        })
      );
      setStaffMonthlyStats(map);
      localStorage.setItem(cacheKey, JSON.stringify({
        data: map,
        expiry: Date.now() + 60000,
      }));
    } catch (err) {
      console.error("Failed to fetch staff monthly stats:", err);
    }
  };

  useEffect(() => {
    // ── A: Scope query to today's invoices only ──────────────────────────────
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const qInvoices = query(
      collection(db, "invoices"),
      where("date", ">=", Timestamp.fromDate(startOfToday))
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

  // Fetch monthly stats on mount (using cache)
  useEffect(() => {
    if (invoicesLoaded && staffLoaded) {
      fetchMonthlyStats();
      fetchStaffMonthlyStats();
    }
  }, [invoicesLoaded, staffLoaded]);

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

      // Explicitly invalidate cache and fetch fresh stats on duty status change
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;
      localStorage.removeItem(`staffMonthlyStats_${monthKey}`);
      await fetchStaffMonthlyStats(true);
    } catch (err) {
      console.error("Failed to update duty status:", err);
    }
  };

  const stats = useMemo(() => {
    const todayStr = toLocalDateString(new Date());

    let todayRevenue = 0;
    let cashToday = 0;
    let upiToday = 0;
    let cardToday = 0;
    const uniqueCustomerIds = new Set<string>();

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

      const invDateStr = inv.dateKey || toLocalDateString(inv.date);

      if (invDateStr === todayStr) {
        todayRevenue += cash + upi + card;

        const customerIdentifier = inv.customerId || inv.customerPhone || inv.customerName;
        if (customerIdentifier) {
          uniqueCustomerIds.add(customerIdentifier);
        } else {
          uniqueCustomerIds.add(inv.id || Math.random().toString());
        }

        cashToday += cash;
        upiToday += upi;
        cardToday += card;
      }
    });

    return {
      todayRevenue,
      monthlyRevenue: monthlyStats?.totalRevenue ?? 0,
      todayVisits: uniqueCustomerIds.size,
      cashToday,
      upiToday,
      cardToday,
      onDutyCount: staff.filter((s) => s.dutyStatus === "onDuty").length,
    };
  }, [invoices, staff, monthlyStats]);

  // ── B: Today's invoices sorted newest first by creation time ────────────
  const todayStr = toLocalDateString(new Date());
  const todayInvoices = invoices
    .filter((inv) => {
      const d = inv.dateKey || toLocalDateString(inv.date);
      return d === todayStr;
    })
    .sort((a, b) => {
      const dateA = a.invoiceDate || a.date;
      const dateB = b.invoiceDate || b.date;
      const timeA = dateA && typeof dateA.toMillis === "function" ? dateA.toMillis() : (dateA instanceof Date ? dateA.getTime() : 0);
      const timeB = dateB && typeof dateB.toMillis === "function" ? dateB.toMillis() : (dateB instanceof Date ? dateB.getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;

      const createdA = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
      const createdB = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
      return createdB - createdA;
    });

  // Calculate today's settlements split details for the overlay
  const todaySettlement = useMemo(() => {
    const dayObj = {
      totalServiceRevenue: 0,
      totalMembershipAmount: 0,
      totalProductCost: 0,
      totalStaffShare: 0,
      totalOwnerShare: 0,
      ownerDirectRevenue: 0,
      staffRevenueContribution: 0,
      staffProductReimbursement: 0,
      retailProductsRevenue: 0,
      staffDetails: {} as Record<
        string,
        {
          staffId: string;
          name: string;
          role: string;
          serviceRevenue: number;
          productCost: number;
          staffShare: number;
          ownerShareContribution: number;
        }
      >,
    };

    todayInvoices.forEach((inv) => {
      const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;

      (inv.products || []).forEach((p: any) => {
        const productBaseAmount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
        const amount = productBaseAmount * discountFactor;
        dayObj.retailProductsRevenue += amount;
        dayObj.totalOwnerShare += amount;
      });

      (inv.services || []).forEach((s: any) => {
        const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
        const amount = serviceBaseAmount * discountFactor;
        const cost = s.usedProductCost || 0;
        const staffId = s.staffId || "unassigned";
        const staffName = s.staffName || "Unassigned";

        const staffMember = staff.find((st) => st.id === staffId || st.name === staffName);
        const role = staffMember?.role || "Stylist";

        // Check if this is a membership invoice
        if (s.serviceId === "membership_fee" || staffId === "system" || staffName === "System") {
          dayObj.totalMembershipAmount += amount;
          dayObj.totalOwnerShare += amount;
          return;
        }

        // Regular service: Owner vs Stylist
        if (role === "Owner") {
          dayObj.ownerDirectRevenue += amount;
          dayObj.totalServiceRevenue += amount;
          dayObj.totalOwnerShare += amount;

          const staffKey = staffId !== "unassigned" ? staffId : staffName;
          if (!dayObj.staffDetails[staffKey]) {
            dayObj.staffDetails[staffKey] = {
              staffId,
              name: staffName,
              role,
              serviceRevenue: 0,
              productCost: 0,
              staffShare: 0,
              ownerShareContribution: 0,
            };
          }
          const sd = dayObj.staffDetails[staffKey];
          sd.serviceRevenue += amount;
          sd.productCost += cost;
          sd.ownerShareContribution += amount;
        } else {
          // Regular stylist
          const staffShare = 0.5 * amount - cost;
          const ownerShare = 0.5 * amount + cost;

          dayObj.totalServiceRevenue += amount;
          dayObj.totalProductCost += cost;
          dayObj.totalStaffShare += staffShare;
          dayObj.totalOwnerShare += ownerShare;

          dayObj.staffRevenueContribution += 0.5 * amount;
          dayObj.staffProductReimbursement += cost;

          const staffKey = staffId !== "unassigned" ? staffId : staffName;
          if (!dayObj.staffDetails[staffKey]) {
            dayObj.staffDetails[staffKey] = {
              staffId,
              name: staffName,
              role,
              serviceRevenue: 0,
              productCost: 0,
              staffShare: 0,
              ownerShareContribution: 0,
            };
          }
          const sd = dayObj.staffDetails[staffKey];
          sd.serviceRevenue += amount;
          sd.productCost += cost;
          sd.staffShare += staffShare;
          sd.ownerShareContribution += ownerShare;
        }
      });
    });

    return dayObj;
  }, [todayInvoices, staff]);

  // Calculate individual staff daily & monthly splits
  const staffSplits = useMemo(() => {
    const todayStr = toLocalDateString(new Date());

    const stylistStaff = staff.filter(
      (st) => st.role !== "Owner" && st.id !== "system" && st.name !== "System"
    );

    return stylistStaff.map((member) => {
      let todayShare = 0;

      invoices.forEach((inv) => {
        const dateKeyStr = inv.dateKey || toLocalDateString(inv.date);
        const isToday = dateKeyStr === todayStr;
        const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;

        (inv.services || []).forEach((s: any) => {
          if (s.staffId === member.id || s.staffName === member.name) {
            if (s.serviceId !== "membership_fee") {
              const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
              const amount = serviceBaseAmount * discountFactor;
              const cost = s.usedProductCost || 0;
              const share = 0.5 * amount - cost;

              if (isToday) {
                todayShare += share;
              }
            }
          }
        });
      });

      const stStats = member.id ? staffMonthlyStats[member.id] : null;
      const mRev = stStats?.revenue ?? 0;
      const mCost = stStats?.productCost ?? 0;
      const monthlyShare = 0.5 * mRev - mCost;

      return {
        id: member.id,
        name: member.name,
        todayShare,
        monthlyShare,
      };
    });
  }, [invoices, staff, staffMonthlyStats]);

  if (!(invoicesLoaded && staffLoaded)) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="dashboard-root space-y-6 text-[#A89F8C]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Analytics
          </p>
          <h1 className="mt-2 text-[1.85rem] font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Dashboard Overview
          </h1>
        </div>
      </div>



      <div className="grid gap-6 lg:grid-cols-[1.8fr_1.2fr]">
        {/* Left — stats + quick actions */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* Today's Collection */}
            <div className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm hover:border-[#4A4535] hover:shadow-[0_4px_20px_rgba(184,150,46,0.08)] transition">
              <div className="flex items-center justify-between text-[#B8962E]">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">Today's Collection</span>
                <TrendingUp size={20} className="text-[#B8962E]" />
              </div>
              <p className="mt-3 text-[2rem] font-extrabold tracking-[-0.04em] text-[#F5F0E8]">
                {formatCurrency(stats.todayRevenue)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#2E2B24] pt-3 text-center">
                <div>
                  <p className="text-[10px] font-semibold text-[#6B6358] uppercase tracking-wider">Cash</p>
                  <p className="text-xs font-bold text-[#F5F0E8]">{formatCurrency(stats.cashToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#6B6358] uppercase tracking-wider">UPI</p>
                  <p className="text-xs font-bold text-[#F5F0E8]">{formatCurrency(stats.upiToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#6B6358] uppercase tracking-wider">Card</p>
                  <p className="text-xs font-bold text-[#F5F0E8]">{formatCurrency(stats.cardToday)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Revenue */}
            <div className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm flex flex-col justify-between hover:border-[#4A4535] hover:shadow-[0_4px_20px_rgba(184,150,46,0.08)] transition">
              <div>
                <div className="flex items-center justify-between text-[#B8962E]">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">Monthly Revenue</span>
                  <CreditCard size={20} className="text-[#B8962E]" />
                </div>
                <p className="mt-3 text-[2rem] font-extrabold tracking-[-0.04em] text-[#F5F0E8]">
                  {formatCurrency(stats.monthlyRevenue)}
                </p>
              </div>
              <p className="mt-2 text-[11px] text-[#6B6358]">Sales in current month</p>
            </div>

            {/* Today's Visits */}
            <div className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm flex flex-col justify-between hover:border-[#4A4535] hover:shadow-[0_4px_20px_rgba(184,150,46,0.08)] transition">
              <div>
                <div className="flex items-center justify-between text-[#B8962E]">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">Today's Visits</span>
                  <CalendarDays size={20} className="text-[#B8962E]" />
                </div>
                <p className="mt-3 text-[2rem] font-extrabold tracking-[-0.04em] text-[#F5F0E8]">
                  {stats.todayVisits}
                </p>
              </div>
              <p className="mt-2 text-[11px] text-[#6B6358]">Customers served today</p>
            </div>
          </div>

          {/* Quick Actions */}
          <section className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm">
            <h2 className="text-[0.95rem] font-bold tracking-[-0.015em] text-[#F5F0E8] mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 divide-x divide-[#2E2B24] gap-0">

              {/* Col 1 — Billing */}
              <div className="flex flex-col px-4">
                <button
                  type="button"
                  onClick={() => setIsBillingOpen(true)}
                  className="w-full flex-1 min-h-[100px] flex flex-col items-center justify-center rounded-xl bg-[#B8962E] text-[14px] font-extrabold tracking-[0.08em] uppercase text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.25)] transition cursor-pointer p-3"
                >
                  <Receipt size={28} className="mb-2" />
                  <span>Open Billing</span>
                  <span>Terminal</span>
                </button>
              </div>

              {/* Col 2 — Settlements + Staff */}
              <div className="flex flex-col items-center justify-center gap-3 px-4">
                <button
                  type="button"
                  onClick={() => setIsSettlementsOpen(true)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] text-[12px] font-semibold tracking-[0.01em] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
                >
                  <BarChart2 size={15} />
                  View Settlements
                </button>
                <Link
                  href="/staff"
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] text-[12px] font-semibold tracking-[0.01em] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition"
                >
                  <UsersRound size={15} />
                  Manage Staff
                </Link>
              </div>

              {/* Col 3 — Customer + Expense */}
              <div className="flex flex-col items-center justify-center gap-3 px-4">
                <button
                  type="button"
                  onClick={() => setIsCustomerOpen(true)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] text-[12px] font-semibold tracking-[0.01em] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
                >
                  <UserPlus size={15} />
                  Add Customer
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpenseOpen(true)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] text-[12px] font-semibold tracking-[0.01em] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
                >
                  <PiggyBank size={15} />
                  Add Expense
                </button>
              </div>

            </div>
          </section>
        </div>

        {/* ── E: Right — horizontal staff cards ─────────────────────────── */}
        <section className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-[0.95rem] font-bold tracking-[-0.015em] text-[#F5F0E8]">Stylists Floor Board</h2>
            <p className="text-xs text-[#6B6358]">Real-time status and floor hours today</p>
          </div>
          {staff.length === 0 ? (
            <p className="text-xs text-[#6B6358] italic">No registered staff found.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {staffWithActiveTimes.map((member) => {
                const isOnDuty = member.dutyStatus === "onDuty";
                const activeTime = member.activeTime;
                return (
                  <div
                    key={member.id}
                    className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 flex flex-col justify-between hover:border-[#B8962E] hover:shadow-[0_2px_12px_rgba(184,150,46,0.12)] transition"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#F5F0E8] text-sm">
                          {member.name}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border tracking-[0.1em] uppercase ${isOnDuty
                            ? "bg-[#2A2310] text-[#D4A935] border-[#4A3A10]"
                            : "bg-[#1C1A16] text-[#6B6358] border-[#2E2B24]"
                            }`}
                        >
                          {isOnDuty ? "On Duty" : "Off Duty"}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#6B6358] mt-0.5">{member.role}</p>
                      <div className="mt-2 flex items-center justify-between border-t border-[#2E2B24] pt-2 text-xs">
                        <span className="text-[#6B6358]">Active today</span>
                        <span className="font-bold text-[#F5F0E8]">{activeTime}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleDutyStatus(member)}
                      className={`mt-3 h-8 w-full rounded-xl text-[11px] font-bold tracking-wide transition ${isOnDuty
                        ? "bg-[#1C1A16] border border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]"
                        : "bg-[#B8962E] text-[#0E0D0B] hover:bg-[#D4A935]"
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
      <section className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-[0.95rem] font-bold tracking-[-0.015em] text-[#F5F0E8]">Today's Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm text-[#A89F8C]">
            <thead className="bg-[#131210] border-b border-[#2E2B24]">
              <tr>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6358] font-bold">Invoice #</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6358] font-bold">Customer</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6358] font-bold">Cust Type</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6358] font-bold">Staff</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6358] font-bold">Time</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6B6358] font-bold text-right">Amount</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242118]">
              {todayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#6B6358] italic">
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
                  const customerType = inv.customerType || "regular";

                  return (
                    <tr key={inv.id} className="bg-transparent hover:bg-[#1F1A0F] transition">
                      <td className="px-4 py-3 font-bold text-[#F5F0E8]">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#F5F0E8]">
                        {inv.customerName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase border ${customerType === "membership"
                            ? "bg-[#2A2310] text-[#D4A935] border-[#4A3A10]"
                            : customerType === "regular"
                              ? "bg-[#1C1A16] text-[#A89F8C] border-[#2E2B24]"
                              : "bg-[#1A1C2A] text-[#818CF8] border-[#2E3154]"
                            }`}
                        >
                          {customerType === "membership"
                            ? "Membership"
                            : customerType === "new"
                              ? "New"
                              : "Regular"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#A89F8C]">
                        {staffListStr || (
                          <span className="italic text-[#6B6358]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#6B6358]">{time}</td>
                      <td className="px-4 py-3 font-bold text-[#F5F0E8] text-right">
                        {formatCurrency(inv.grandTotal)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-[#2E2B24] bg-[#131210] px-3 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition"
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
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-10 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsBillingOpen(false)}
        >
          <div
            className="relative w-full max-w-7xl bg-[#1C1A16] rounded-3xl border border-[#2E2B24] shadow-2xl p-4 sm:p-6 md:p-8 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <BillingTerminal
              onClose={() => setIsBillingOpen(false)}
              onSuccess={async () => {
                // Invalidate caching on success
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const monthKey = `${yyyy}-${mm}`;
                localStorage.removeItem(`monthlyStats_${monthKey}`);
                localStorage.removeItem(`staffMonthlyStats_${monthKey}`);
                // Trigger refetches
                await Promise.all([
                  fetchMonthlyStats(true),
                  fetchStaffMonthlyStats(true),
                ]);
              }}
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

      {isSettlementsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-10 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsSettlementsOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#1C1A16] rounded-3xl border border-[#2E2B24] shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#2E2B24]">
              <div>
                <h3 className="text-xl font-bold text-[#F5F0E8]">Today's Settlements Breakdown</h3>
                <p className="text-xs text-[#6B6358] font-medium mt-1">
                  Showing detailed splits for {format(new Date(), "dd MMM yyyy")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettlementsOpen(false)}
                className="grid size-10 place-items-center rounded-xl border border-[#2E2B24] hover:border-[#B8962E] transition text-[#A89F8C] hover:text-[#B8962E] cursor-pointer font-bold bg-[#131210] shadow-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="mt-6">
              {/* Details Cards */}
              {todayInvoices.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-[#2E2B24] rounded-2xl bg-[#131210] shadow-xs">
                  <p className="text-sm font-semibold text-[#6B6358] italic">No sales or settlements recorded today.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {/* Owner Net Card */}
                  <div className="rounded-2xl border border-[#4A3A10] bg-[#1A1500] p-5 shadow-xs space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-[#D4A935] flex items-center gap-1.5">
                          <ShieldCheck size={16} className="text-[#D4A935]" />
                          Owner Settlement
                        </h4>
                        <span className="inline-block rounded-full bg-[#2A2310] text-[#D4A935] border border-[#4A3A10] px-2 py-0.5 text-[10px] font-bold tracking-wide mt-1 uppercase">
                          Today Summary
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#D4A935] font-bold uppercase tracking-wider">
                          Net Share
                        </span>
                        <p className="font-black text-[#D4A935] text-xl mt-0.5">
                          {formatCurrency(todaySettlement.totalOwnerShare)}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[#2E2B24] pt-3 space-y-2 text-xs text-[#A89F8C]">
                      <div className="flex justify-between">
                        <span className="text-[#A89F8C] font-medium">Owner Direct Services:</span>
                        <span className="font-bold text-[#F5F0E8]">{formatCurrency(todaySettlement.ownerDirectRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A89F8C] font-medium">Stylists 50% Share:</span>
                        <span className="font-bold text-[#F5F0E8]">+{formatCurrency(todaySettlement.staffRevenueContribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A89F8C] font-medium">Stylists Product Costs:</span>
                        <span className="font-bold text-[#F5F0E8]">+{formatCurrency(todaySettlement.staffProductReimbursement)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A89F8C] font-medium">Membership Invoices:</span>
                        <span className="font-bold text-[#F5F0E8]">+{formatCurrency(todaySettlement.totalMembershipAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A89F8C] font-medium">Retail Product Sales:</span>
                        <span className="font-bold text-[#F5F0E8]">+{formatCurrency(todaySettlement.retailProductsRevenue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stylist Cards */}
                  {Object.values(todaySettlement.staffDetails)
                    .filter((sd) => sd.role !== "Owner")
                    .map((sd) => (
                      <div
                        key={sd.staffId}
                        className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-5 shadow-xs space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-[#F5F0E8] flex items-center gap-1.5">
                              <Users size={16} className="text-[#B8962E]" />
                              {sd.name}
                            </h4>
                            <span className="inline-block rounded-full bg-[#1C1A16] text-[#A89F8C] border border-[#2E2B24] px-2 py-0.5 text-[10px] font-bold tracking-wide mt-1 uppercase">
                              Stylist Split
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[#6B6358] font-bold uppercase tracking-wider">
                              Net Share
                            </span>
                            <p className="font-black text-[#F5F0E8] text-xl mt-0.5">
                              {formatCurrency(sd.staffShare)}
                            </p>
                          </div>
                        </div>

                        <div className="border-t border-[#2E2B24] pt-3 space-y-2 text-xs">
                          <div className="flex justify-between text-[#6B6358]">
                            <span>Service Revenue:</span>
                            <span className="font-semibold text-[#F5F0E8]">{formatCurrency(sd.serviceRevenue)}</span>
                          </div>
                          <div className="flex justify-between text-[#6B6358]">
                            <span>50% Base Share:</span>
                            <span className="font-semibold text-[#F5F0E8]">{formatCurrency(0.5 * sd.serviceRevenue)}</span>
                          </div>
                          <div className="flex justify-between text-[#6B6358]">
                            <span>Product Cost Used:</span>
                            <span className="font-bold text-[#E57373]">-{formatCurrency(sd.productCost)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}