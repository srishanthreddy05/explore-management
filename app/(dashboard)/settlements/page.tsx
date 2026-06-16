"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import * as invoicesService from "@/services/invoices";
import * as expensesService from "@/services/expenses";
import { useAppData } from "@/context/AppDataContext";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { format } from "date-fns";
import { toLocalDateString } from "@/lib/utils/date";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Coins,
  Users,
  ShieldCheck,
  Package,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { collection, query, where, getDocs, getDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

function getInvoiceDateKeys(invoice: any) {
  let dateKey = invoice.dateKey;
  if (!dateKey) {
    let d = new Date();
    if (invoice.date) {
      d = typeof invoice.date.toDate === "function" ? invoice.date.toDate() : new Date(invoice.date);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateKey = `${yyyy}-${mm}-${dd}`;
  }
  return {
    dateKey,
    monthKey: dateKey.slice(0, 7),
  };
}

function getInvoicePayments(inv: any) {
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

function getServiceCommission(s: any, inv: any) {
  const discountFactor = inv && inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
  const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
  const amount = serviceBaseAmount * discountFactor;
  const cost = s.usedProductCost || 0;
  
  let role = s.staffRole;
  if (!role) {
    if (s.serviceId === "membership_fee" || s.staffId === "system" || s.staffName === "System") {
      role = "Owner";
    } else {
      role = "Stylist";
    }
  }

  let stylistShare = 0;
  let ownerShare = 0;

  if (role === "Owner") {
    stylistShare = 0;
    ownerShare = amount;
  } else {
    stylistShare = 0.5 * amount - cost;
    ownerShare = 0.5 * amount + cost;
  }

  return {
    serviceRevenue: amount,
    productCost: cost,
    stylistShare,
    ownerShare,
  };
}

export default function SettlementsPage() {
  const { staff } = useAppData();
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<Record<string, any>>({});
  const [dayInvoicesMap, setDayInvoicesMap] = useState<Record<string, any[]>>({});
  const [monthlyStaffShares, setMonthlyStaffShares] = useState<Record<string, number>>({});
  const [monthlyStatsTotals, setMonthlyStatsTotals] = useState({
    ownerShare: 0,
    membershipAmount: 0,
    retailProductsRevenue: 0,
    productsReturned: 0,
  });
  const [loadingDays, setLoadingDays] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<any[]>([]);

  const handleSyncStats = async () => {
    setSyncing(true);
    try {
      const allInvoices = await invoicesService.getAll();
      const monthlyStats: Record<string, any> = {};
      const dailyStats: Record<string, any> = {};
      const staffStats: Record<string, any> = {};

      allInvoices.forEach((inv: any) => {
        const { dateKey, monthKey } = getInvoiceDateKeys(inv);
        const payments = getInvoicePayments(inv);
        const grandTotal = inv.grandTotal || 0;

        // Initialize monthly stats
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = { totalRevenue: 0, totalVisits: 0, cash: 0, upi: 0, card: 0 };
        }
        monthlyStats[monthKey].totalRevenue += grandTotal;
        monthlyStats[monthKey].totalVisits += 1;
        monthlyStats[monthKey].cash += payments.cash;
        monthlyStats[monthKey].upi += payments.upi;
        monthlyStats[monthKey].card += payments.card;

        // Initialize daily stats
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = {
            dateKey,
            totalRevenue: 0,
            totalVisits: 0,
            cash: 0,
            upi: 0,
            card: 0,
            serviceRevenue: 0,
            productCost: 0,
            stylistShare: 0,
            ownerShare: 0,
            totalMembershipAmount: 0,
            retailProductsRevenue: 0,
          };
        }
        dailyStats[dateKey].totalRevenue += grandTotal;
        dailyStats[dateKey].totalVisits += 1;
        dailyStats[dateKey].cash += payments.cash;
        dailyStats[dateKey].upi += payments.upi;
        dailyStats[dateKey].card += payments.card;

        const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;

        (inv.services || []).forEach((s: any) => {
          const comm = getServiceCommission(s, inv);
          dailyStats[dateKey].serviceRevenue += comm.serviceRevenue;
          dailyStats[dateKey].productCost += comm.productCost;
          dailyStats[dateKey].stylistShare += comm.stylistShare;
          dailyStats[dateKey].ownerShare += comm.ownerShare;
          if (s.serviceId === "membership_fee" || s.staffId === "system" || s.staffName === "System") {
            dailyStats[dateKey].totalMembershipAmount += comm.serviceRevenue;
          }
        });

        // Add retail product sales to owner's share
        (inv.products || []).forEach((p: any) => {
          const productBaseAmount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
          const amount = productBaseAmount * discountFactor;
          dailyStats[dateKey].ownerShare += amount;
          dailyStats[dateKey].retailProductsRevenue += amount;
        });

        // Staff monthly splits
        const staffInvoiceSummary: Record<string, any> = {};
        (inv.services || []).forEach((s: any) => {
          const staffId = s.staffId || 'unassigned';
          if (!staffInvoiceSummary[staffId]) {
            staffInvoiceSummary[staffId] = { revenue: 0, servicesCount: 0, productCost: 0 };
          }
          const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
          const amount = serviceBaseAmount * discountFactor;
          const cost = s.usedProductCost || 0;
          staffInvoiceSummary[staffId].revenue += amount;
          staffInvoiceSummary[staffId].servicesCount += 1;
          staffInvoiceSummary[staffId].productCost += cost;
        });

        Object.entries(staffInvoiceSummary).forEach(([staffId, summary]) => {
          const staffMonthKey = `${staffId}_${monthKey}`;
          if (!staffStats[staffMonthKey]) {
            staffStats[staffMonthKey] = { revenue: 0, servicesCount: 0, visits: 0, productCost: 0 };
          }
          staffStats[staffMonthKey].revenue += summary.revenue;
          staffStats[staffMonthKey].servicesCount += summary.servicesCount;
          staffStats[staffMonthKey].productCost += summary.productCost;
          staffStats[staffMonthKey].visits += 1;
        });
      });

      let currentBatch = writeBatch(db);
      let count = 0;

      const ops: any[] = [];
      Object.entries(monthlyStats).forEach(([monthKey, stats]) => {
        ops.push({ ref: doc(db, 'stats', `revenue_${monthKey}`), data: stats });
      });
      Object.entries(dailyStats).forEach(([dateKey, stats]) => {
        ops.push({ ref: doc(db, 'stats', `daily_${dateKey}`), data: stats });
      });
      Object.entries(staffStats).forEach(([staffMonthKey, stats]) => {
        const [staffId, monthKey] = staffMonthKey.split('_');
        ops.push({ ref: doc(db, 'stats', `staff_${staffId}_${monthKey}`), data: stats });
      });

      for (const op of ops) {
        currentBatch.set(op.ref, op.data, { merge: true });
        count++;
        if (count % 400 === 0) {
          await currentBatch.commit();
          currentBatch = writeBatch(db);
        }
      }
      if (count % 400 !== 0) {
        await currentBatch.commit();
      }

      alert("Statistics synchronized successfully!");
      window.location.reload();
    } catch (err) {
      console.error("Failed to sync stats:", err);
      alert("Failed to sync stats. See console for details.");
    } finally {
      setSyncing(false);
    }
  };

  // Date range — default to current month
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [dateTo, setDateTo] = useState(
    toLocalDateString(now)
  );

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // 1. Fetch daily stats in range
        const dailyQuery = query(
          collection(db, "stats"),
          where("dateKey", ">=", dateFrom),
          where("dateKey", "<=", dateTo)
        );
        const dailySnap = await getDocs(dailyQuery);
        const statsMap: Record<string, any> = {};
        dailySnap.forEach((d) => {
          const data = d.data();
          statsMap[data.dateKey] = data;
        });
        setDailyStats(statsMap);

        // 2. Fetch today's invoices to compute today's details & shares
        try {
          const todayInvoices = await invoicesService.getByDateKey(todayStr);
          setDayInvoicesMap((prev) => ({ ...prev, [todayStr]: todayInvoices }));
        } catch (err) {
          console.error("Failed to load today's invoices:", err);
        }

        // 3. Fetch monthly staff shares from stats/staff_{staffId}_{monthKey}
        const loadNow = new Date();
        const yyyy = loadNow.getFullYear();
        const mm = String(loadNow.getMonth() + 1).padStart(2, '0');
        const monthKey = `${yyyy}-${mm}`;
        
        const stylistStaff = staff.filter(
          (st) => st.role !== "Owner" && st.id !== "system" && st.name !== "System"
        );

        const sharesMap: Record<string, number> = {};
        await Promise.all(
          stylistStaff.map(async (member) => {
            if (!member.id) return;
            try {
              const staffDocRef = doc(db, "stats", `staff_${member.id}_${monthKey}`);
              const snap = await getDoc(staffDocRef);
              if (snap.exists()) {
                const data = snap.data();
                const revenue = data.revenue || 0;
                const productCost = data.productCost || 0;
                sharesMap[member.id] = 0.5 * revenue - productCost;
              } else {
                sharesMap[member.id] = 0;
              }
            } catch (err) {
              console.error(`Error loading monthly share for staff ${member.id}:`, err);
              sharesMap[member.id] = 0;
            }
          })
        );
        setMonthlyStaffShares(sharesMap);

        // Fetch monthly stats totals for current calendar month
        const monthlyDailyQuery = query(
          collection(db, "stats"),
          where("dateKey", ">=", `${monthKey}-01`),
          where("dateKey", "<=", `${monthKey}-31`)
        );
        const monthlyDailySnap = await getDocs(monthlyDailyQuery);
        let mOwnerShare = 0;
        let mMembershipAmount = 0;
        let mRetailProductsRevenue = 0;
        let mProductsReturned = 0;

        monthlyDailySnap.forEach((d) => {
          const data = d.data();
          if (data.dateKey && data.dateKey.startsWith(monthKey)) {
            mOwnerShare += data.ownerShare || 0;
            mMembershipAmount += data.totalMembershipAmount || 0;
            mRetailProductsRevenue += data.retailProductsRevenue || 0;
            mProductsReturned += data.productCost || 0;
          }
        });

        setMonthlyStatsTotals({
          ownerShare: mOwnerShare,
          membershipAmount: mMembershipAmount,
          retailProductsRevenue: mRetailProductsRevenue,
          productsReturned: mProductsReturned,
        });

        // 4. Fetch expenses in the selected date range
        try {
          const start = new Date(dateFrom);
          start.setHours(0, 0, 0, 0);
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          const expensesData = await expensesService.getByDateRange(start, end);
          setExpenses(expensesData);
        } catch (err) {
          console.error("Failed to load range expenses:", err);
        }

        // 5. Fetch monthly expenses for current calendar month
        try {
          const startOfMonth = new Date(loadNow.getFullYear(), loadNow.getMonth(), 1);
          const endOfMonth = new Date(loadNow.getFullYear(), loadNow.getMonth() + 1, 0, 23, 59, 59, 999);
          const monthlyExpensesData = await expensesService.getByDateRange(startOfMonth, endOfMonth);
          setMonthlyExpenses(monthlyExpensesData);
        } catch (err) {
          console.error("Failed to load monthly expenses:", err);
        }
      } catch (err) {
        console.error("Failed to load settlements data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dateFrom, dateTo, staff, todayStr]);

  const dailyExpensesMap = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((exp) => {
      if (exp.type === "daily") {
        map[exp.date] = (map[exp.date] || 0) + exp.amount;
      }
    });
    return map;
  }, [expenses]);

  const todayDailyExpenses = useMemo(() => {
    const todayStr = toLocalDateString(new Date());
    return monthlyExpenses
      .filter((e) => e.type === "daily" && e.date === todayStr)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [monthlyExpenses]);

  const monthDailyExpenses = useMemo(() => {
    return monthlyExpenses
      .filter((e) => e.type === "daily")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [monthlyExpenses]);

  // Generate date list YYYY-MM-DD
  const dateList = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(dateFrom + "T00:00:00");
    const end = new Date(dateTo + "T00:00:00");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    const current = new Date(start);
    while (current <= end) {
      dates.push(toLocalDateString(current));
      current.setDate(current.getDate() + 1);
    }
    return dates.reverse();
  }, [dateFrom, dateTo]);

  // Aggregate values for summary cards over the date range
  const summaryAggregates = useMemo(() => {
    let staffAmount = 0;
    let ownerAmount = 0;
    let membershipAmount = 0;
    let productsReturned = 0;

    Object.values(dailyStats).forEach((day: any) => {
      staffAmount += day.stylistShare || 0;
      ownerAmount += day.ownerShare || 0;
      membershipAmount += day.totalMembershipAmount || 0;
      productsReturned += day.productCost || 0;
    });

    return {
      staffAmount,
      ownerAmount,
      membershipAmount,
      productsReturned,
    };
  }, [dailyStats]);

  // Calculate individual staff daily & monthly splits based on stats & today's invoices
  const staffSplits = useMemo(() => {
    const stylistStaff = staff.filter(
      (st) => st.role !== "Owner" && st.id !== "system" && st.name !== "System"
    );

    const todayInvoices = dayInvoicesMap[todayStr] || [];

    return stylistStaff.map((member) => {
      let todayShare = 0;

      todayInvoices.forEach((inv) => {
        const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
        (inv.services || []).forEach((s: any) => {
          if (s.staffId === member.id || s.staffName === member.name) {
            if (s.serviceId !== "membership_fee") {
              const serviceBaseAmount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
              const amount = serviceBaseAmount * discountFactor;
              const cost = s.usedProductCost || 0;
              const share = 0.5 * amount - cost;
              todayShare += share;
            }
          }
        });
      });

      const monthlyShare = member.id ? (monthlyStaffShares[member.id] || 0) : 0;

      return {
        id: member.id,
        name: member.name,
        todayShare,
        monthlyShare,
      };
    });
  }, [dayInvoicesMap, staff, monthlyStaffShares, todayStr]);

  const todayMetrics = useMemo(() => {
    const details = getDayDetails(todayStr);
    const ownerShare = details.ownerDirectRevenue + details.staffRevenueContribution + details.staffProductReimbursement + details.totalMembershipAmount + details.retailProductsRevenue;
    
    return {
      ownerShare,
      membershipAmount: details.totalMembershipAmount,
      retailProductsRevenue: details.retailProductsRevenue,
      productsReturned: details.staffProductReimbursement,
    };
  }, [dayInvoicesMap, todayStr, staff]);

  // Initialize expanded state: today is expanded by default
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => ({
    [todayStr]: true,
  }));

  const toggleDayExpand = async (dateStr: string) => {
    const isExpanded = !!expandedDays[dateStr];
    
    // Toggle state
    setExpandedDays((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));

    // If expanding and not already loaded, lazy-load invoices for that day
    if (!isExpanded && !dayInvoicesMap[dateStr]) {
      setLoadingDays((prev) => ({ ...prev, [dateStr]: true }));
      try {
        const dayInvoices = await invoicesService.getByDateKey(dateStr);
        setDayInvoicesMap((prev) => ({ ...prev, [dateStr]: dayInvoices }));
      } catch (err) {
        console.error(`Failed to load invoices for date ${dateStr}:`, err);
      } finally {
        setLoadingDays((prev) => ({ ...prev, [dateStr]: false }));
      }
    }
  };

  // Filter out days with no transactions, except "Today"
  const visibleSettlements = useMemo(() => {
    return dateList
      .map((d) => {
        const stats = dailyStats[d];
        const dayDailyExpenses = dailyExpensesMap[d] || 0;
        return {
          date: d,
          totalServiceRevenue: stats?.serviceRevenue || 0,
          totalMembershipAmount: stats?.totalMembershipAmount || 0,
          totalProductCost: stats?.productCost || 0,
          totalStaffShare: stats?.stylistShare || 0,
          totalOwnerShare: (stats?.ownerShare || 0) - dayDailyExpenses,
          totalRetailProductsRevenue: stats?.retailProductsRevenue || 0,
        };
      })
      .filter((day) => {
        const hasTransactions =
          day.totalServiceRevenue > 0 || day.totalMembershipAmount > 0;
        const isToday = day.date === todayStr;
        return isToday || hasTransactions;
      });
  }, [dailyStats, dateList, todayStr, dailyExpensesMap]);

  function getDayDetails(dateStr: string) {
    const dayInvoices = dayInvoicesMap[dateStr] || [];
    
    let ownerDirectRevenue = 0;
    let staffRevenueContribution = 0;
    let staffProductReimbursement = 0;
    let totalMembershipAmount = 0;
    let retailProductsRevenue = 0;
    const staffDetails: Record<string, any> = {};

    dayInvoices.forEach((inv) => {
      const discountFactor = inv.subtotal > 0 ? (inv.grandTotal / inv.subtotal) : 1;
      
      (inv.products || []).forEach((p: any) => {
        const productBaseAmount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
        const amount = productBaseAmount * discountFactor;
        retailProductsRevenue += amount;
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
          totalMembershipAmount += amount;
          return;
        }

        // Regular service: Owner vs Stylist
        if (role === "Owner") {
          ownerDirectRevenue += amount;
          const staffKey = staffId !== "unassigned" ? staffId : staffName;
          if (!staffDetails[staffKey]) {
            staffDetails[staffKey] = {
              staffId,
              name: staffName,
              role,
              serviceRevenue: 0,
              productCost: 0,
              staffShare: 0,
              ownerShareContribution: 0,
            };
          }
          const sd = staffDetails[staffKey];
          sd.serviceRevenue += amount;
          sd.productCost += cost;
          sd.ownerShareContribution += amount;
        } else {
          // Regular stylist
          const staffShare = 0.5 * amount - cost;
          const ownerShare = 0.5 * amount + cost;

          staffRevenueContribution += 0.5 * amount;
          staffProductReimbursement += cost;

          const staffKey = staffId !== "unassigned" ? staffId : staffName;
          if (!staffDetails[staffKey]) {
            staffDetails[staffKey] = {
              staffId,
              name: staffName,
              role,
              serviceRevenue: 0,
              productCost: 0,
              staffShare: 0,
              ownerShareContribution: 0,
            };
          }
          const sd = staffDetails[staffKey];
          sd.serviceRevenue += amount;
          sd.productCost += cost;
          sd.staffShare += staffShare;
          sd.ownerShareContribution += ownerShare;
        }
      });
    });

    return {
      ownerDirectRevenue,
      staffRevenueContribution,
      staffProductReimbursement,
      totalMembershipAmount,
      retailProductsRevenue,
      staffDetails: Object.values(staffDetails),
    };
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-[#F5F0E8] pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Daily Operations
          </p>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
              Stylist & Owner Settlements
            </h1>
            <button
              onClick={handleSyncStats}
              disabled={syncing}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#2E2B24] bg-[#131210] px-3.5 text-xs font-bold text-[#A89F8C] shadow-md transition hover:bg-[#1C1A16] hover:text-[#F5F0E8] hover:border-[#B8962E] disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Database Stats"}
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 flex-wrap bg-[#131210] p-2 rounded-2xl border border-[#2E2B24] shadow-sm">
          <Calendar size={16} className="text-[#6B6358] ml-1" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
          />
          <span className="text-xs text-[#A89F8C] font-semibold px-1">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
          />
        </div>
      </div>

      {/* Splits Row: Owner & Staff Splits (All in one row) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
          Owner & Staff Splits (Daily & Monthly)
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {/* Owner Share Card */}
          <div
            className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm space-y-2 hover:shadow-md transition text-[#F5F0E8] hover:border-[#B8962E]/30"
          >
            <h4 className="font-extrabold text-[#F5F0E8] text-sm flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-[#B8962E]" />
              Owner
            </h4>
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">Today</span>
                <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(todayMetrics.ownerShare - todayDailyExpenses)}</p>
              </div>
              <div>
                <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">This Month</span>
                <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(monthlyStatsTotals.ownerShare - monthDailyExpenses)}</p>
              </div>
            </div>
          </div>

          {/* Stylist Cards */}
          {staffSplits.map((member) => (
            <div
              key={member.id}
              className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm space-y-2 hover:shadow-md transition text-[#F5F0E8] hover:border-[#B8962E]/30"
            >
              <h4 className="font-extrabold text-[#F5F0E8] text-sm flex items-center gap-1.5">
                <Users size={16} className="text-[#B8962E]" />
                {member.name}
              </h4>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">Today</span>
                  <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(member.todayShare)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">This Month</span>
                  <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(member.monthlyShare)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Membership, Retail Product Sales, Reimbursed Cost, Daily Category Expenses (All in one row) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Membership Card */}
        <div
          className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm space-y-2 hover:shadow-md transition text-[#F5F0E8] hover:border-[#B8962E]/30"
        >
          <h4 className="font-bold text-[#F5F0E8] text-sm flex items-center gap-1.5">
            <PiggyBank size={16} className="text-[#B8962E]" />
            Membership Revenue
          </h4>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">Today</span>
              <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(todayMetrics.membershipAmount)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">This Month</span>
              <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(monthlyStatsTotals.membershipAmount)}</p>
            </div>
          </div>
        </div>

        {/* Retail Product Sales Card */}
        <div
          className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm space-y-2 hover:shadow-md transition text-[#F5F0E8] hover:border-[#B8962E]/30"
        >
          <h4 className="font-bold text-[#F5F0E8] text-sm flex items-center gap-1.5">
            <Package size={16} className="text-[#B8962E]" />
            Retail Product Sales
          </h4>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">Today</span>
              <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(todayMetrics.retailProductsRevenue)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">This Month</span>
              <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(monthlyStatsTotals.retailProductsRevenue)}</p>
            </div>
          </div>
        </div>

        {/* Products Money Returned Card */}
        <div
          className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm space-y-2 hover:shadow-md transition text-[#F5F0E8] hover:border-[#B8962E]/30"
        >
          <h4 className="font-bold text-[#F5F0E8] text-sm flex items-center gap-1.5">
            <Package size={16} className="text-[#B8962E]" />
            Products Money Returned
          </h4>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">Today</span>
              <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(todayMetrics.productsReturned)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">This Month</span>
              <p className="font-black text-[#F5F0E8] text-base">{formatCurrency(monthlyStatsTotals.productsReturned)}</p>
            </div>
          </div>
        </div>

        {/* Daily Category Expenses Card */}
        <div
          className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm space-y-2 hover:shadow-md transition text-[#F5F0E8] hover:border-[#B8962E]/30"
        >
          <h4 className="font-bold text-[#F5F0E8] text-sm flex items-center gap-1.5">
            <PiggyBank size={16} className="text-[#B8962E]" />
            Daily Category Expenses
          </h4>
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">Today</span>
              <p className="font-black text-[#E57373] text-base">{formatCurrency(todayDailyExpenses)}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">This Month</span>
              <p className="font-black text-[#E57373] text-base">{formatCurrency(monthDailyExpenses)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settlements List section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-[#F5F0E8]">
          Daily Breakdown
        </h2>

        <div className="space-y-3">
          {visibleSettlements.length === 0 ? (
            <div className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-12 text-center shadow-sm">
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#131210] text-[#B8962E] mb-3">
                <TrendingUp size={24} />
              </div>
              <p className="text-sm font-semibold text-[#F5F0E8]">No Settlement History</p>
              <p className="text-xs text-[#A89F8C] mt-1">
                There are no client invoices or memberships logged in this date range.
              </p>
            </div>
          ) : (
            visibleSettlements.map((day) => {
              const isToday = day.date === todayStr;
              const hasTransactions =
                day.totalServiceRevenue > 0 || day.totalMembershipAmount > 0;
              const isExpanded = !!expandedDays[day.date];

              return (
                <div
                  key={day.date}
                  className="overflow-hidden rounded-2xl border border-[#2E2B24] bg-[#1C1A16] shadow-sm transition hover:border-[#B8962E]/30"
                >
                  {/* Row Header */}
                  <div
                    onClick={() => hasTransactions && toggleDayExpand(day.date)}
                    className={`flex items-center justify-between p-5 select-none ${
                      hasTransactions ? "cursor-pointer" : "opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {hasTransactions ? (
                        isExpanded ? (
                          <ChevronUp size={18} className="text-[#A89F8C]" />
                        ) : (
                          <ChevronDown size={18} className="text-[#A89F8C]" />
                        )
                      ) : (
                        <div className="w-[18px]" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#F5F0E8]">
                            {format(new Date(day.date + "T00:00:00"), "dd MMM yyyy")}
                          </span>
                          {isToday && (
                            <span className="rounded-full bg-[#B8962E] px-2 py-0.5 text-[10px] font-bold text-[#0E0D0B] uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>
                        {!hasTransactions && (
                          <p className="text-[11px] text-[#A89F8C] font-semibold mt-0.5">
                            No operations or bills logged yet
                          </p>
                        )}
                      </div>
                    </div>

                    {hasTransactions && (
                      <div className="flex items-center gap-4 text-xs font-semibold text-[#A89F8C] flex-wrap">
                        <div className="hidden sm:block">
                          Service: <span className="text-[#F5F0E8] font-bold">{formatCurrency(day.totalServiceRevenue)}</span>
                        </div>
                        <div className="hidden sm:block">
                          Membership: <span className="text-[#F5F0E8] font-bold">{formatCurrency(day.totalMembershipAmount)}</span>
                        </div>
                        <div className="hidden sm:block">
                          Retail: <span className="text-[#F5F0E8] font-bold">{formatCurrency(day.totalRetailProductsRevenue)}</span>
                        </div>
                        <div className="hidden sm:block">
                          Product Returned: <span className="text-[#F5F0E8] font-bold">{formatCurrency(day.totalProductCost)}</span>
                        </div>
                        <div className="rounded-xl bg-[#132A3A] border border-[#2B5270] px-3 py-1.5 text-[#60A5FA]">
                          Staff: <span className="text-[#60A5FA] font-extrabold">{formatCurrency(day.totalStaffShare)}</span>
                        </div>
                        <div className="rounded-xl bg-[#2E1A47] border border-[#5E3E8C] px-3 py-1.5 text-[#C084FC]">
                          Owner: <span className="text-[#C084FC] font-extrabold">{formatCurrency(day.totalOwnerShare)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row Details */}
                  {isExpanded && hasTransactions && (
                    <div className="border-t border-[#2E2B24] bg-[#131210]/65 p-5">
                      {loadingDays[day.date] ? (
                        <div className="flex h-20 items-center justify-center">
                          <div className="size-6 animate-spin rounded-full border-2 border-[#B8962E] border-t-transparent" />
                        </div>
                      ) : (
                        (() => {
                          const details = getDayDetails(day.date);
                          return (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {/* Owner Net Card */}
                              <div className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-xs space-y-4 text-[#F5F0E8]">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-extrabold text-[#F5F0E8] flex items-center gap-1.5">
                                      <ShieldCheck size={16} className="text-[#B8962E]" />
                                      Owner Settlement
                                    </h4>
                                    <span className="inline-block rounded-full bg-[#2E1A47] text-[#C084FC] border border-[#5E3E8C] px-2 py-0.5 text-[10px] font-bold tracking-wide mt-1 uppercase">
                                      Daily Summary
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">
                                      Net Share
                                    </span>
                                    <p className="font-black text-[#F5F0E8] text-xl mt-0.5">
                                      {formatCurrency(day.totalOwnerShare)}
                                    </p>
                                  </div>
                                </div>

                                <div className="border-t border-[#2E2B24] pt-3 space-y-2 text-xs">
                                  <div className="flex justify-between text-[#A89F8C]">
                                    <span className="font-medium">Owner Direct Services:</span>
                                    <span className="font-bold text-[#F5F0E8]">{formatCurrency(details.ownerDirectRevenue)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#A89F8C]">
                                    <span className="font-medium">Stylists 50% Share:</span>
                                    <span className="font-bold text-[#F5F0E8]">+{formatCurrency(details.staffRevenueContribution)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#A89F8C]">
                                    <span className="font-medium">Stylists Product Costs:</span>
                                    <span className="font-bold text-[#F5F0E8]">+{formatCurrency(details.staffProductReimbursement)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#A89F8C]">
                                    <span className="font-medium">Membership Invoices:</span>
                                    <span className="font-bold text-[#F5F0E8]">+{formatCurrency(details.totalMembershipAmount)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#A89F8C]">
                                    <span className="font-medium">Retail Product Sales:</span>
                                    <span className="font-bold text-[#F5F0E8]">+{formatCurrency(details.retailProductsRevenue)}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-[#2E2B24] pt-2 mt-2 font-semibold text-[#A89F8C]">
                                    <span>Gross Share:</span>
                                    <span className="text-[#F5F0E8]">{formatCurrency(details.ownerDirectRevenue + details.staffRevenueContribution + details.staffProductReimbursement + details.totalMembershipAmount + details.retailProductsRevenue)}</span>
                                  </div>
                                  <div className="flex justify-between text-[#E57373] font-semibold">
                                    <span>Daily Expenses:</span>
                                    <span>-{formatCurrency(dailyExpensesMap[day.date] || 0)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Stylist Cards */}
                              {details.staffDetails
                                .filter((sd: any) => sd.role !== "Owner")
                                .map((sd: any) => (
                                  <div
                                    key={sd.staffId}
                                    className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-xs space-y-4"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-extrabold text-[#F5F0E8] flex items-center gap-1.5">
                                          <Users size={16} className="text-[#B8962E]" />
                                          {sd.name}
                                        </h4>
                                        <span className="inline-block rounded-full bg-[#132A3A] text-[#60A5FA] border border-[#2B5270] px-2 py-0.5 text-[10px] font-bold tracking-wide mt-1 uppercase">
                                          Stylist Split
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-[10px] text-[#A89F8C] font-bold uppercase tracking-wider">
                                          Net Share
                                        </span>
                                        <p className="font-black text-[#F5F0E8] text-xl mt-0.5">
                                          {formatCurrency(sd.staffShare)}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="border-t border-[#2E2B24] pt-3 space-y-2 text-xs">
                                      <div className="flex justify-between text-[#A89F8C]">
                                        <span>Service Revenue:</span>
                                        <span className="font-semibold text-[#F5F0E8]">{formatCurrency(sd.serviceRevenue)}</span>
                                      </div>
                                      <div className="flex justify-between text-[#A89F8C]">
                                        <span>50% Base Share:</span>
                                        <span className="font-semibold text-[#F5F0E8]">{formatCurrency(0.5 * sd.serviceRevenue)}</span>
                                      </div>
                                      <div className="flex justify-between text-[#A89F8C]">
                                        <span>Product Cost Used:</span>
                                        <span className="font-bold text-[#E57373]">-{formatCurrency(sd.productCost)}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
