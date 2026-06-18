"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  ShieldCheck,
  Package,
  PiggyBank,
  TrendingUp,
  Users,
  RefreshCw,
  Receipt,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  Sparkles,
  BarChart3,
  Scissors,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Types ──────────────────────────────────────────────────────────────────
interface Invoice {
  id?: string;
  dateKey?: string;
  date: any;
  grandTotal: number;
  subtotal: number;
  paymentMethod?: string;
  paymentSplit?: { cash?: number; upi?: number; card?: number };
  payments?: { cash?: number; upi?: number; card?: number };
  services?: ServiceItem[];
  products?: ProductItem[];
}

interface ServiceItem {
  staffId?: string;
  staffName?: string;
  staffRole?: string;
  serviceId?: string;
  price?: number;
  amount?: number;
  discount?: number;
  usedProductCost?: number;
}

interface ProductItem {
  price?: number;
  quantity?: number;
  discount?: number;
  amount?: number;
}

interface DailyStat {
  dateKey: string;
  serviceRevenue?: number;
  productCost?: number;
  stylistShare?: number;
  ownerShare?: number;
  totalMembershipAmount?: number;
  retailProductsRevenue?: number;
}

interface StaffDetail {
  staffId: string;
  name: string;
  role: string;
  serviceRevenue: number;
  productCost: number;
  staffShare: number;
  ownerShareContribution: number;
}

interface DayDetails {
  ownerDirectRevenue: number;
  staffRevenueContribution: number;
  staffProductReimbursement: number;
  totalMembershipAmount: number;
  retailProductsRevenue: number;
  staffDetails: StaffDetail[];
}

interface StaffSplit {
  id?: string;
  name: string;
  todayShare: number;
  monthlyShare: number;
}

interface Expense {
  date: string;
  type: string;
  amount: number;
}

// ── Utilities ──────────────────────────────────────────────────────────────
function getInvoiceDateKeys(invoice: Invoice) {
  let dateKey = invoice.dateKey;
  if (!dateKey) {
    let d = new Date();
    if (invoice.date) {
      d =
        typeof invoice.date.toDate === "function"
          ? invoice.date.toDate()
          : new Date(invoice.date);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dateKey = `${yyyy}-${mm}-${dd}`;
  }
  return {
    dateKey,
    monthKey: dateKey.slice(0, 7),
  };
}

function getInvoicePayments(inv: Invoice) {
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

function getServiceCommission(s: ServiceItem, inv: Invoice) {
  const discountFactor =
    inv && inv.subtotal > 0 ? inv.grandTotal / inv.subtotal : 1;
  const serviceBaseAmount =
    s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
  const amount = serviceBaseAmount * discountFactor;
  const cost = s.usedProductCost || 0;

  let role = s.staffRole;
  if (!role) {
    if (
      s.serviceId === "membership_fee" ||
      s.staffId === "system" ||
      s.staffName === "System"
    ) {
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

// ── Sub-Components ─────────────────────────────────────────────────────────

function MetricCard({
  title,
  today,
  monthly,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  today: number;
  monthly: number;
  icon: React.ElementType;
  variant?: "default" | "danger" | "owner";
}) {
  const variants = {
    default: {
      border: "border-[#2E2B24] hover:border-[#B8962E]/30",
      iconBg: "bg-[#B8962E]/10 text-[#B8962E]",
      todayColor: "text-[#F5F0E8]",
      monthlyColor: "text-[#F5F0E8]",
    },
    danger: {
      border: "border-[#2E2B24] hover:border-[#E57373]/30",
      iconBg: "bg-[#E57373]/10 text-[#E57373]",
      todayColor: "text-[#E57373]",
      monthlyColor: "text-[#E57373]",
    },
    owner: {
      border: "border-[#4A3A10]/50 hover:border-[#B8962E]/40",
      iconBg: "bg-[#B8962E]/10 text-[#B8962E]",
      todayColor: "text-[#D4A935]",
      monthlyColor: "text-[#D4A935]",
    },
  };

  const v = variants[variant];

  return (
    <div
      className={`group rounded-2xl border ${v.border} bg-[#1C1A16] p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(184,150,46,0.06)]`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg p-2 ${v.iconBg}`}>
            <Icon size={16} strokeWidth={2.5} />
          </div>
          <h4 className="text-sm font-bold text-[#F5F0E8]">{title}</h4>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6358]">
            Today
          </span>
          <p className={`mt-1 text-lg font-black ${v.todayColor}`}>
            {formatCurrency(today)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6358]">
            This Month
          </span>
          <p className={`mt-1 text-lg font-black ${v.monthlyColor}`}>
            {formatCurrency(monthly)}
          </p>
        </div>
      </div>
    </div>
  );
}

function StaffSplitCard({ member }: { member: StaffSplit }) {
  return (
    <div className="group rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#B8962E]/30 hover:shadow-[0_8px_30px_rgba(184,150,46,0.06)]">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="rounded-lg bg-[#60A5FA]/10 p-2 text-[#60A5FA]">
          <Scissors size={16} strokeWidth={2.5} />
        </div>
        <h4 className="text-sm font-bold text-[#F5F0E8]">{member.name}</h4>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6358]">
            Today
          </span>
          <p className="mt-1 text-lg font-black text-[#60A5FA]">
            {formatCurrency(member.todayShare)}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#6B6358]">
            This Month
          </span>
          <p className="mt-1 text-lg font-black text-[#60A5FA]">
            {formatCurrency(member.monthlyShare)}
          </p>
        </div>
      </div>
    </div>
  );
}

function DayHeader({
  day,
  isToday,
  isExpanded,
  hasTransactions,
  onToggle,
}: {
  day: {
    date: string;
    totalServiceRevenue: number;
    totalMembershipAmount: number;
    totalRetailProductsRevenue: number;
    totalProductCost: number;
    totalStaffShare: number;
    totalOwnerShare: number;
  };
  isToday: boolean;
  isExpanded: boolean;
  hasTransactions: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={() => hasTransactions && onToggle()}
      className={`flex items-center justify-between p-5 select-none transition-colors ${
        hasTransactions
          ? "cursor-pointer hover:bg-[#1F1A0F]/30"
          : "opacity-50"
      }`}
    >
      <div className="flex items-center gap-3">
        {hasTransactions ? (
          <div
            className={`grid size-8 place-items-center rounded-lg border border-[#2E2B24] bg-[#131210] transition-all ${
              isExpanded ? "border-[#B8962E]/30 text-[#B8962E]" : "text-[#6B6358]"
            }`}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        ) : (
          <div className="size-8" />
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-[#F5F0E8]">
              {format(new Date(day.date + "T00:00:00"), "dd MMM yyyy")}
            </span>
            <span className="text-xs text-[#6B6358] font-medium">
              {format(new Date(day.date + "T00:00:00"), "EEEE")}
            </span>
            {isToday && (
              <span className="rounded-full bg-[#B8962E] px-2.5 py-0.5 text-[10px] font-extrabold text-[#0E0D0B] uppercase tracking-wider">
                Today
              </span>
            )}
          </div>
          {!hasTransactions && (
            <p className="text-[11px] text-[#6B6358] font-medium mt-0.5">
              No operations recorded
            </p>
          )}
        </div>
      </div>

      {hasTransactions && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="hidden md:flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Receipt size={12} className="text-[#6B6358]" />
              <span className="text-[#6B6358]">Service</span>
              <span className="font-bold text-[#F5F0E8]">
                {formatCurrency(day.totalServiceRevenue)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <PiggyBank size={12} className="text-[#6B6358]" />
              <span className="text-[#6B6358]">Membership</span>
              <span className="font-bold text-[#F5F0E8]">
                {formatCurrency(day.totalMembershipAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Package size={12} className="text-[#6B6358]" />
              <span className="text-[#6B6358]">Retail</span>
              <span className="font-bold text-[#F5F0E8]">
                {formatCurrency(day.totalRetailProductsRevenue)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-[#132A3A]/60 border border-[#2B5270]/40 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#60A5FA]">
                Staff{" "}
                <span className="text-[#60A5FA] font-extrabold ml-1">
                  {formatCurrency(day.totalStaffShare)}
                </span>
              </span>
            </div>
            <div className="rounded-xl bg-[#2E1A47]/60 border border-[#5E3E8C]/40 px-3 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C084FC]">
                Owner{" "}
                <span className="text-[#C084FC] font-extrabold ml-1">
                  {formatCurrency(day.totalOwnerShare)}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettlementDetailCard({
  title,
  value,
  icon: Icon,
  items,
  variant = "default",
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  items: { label: string; value: number; negative?: boolean }[];
  variant?: "default" | "owner";
}) {
  const isOwner = variant === "owner";

  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 transition-all hover:-translate-y-0.5 ${
        isOwner
          ? "border-[#4A3A10]/40 bg-[#1A1500]/60 hover:border-[#B8962E]/40"
          : "border-[#2E2B24] bg-[#131210] hover:border-[#B8962E]/30"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`rounded-lg p-1.5 ${
              isOwner ? "bg-[#B8962E]/10 text-[#D4A935]" : "bg-[#60A5FA]/10 text-[#60A5FA]"
            }`}
          >
            <Icon size={14} strokeWidth={2.5} />
          </div>
          <h4
            className={`font-extrabold text-sm ${
              isOwner ? "text-[#D4A935]" : "text-[#F5F0E8]"
            }`}
          >
            {title}
          </h4>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6358]">
            Net Share
          </span>
          <p
            className={`font-black text-xl mt-0.5 ${
              isOwner ? "text-[#D4A935]" : "text-[#F5F0E8]"
            }`}
          >
            {formatCurrency(value)}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#2E2B24] pt-3">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-[#A89F8C] font-medium">{item.label}</span>
            <span
              className={`font-bold ${
                item.negative ? "text-[#E57373]" : "text-[#F5F0E8]"
              }`}
            >
              {item.negative ? "−" : "+"}
              {formatCurrency(Math.abs(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-12 text-center shadow-sm">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] mb-4">
        <BarChart3 size={28} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-bold text-[#F5F0E8]">No Settlement History</p>
      <p className="text-xs text-[#6B6358] mt-1.5 max-w-xs mx-auto">
        There are no invoices or memberships recorded in the selected date range.
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SettlementsPage() {
  const { staff } = useAppData();
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<Record<string, DailyStat>>({});
  const [dayInvoicesMap, setDayInvoicesMap] = useState<Record<string, Invoice[]>>({});
  const [monthlyStaffShares, setMonthlyStaffShares] = useState<Record<string, number>>({});
  const [monthlyStatsTotals, setMonthlyStatsTotals] = useState({
    ownerShare: 0,
    membershipAmount: 0,
    retailProductsRevenue: 0,
    productsReturned: 0,
  });
  const [loadingDays, setLoadingDays] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyExpenses, setMonthlyExpenses] = useState<Expense[]>([]);

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(
    toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [dateTo, setDateTo] = useState(toLocalDateString(now));
  const todayStr = useMemo(() => toLocalDateString(new Date()), []);

  // ── Sync Handler ───────────────────────────────────────────────────────

  const handleSyncStats = useCallback(async () => {
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

        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = {
            totalRevenue: 0,
            totalVisits: 0,
            cash: 0,
            upi: 0,
            card: 0,
          };
        }
        monthlyStats[monthKey].totalRevenue += grandTotal;
        monthlyStats[monthKey].totalVisits += 1;
        monthlyStats[monthKey].cash += payments.cash;
        monthlyStats[monthKey].upi += payments.upi;
        monthlyStats[monthKey].card += payments.card;

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

        const discountFactor =
          inv.subtotal > 0 ? inv.grandTotal / inv.subtotal : 1;

        (inv.services || []).forEach((s: any) => {
          const comm = getServiceCommission(s, inv);
          dailyStats[dateKey].serviceRevenue += comm.serviceRevenue;
          dailyStats[dateKey].productCost += comm.productCost;
          dailyStats[dateKey].stylistShare += comm.stylistShare;
          dailyStats[dateKey].ownerShare += comm.ownerShare;
          if (
            s.serviceId === "membership_fee" ||
            s.staffId === "system" ||
            s.staffName === "System"
          ) {
            dailyStats[dateKey].totalMembershipAmount += comm.serviceRevenue;
          }
        });

        (inv.products || []).forEach((p: any) => {
          const productBaseAmount =
            p.amount ??
            Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
          const amount = productBaseAmount * discountFactor;
          dailyStats[dateKey].ownerShare += amount;
          dailyStats[dateKey].retailProductsRevenue += amount;
        });

        const staffInvoiceSummary: Record<string, any> = {};
        (inv.services || []).forEach((s: any) => {
          const staffId = s.staffId || "unassigned";
          if (!staffInvoiceSummary[staffId]) {
            staffInvoiceSummary[staffId] = {
              revenue: 0,
              servicesCount: 0,
              productCost: 0,
            };
          }
          const serviceBaseAmount =
            s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
          const amount = serviceBaseAmount * discountFactor;
          const cost = s.usedProductCost || 0;
          staffInvoiceSummary[staffId].revenue += amount;
          staffInvoiceSummary[staffId].servicesCount += 1;
          staffInvoiceSummary[staffId].productCost += cost;
        });

        Object.entries(staffInvoiceSummary).forEach(([staffId, summary]) => {
          const staffMonthKey = `${staffId}_${monthKey}`;
          if (!staffStats[staffMonthKey]) {
            staffStats[staffMonthKey] = {
              revenue: 0,
              servicesCount: 0,
              visits: 0,
              productCost: 0,
            };
          }
          staffStats[staffMonthKey].revenue += summary.revenue;
          staffStats[staffMonthKey].servicesCount += summary.servicesCount;
          staffStats[staffMonthKey].productCost += summary.productCost;
          staffStats[staffMonthKey].visits += 1;
        });
      });

      let currentBatch = writeBatch(db);
      let count = 0;

      const ops: { ref: any; data: any }[] = [];
      Object.entries(monthlyStats).forEach(([monthKey, stats]) => {
        ops.push({ ref: doc(db, "stats", `revenue_${monthKey}`), data: stats });
      });
      Object.entries(dailyStats).forEach(([dateKey, stats]) => {
        ops.push({ ref: doc(db, "stats", `daily_${dateKey}`), data: stats });
      });
      Object.entries(staffStats).forEach(([staffMonthKey, stats]) => {
        const [staffId, monthKey] = staffMonthKey.split("_");
        ops.push({
          ref: doc(db, "stats", `staff_${staffId}_${monthKey}`),
          data: stats,
        });
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
  }, []);

  // ── Data Loading ───────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const dailyQuery = query(
          collection(db, "stats"),
          where("dateKey", ">=", dateFrom),
          where("dateKey", "<=", dateTo)
        );
        const dailySnap = await getDocs(dailyQuery);
        const statsMap: Record<string, DailyStat> = {};
        dailySnap.forEach((d) => {
          const data = d.data() as DailyStat;
          if (data.dateKey) statsMap[data.dateKey] = data;
        });
        setDailyStats(statsMap);

        try {
          const todayInvoices = await invoicesService.getByDateKey(todayStr);
          setDayInvoicesMap((prev) => ({ ...prev, [todayStr]: todayInvoices }));
        } catch (err) {
          console.error("Failed to load today's invoices:", err);
        }

        const loadNow = new Date();
        const yyyy = loadNow.getFullYear();
        const mm = String(loadNow.getMonth() + 1).padStart(2, "0");
        const monthKey = `${yyyy}-${mm}`;

        const stylistStaff = staff.filter(
          (st) =>
            st.role !== "Owner" && st.id !== "system" && st.name !== "System"
        );

        const sharesMap: Record<string, number> = {};
        await Promise.all(
          stylistStaff.map(async (member) => {
            if (!member.id) return;
            try {
              const staffDocRef = doc(
                db,
                "stats",
                `staff_${member.id}_${monthKey}`
              );
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
              console.error(
                `Error loading monthly share for staff ${member.id}:`,
                err
              );
              sharesMap[member.id] = 0;
            }
          })
        );
        setMonthlyStaffShares(sharesMap);

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

        try {
          const startOfMonth = new Date(
            loadNow.getFullYear(),
            loadNow.getMonth(),
            1
          );
          const endOfMonth = new Date(
            loadNow.getFullYear(),
            loadNow.getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          );
          const monthlyExpensesData = await expensesService.getByDateRange(
            startOfMonth,
            endOfMonth
          );
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

  // ── Derived State ────────────────────────────────────────────────────────

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

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(
    () => ({
      [todayStr]: true,
    })
  );

  const toggleDayExpand = useCallback(
    async (dateStr: string) => {
      const isExpanded = !!expandedDays[dateStr];

      setExpandedDays((prev) => ({
        ...prev,
        [dateStr]: !prev[dateStr],
      }));

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
    },
    [expandedDays, dayInvoicesMap]
  );

  const getDayDetails = useCallback(
    (dateStr: string): DayDetails => {
      const dayInvoices = dayInvoicesMap[dateStr] || [];
      let ownerDirectRevenue = 0;
      let staffRevenueContribution = 0;
      let staffProductReimbursement = 0;
      let totalMembershipAmount = 0;
      let retailProductsRevenue = 0;
      const staffDetails: Record<string, StaffDetail> = {};

      dayInvoices.forEach((inv) => {
        const discountFactor =
          inv.subtotal > 0 ? inv.grandTotal / inv.subtotal : 1;

        (inv.products || []).forEach((p: any) => {
          const productBaseAmount =
            p.amount ??
            Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
          const amount = productBaseAmount * discountFactor;
          retailProductsRevenue += amount;
        });

        (inv.services || []).forEach((s: any) => {
          const serviceBaseAmount =
            s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
          const amount = serviceBaseAmount * discountFactor;
          const cost = s.usedProductCost || 0;
          const staffId = s.staffId || "unassigned";
          const staffName = s.staffName || "Unassigned";

          const staffMember = staff.find(
            (st) => st.id === staffId || st.name === staffName
          );
          const role = staffMember?.role || "Stylist";

          if (
            s.serviceId === "membership_fee" ||
            staffId === "system" ||
            staffName === "System"
          ) {
            totalMembershipAmount += amount;
            return;
          }

          const key = staffId !== "unassigned" ? staffId : staffName;
          if (!staffDetails[key]) {
            staffDetails[key] = {
              staffId,
              name: staffName,
              role,
              serviceRevenue: 0,
              productCost: 0,
              staffShare: 0,
              ownerShareContribution: 0,
            };
          }
          const sd = staffDetails[key];

          if (role === "Owner") {
            ownerDirectRevenue += amount;
            sd.serviceRevenue += amount;
            sd.productCost += cost;
            sd.ownerShareContribution += amount;
          } else {
            const staffShare = 0.5 * amount - cost;
            const ownerShare = 0.5 * amount + cost;
            staffRevenueContribution += 0.5 * amount;
            staffProductReimbursement += cost;
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
    },
    [staff, dayInvoicesMap]
  );

  const staffSplits = useMemo((): StaffSplit[] => {
    const stylistStaff = staff.filter(
      (st) =>
        st.role !== "Owner" && st.id !== "system" && st.name !== "System"
    );
    const todayInvoices = dayInvoicesMap[todayStr] || [];

    return stylistStaff.map((member) => {
      let todayShare = 0;
      todayInvoices.forEach((inv) => {
        const discountFactor =
          inv.subtotal > 0 ? inv.grandTotal / inv.subtotal : 1;
        (inv.services || []).forEach((s: any) => {
          if (s.staffId === member.id || s.staffName === member.name) {
            if (s.serviceId !== "membership_fee") {
              const serviceBaseAmount =
                s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
              const amount = serviceBaseAmount * discountFactor;
              const cost = s.usedProductCost || 0;
              todayShare += 0.5 * amount - cost;
            }
          }
        });
      });

      const monthlyShare = member.id ? monthlyStaffShares[member.id] || 0 : 0;

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
    const ownerShare =
      details.ownerDirectRevenue +
      details.staffRevenueContribution +
      details.staffProductReimbursement +
      details.totalMembershipAmount +
      details.retailProductsRevenue;

    return {
      ownerShare,
      membershipAmount: details.totalMembershipAmount,
      retailProductsRevenue: details.retailProductsRevenue,
      productsReturned: details.staffProductReimbursement,
    };
  }, [getDayDetails, todayStr]);

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

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
          <span className="text-xs font-medium text-[#6B6358] animate-pulse">
            Loading settlements...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-8 pb-12 text-[#F5F0E8]">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#2E2B24] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-[#B8962E]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B8962E]">
              Daily Operations
            </span>
          </div>
          <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Settlements
          </h1>
          <p className="mt-1 text-sm text-[#6B6358]">
            Revenue splits, commissions & daily breakdowns
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 py-2">
            <Calendar size={14} className="text-[#6B6358]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-[#2E2B24] bg-[#131210] px-2.5 text-xs font-semibold text-[#F5F0E8] outline-none focus:border-[#B8962E] transition"
            />
            <span className="text-[10px] font-bold text-[#6B6358] uppercase tracking-wider">
              to
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-lg border border-[#2E2B24] bg-[#131210] px-2.5 text-xs font-semibold text-[#F5F0E8] outline-none focus:border-[#B8962E] transition"
            />
          </div>

          <button
            onClick={handleSyncStats}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-bold text-[#A89F8C] transition hover:border-[#B8962E] hover:text-[#B8962E] disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={syncing ? "animate-spin" : ""}
            />
            {syncing ? "Syncing..." : "Sync Stats"}
          </button>
        </div>
      </header>

      {/* Owner & Staff Splits */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-[#B8962E]" />
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#A89F8C]">
            Owner & Staff Splits
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard
            title="Owner Settlement"
            today={todayMetrics.ownerShare - todayDailyExpenses}
            monthly={monthlyStatsTotals.ownerShare - monthDailyExpenses}
            icon={ShieldCheck}
            variant="owner"
          />
          {staffSplits.map((member) => (
            <StaffSplitCard key={member.id} member={member} />
          ))}
        </div>
      </section>

      {/* Revenue Metrics */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[#B8962E]" />
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#A89F8C]">
            Revenue Breakdown
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Membership Revenue"
            today={todayMetrics.membershipAmount}
            monthly={monthlyStatsTotals.membershipAmount}
            icon={PiggyBank}
          />
          <MetricCard
            title="Retail Product Sales"
            today={todayMetrics.retailProductsRevenue}
            monthly={monthlyStatsTotals.retailProductsRevenue}
            icon={Package}
          />
          <MetricCard
            title="Products Returned"
            today={todayMetrics.productsReturned}
            monthly={monthlyStatsTotals.productsReturned}
            icon={Package}
          />
          <MetricCard
            title="Daily Expenses"
            today={todayDailyExpenses}
            monthly={monthDailyExpenses}
            icon={TrendingUp}
            variant="danger"
          />
        </div>
      </section>

      {/* Daily Breakdown */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#B8962E]" />
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#A89F8C]">
              Daily Breakdown
            </h2>
          </div>
          <span className="text-[10px] font-bold text-[#6B6358] uppercase tracking-wider">
            {visibleSettlements.length} days
          </span>
        </div>

        <div className="space-y-3">
          {visibleSettlements.length === 0 ? (
            <EmptyState />
          ) : (
            visibleSettlements.map((day) => {
              const isToday = day.date === todayStr;
              const hasTransactions =
                day.totalServiceRevenue > 0 || day.totalMembershipAmount > 0;
              const isExpanded = !!expandedDays[day.date];

              return (
                <div
                  key={day.date}
                  className="overflow-hidden rounded-2xl border border-[#2E2B24] bg-[#1C1A16] shadow-sm transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                >
                  <DayHeader
                    day={day}
                    isToday={isToday}
                    isExpanded={isExpanded}
                    hasTransactions={hasTransactions}
                    onToggle={() => toggleDayExpand(day.date)}
                  />

                  {isExpanded && hasTransactions && (
                    <div className="border-t border-[#2E2B24] bg-[#131210]/40 p-5">
                      {loadingDays[day.date] ? (
                        <div className="flex h-24 items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="size-6 animate-spin rounded-full border-2 border-[#B8962E] border-t-transparent" />
                            <span className="text-[10px] text-[#6B6358] font-medium">
                              Loading details...
                            </span>
                          </div>
                        </div>
                      ) : (
                        (() => {
                          const details = getDayDetails(day.date);
                          return (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              <SettlementDetailCard
                                title="Owner Settlement"
                                value={day.totalOwnerShare}
                                icon={ShieldCheck}
                                variant="owner"
                                items={[
                                  {
                                    label: "Owner Direct Services",
                                    value: details.ownerDirectRevenue,
                                  },
                                  {
                                    label: "Stylists 50% Share",
                                    value: details.staffRevenueContribution,
                                  },
                                  {
                                    label: "Stylists Product Costs",
                                    value: details.staffProductReimbursement,
                                  },
                                  {
                                    label: "Membership Invoices",
                                    value: details.totalMembershipAmount,
                                  },
                                  {
                                    label: "Retail Product Sales",
                                    value: details.retailProductsRevenue,
                                  },
                                  {
                                    label: "Gross Share",
                                    value:
                                      details.ownerDirectRevenue +
                                      details.staffRevenueContribution +
                                      details.staffProductReimbursement +
                                      details.totalMembershipAmount +
                                      details.retailProductsRevenue,
                                  },
                                  {
                                    label: "Daily Expenses",
                                    value: dailyExpensesMap[day.date] || 0,
                                    negative: true,
                                  },
                                ]}
                              />

                              {details.staffDetails
                                .filter((sd) => sd.role !== "Owner")
                                .map((sd) => (
                                  <SettlementDetailCard
                                    key={sd.staffId}
                                    title={sd.name}
                                    value={sd.staffShare}
                                    icon={Users}
                                    items={[
                                      {
                                        label: "Service Revenue",
                                        value: sd.serviceRevenue,
                                      },
                                      {
                                        label: "50% Base Share",
                                        value: 0.5 * sd.serviceRevenue,
                                      },
                                      {
                                        label: "Product Cost Used",
                                        value: sd.productCost,
                                        negative: true,
                                      },
                                    ]}
                                  />
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
      </section>
    </div>
  );
}