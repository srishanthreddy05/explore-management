"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

/*
  AUGUST SETTLEMENT RECONCILIATION DEBUGGER

  Purpose:
  1. Check EVERY day in the selected month (including days with 0 invoices).
  2. Recalculate settlement amounts directly from invoices using the corrected
     cash-basis formula.
  3. Compare those values with /stats/daily_YYYY-MM-DD.
  4. Check services, stylist share, owner share, retail, membership,
     collected/unpaid amounts and product cost.
  5. Show invoice-level mismatches so the exact invoice causing a difference
     can be found.

  IMPORTANT:
  - s.amount is treated as the already-calculated service amount when present.
  - p.amount is treated as the already-calculated retail amount when present.
  - Payment ratio is applied ONCE because settlements are cash-basis.
  - discountFactor is ONLY a fallback for legacy records that do not have
    s.amount / p.amount.
*/

const EPS = 0.01;

function num(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: any): string {
  return `₹${num(value).toFixed(2)}`;
}

function pct(value: any): string {
  return `${(num(value) * 100).toFixed(2)}%`;
}

function diff(a: number, b: number): number {
  return num(a) - num(b);
}

function isMatch(a: number, b: number): boolean {
  return Math.abs(diff(a, b)) <= EPS;
}

function getInvoicePayments(inv: any) {
  if (!inv) return { cash: 0, upi: 0, card: 0 };

  return {
    cash:
      inv.paymentSplit?.cash ??
      inv.payments?.cash ??
      (inv.paymentMethod === "Cash" ? num(inv.grandTotal) : 0),

    upi:
      inv.paymentSplit?.upi ??
      inv.payments?.upi ??
      (inv.paymentMethod === "UPI" ? num(inv.grandTotal) : 0),

    card:
      inv.paymentSplit?.card ??
      inv.payments?.card ??
      (inv.paymentMethod === "Card" ? num(inv.grandTotal) : 0),
  };
}

function getInvoicePaymentRatio(inv: any): number {
  const grandTotal = num(inv?.grandTotal);
  if (grandTotal <= 0) return 1;

  const payments = getInvoicePayments(inv);

  const collected =
    num(payments.cash) +
    num(payments.upi) +
    num(payments.card) +
    num(inv?.advanceUsed);

  return Math.min(1, Math.max(0, collected / grandTotal));
}

function getRole(s: any): "Owner" | "Stylist" {
  if (s?.staffRole === "Owner") return "Owner";
  if (s?.staffRole === "Stylist") return "Stylist";

  if (
    s?.serviceId === "membership_fee" ||
    s?.staffId === "system" ||
    s?.staffName === "System"
  ) {
    return "Owner";
  }

  return "Stylist";
}

/**
 * Correct service amount:
 * - If s.amount exists, it is already the post-discount amount.
 * - Only legacy services without s.amount use discountFactor.
 */
function getCorrectServiceAmount(s: any, inv: any): number {
  if (s?.amount !== undefined && s?.amount !== null) {
    return num(s.amount);
  }

  const base = Math.max(num(s?.price) - num(s?.discount), 0);
  const subtotal = num(inv?.subtotal);
  const grandTotal = num(inv?.grandTotal);
  const discountFactor = subtotal > 0 ? grandTotal / subtotal : 1;

  return base * discountFactor;
}

/**
 * Correct retail amount:
 * - If p.amount exists, use it directly.
 * - Otherwise calculate legacy price*qty-discount.
 */
function getCorrectProductAmount(p: any, inv: any): number {
  if (p?.amount !== undefined && p?.amount !== null) {
    return num(p.amount);
  }

  const base = Math.max(
    num(p?.price) * Math.max(num(p?.quantity) || 1, 1) - num(p?.discount),
    0
  );

  const subtotal = num(inv?.subtotal);
  const grandTotal = num(inv?.grandTotal);
  const discountFactor = subtotal > 0 ? grandTotal / subtotal : 1;

  return base * discountFactor;
}

function getLegacyCurrentServiceAmount(s: any, inv: any): number {
  const base =
    s?.amount !== undefined && s?.amount !== null
      ? num(s.amount)
      : Math.max(num(s?.price) - num(s?.discount), 0);

  const subtotal = num(inv?.subtotal);
  const grandTotal = num(inv?.grandTotal);
  const discountFactor = subtotal > 0 ? grandTotal / subtotal : 1;

  return base * discountFactor;
}

function getMembershipAmount(inv: any): number {
  /*
    We only count an explicit membership amount here.
    This avoids guessing that a normal service is membership revenue.

    Supported explicit fields:
    - inv.membershipRevenue
    - inv.membershipAmount
    - inv.membershipFee
  */
  const explicit =
    inv?.membershipRevenue ??
    inv?.membershipAmount ??
    inv?.membershipFee;

  if (explicit !== undefined && explicit !== null) {
    return num(explicit) * getInvoicePaymentRatio(inv);
  }

  return 0;
}

function getExpenseFromStats(stats: any): number | null {
  if (!stats) return null;

  const candidates = [
    stats.dailyExpenses,
    stats.expenses,
    stats.totalExpenses,
    stats.dailyExpense,
  ];

  for (const value of candidates) {
    if (value !== undefined && value !== null) return num(value);
  }

  return null;
}

function getStatsRetail(stats: any): number {
  return num(
    stats?.retailProductsRevenue ??
    stats?.totalRetailProductsRevenue ??
    stats?.retailRevenue ??
    0
  );
}

function getStatsMembership(stats: any): number {
  return num(
    stats?.membershipRevenue ??
    stats?.totalMembershipRevenue ??
    stats?.membershipSales ??
    0
  );
}

interface InvoiceCheck {
  id: string;
  dateKey: string;
  invoiceNumber: string;
  customerName: string;

  grandTotal: number;
  collected: number;
  unpaid: number;
  ratio: number;

  storedServices: number;
  storedProducts: number;

  correctServiceRevenue: number;
  correctStylistShare: number;
  correctOwnerServiceShare: number;
  correctRetailRevenue: number;
  correctMembershipRevenue: number;
  correctProductCost: number;

  currentServiceRevenue: number;
  currentStylistShare: number;
  currentOwnerServiceShare: number;

  serviceFormulaDiff: number;
  stylistFormulaDiff: number;
  ownerFormulaDiff: number;

  retailProducts: any[];
  services: any[];
}

interface DailyCheck {
  dateKey: string;
  invoiceCount: number;

  invoiceGrandTotal: number;
  collected: number;
  unpaid: number;

  storedServiceTotal: number;
  storedProductTotal: number;

  serviceRevenue: number;
  stylistShare: number;
  ownerServiceShare: number;
  retailRevenue: number;
  membershipRevenue: number;
  productCost: number;

  currentServiceRevenue: number;
  currentStylistShare: number;
  currentOwnerServiceShare: number;

  statsStylistShare: number | null;
  statsOwnerShare: number | null;
  statsRetailRevenue: number | null;
  statsMembershipRevenue: number | null;
  statsExpenses: number | null;

  stylistDiff: number | null;
  ownerDiff: number | null;
  retailDiff: number | null;
  membershipDiff: number | null;

  splitBalance: number;
  status: "MATCH" | "MISMATCH";
}

export default function SettlementReconciliationPage() {
  const [selectedMonth, setSelectedMonth] = useState("2026-08");
  const [invoices, setInvoices] = useState<InvoiceCheck[]>([]);
  const [statsByDate, setStatsByDate] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(year, month, 0).getDate();

        const startDate = `${selectedMonth}-01`;
        const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

        // ---------------------------------------------------------------
        // 1. LOAD ALL INVOICES
        // ---------------------------------------------------------------
        const invoiceSnap = await getDocs(collection(db, "invoices"));

        const invoiceChecks: InvoiceCheck[] = [];

        invoiceSnap.forEach((docSnap) => {
          const inv = docSnap.data() as any;
          const dateKey = String(inv?.dateKey || "");

          if (dateKey < startDate || dateKey > endDate) return;

          const payments = getInvoicePayments(inv);
          const collected =
            num(payments.cash) +
            num(payments.upi) +
            num(payments.card) +
            num(inv?.advanceUsed);

          const ratio = getInvoicePaymentRatio(inv);

          let correctServiceRevenue = 0;
          let correctStylistShare = 0;
          let correctOwnerServiceShare = 0;
          let correctProductCost = 0;

          let currentServiceRevenue = 0;
          let currentStylistShare = 0;
          let currentOwnerServiceShare = 0;

          const services = (inv?.services || []).map((s: any, index: number) => {
            const role = getRole(s);
            const correctAmount = getCorrectServiceAmount(s, inv);
            const currentAmount = getLegacyCurrentServiceAmount(s, inv);
            const cost = num(s?.usedProductCost);

            let correctStylist = 0;
            let correctOwner = 0;
            let currentStylist = 0;
            let currentOwner = 0;

            if (role === "Owner") {
              correctOwner = correctAmount;
              currentOwner = currentAmount;
            } else {
              correctStylist = 0.5 * correctAmount - cost;
              correctOwner = 0.5 * correctAmount + cost;

              currentStylist = 0.5 * currentAmount - cost;
              currentOwner = 0.5 * currentAmount + cost;
            }

            const correctCollectedAmount = correctAmount * ratio;
            const currentCollectedAmount = currentAmount * ratio;

            correctServiceRevenue += correctCollectedAmount;
            correctStylistShare += correctStylist * ratio;
            correctOwnerServiceShare += correctOwner * ratio;
            correctProductCost += cost * ratio;

            currentServiceRevenue += currentCollectedAmount;
            currentStylistShare += currentStylist * ratio;
            currentOwnerServiceShare += currentOwner * ratio;

            return {
              index,
              serviceName: s?.serviceName || s?.serviceId || "—",
              staffName: s?.staffName || "—",
              staffId: s?.staffId || "—",
              role,
              roleMissing: !s?.staffRole,

              price: num(s?.price),
              discount: num(s?.discount),
              storedAmount:
                s?.amount === undefined || s?.amount === null
                  ? null
                  : num(s.amount),

              correctAmount,
              correctCollectedAmount,

              currentAmount,
              currentCollectedAmount,

              usedProductCost: cost,
              collectedProductCost: cost * ratio,

              stylistShare: correctStylist * ratio,
              ownerShare: correctOwner * ratio,

              currentStylistShare: currentStylist * ratio,
              currentOwnerShare: currentOwner * ratio,

              formulaDiff:
                (correctAmount - currentAmount) * ratio,
            };
          });

          const retailProducts = inv?.products || [];

          const correctRetailRevenue = retailProducts.reduce(
            (sum: number, p: any) =>
              sum + getCorrectProductAmount(p, inv) * ratio,
            0
          );

          const storedServiceTotal = (inv?.services || []).reduce(
            (sum: number, s: any) => sum + num(s?.amount),
            0
          );

          const storedProductTotal = retailProducts.reduce(
            (sum: number, p: any) => sum + num(p?.amount),
            0
          );

          invoiceChecks.push({
            id: docSnap.id,
            dateKey,
            invoiceNumber: inv?.invoiceNumber || docSnap.id,
            customerName: inv?.customerName || "—",

            grandTotal: num(inv?.grandTotal),
            collected,
            unpaid: Math.max(num(inv?.grandTotal) - collected, 0),
            ratio,

            storedServices: num(inv?.totalServices),
            storedProducts: num(inv?.totalProducts),

            correctServiceRevenue,
            correctStylistShare,
            correctOwnerServiceShare,
            correctRetailRevenue,
            correctMembershipRevenue: getMembershipAmount(inv),
            correctProductCost,

            currentServiceRevenue,
            currentStylistShare,
            currentOwnerServiceShare,

            serviceFormulaDiff:
              correctServiceRevenue - currentServiceRevenue,
            stylistFormulaDiff:
              correctStylistShare - currentStylistShare,
            ownerFormulaDiff:
              correctOwnerServiceShare - currentOwnerServiceShare,

            retailProducts,
            services,
          });
        });

        invoiceChecks.sort(
          (a, b) =>
            b.dateKey.localeCompare(a.dateKey) ||
            a.invoiceNumber.localeCompare(b.invoiceNumber)
        );

        setInvoices(invoiceChecks);

        // ---------------------------------------------------------------
        // 2. LOAD ALL DAILY STATS
        // ---------------------------------------------------------------
        const statsSnap = await getDocs(collection(db, "stats"));
        const statsMap: Record<string, any> = {};

        statsSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;

          const dateKey =
            data?.dateKey ||
            (docSnap.id.startsWith("daily_")
              ? docSnap.id.replace("daily_", "")
              : "");

          if (dateKey >= startDate && dateKey <= endDate) {
            statsMap[dateKey] = {
              ...data,
              _docId: docSnap.id,
            };
          }
        });

        setStatsByDate(statsMap);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [selectedMonth]);

  const days = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    const map: Record<string, DailyCheck> = {};

    // IMPORTANT:
    // Create ALL calendar days, not only days containing invoices.
    for (let day = 1; day <= lastDay; day++) {
      const dateKey = `${selectedMonth}-${String(day).padStart(2, "0")}`;

      map[dateKey] = {
        dateKey,
        invoiceCount: 0,

        invoiceGrandTotal: 0,
        collected: 0,
        unpaid: 0,

        storedServiceTotal: 0,
        storedProductTotal: 0,

        serviceRevenue: 0,
        stylistShare: 0,
        ownerServiceShare: 0,
        retailRevenue: 0,
        membershipRevenue: 0,
        productCost: 0,

        currentServiceRevenue: 0,
        currentStylistShare: 0,
        currentOwnerServiceShare: 0,

        statsStylistShare: null,
        statsOwnerShare: null,
        statsRetailRevenue: null,
        statsMembershipRevenue: null,
        statsExpenses: null,

        stylistDiff: null,
        ownerDiff: null,
        retailDiff: null,
        membershipDiff: null,

        splitBalance: 0,
        status: "MATCH",
      };
    }

    invoices.forEach((inv) => {
      const d = map[inv.dateKey];
      if (!d) return;

      d.invoiceCount += 1;
      d.invoiceGrandTotal += inv.grandTotal;
      d.collected += inv.collected;
      d.unpaid += inv.unpaid;

      d.storedServiceTotal += inv.storedServices;
      d.storedProductTotal += inv.storedProducts;

      d.serviceRevenue += inv.correctServiceRevenue;
      d.stylistShare += inv.correctStylistShare;
      d.ownerServiceShare += inv.correctOwnerServiceShare;
      d.retailRevenue += inv.correctRetailRevenue;
      d.membershipRevenue += inv.correctMembershipRevenue;
      d.productCost += inv.correctProductCost;

      d.currentServiceRevenue += inv.currentServiceRevenue;
      d.currentStylistShare += inv.currentStylistShare;
      d.currentOwnerServiceShare += inv.currentOwnerServiceShare;
    });

    Object.values(map).forEach((d) => {
      const stats = statsByDate[d.dateKey];

      if (stats) {
        d.statsStylistShare = num(stats.stylistShare);
        d.statsOwnerShare = num(stats.ownerShare);
        d.statsRetailRevenue = getStatsRetail(stats);
        d.statsMembershipRevenue = getStatsMembership(stats);
        d.statsExpenses = getExpenseFromStats(stats);

        d.stylistDiff = d.stylistShare - d.statsStylistShare;
        d.ownerDiff = d.ownerServiceShare + d.retailRevenue + d.membershipRevenue - d.statsOwnerShare;
        d.retailDiff = d.retailRevenue - d.statsRetailRevenue;
        d.membershipDiff = d.membershipRevenue - d.statsMembershipRevenue;
      }

      d.splitBalance =
        d.ownerServiceShare + d.stylistShare - d.serviceRevenue;

      const checks = [
        Math.abs(d.splitBalance) <= EPS,
        d.stylistDiff === null || Math.abs(d.stylistDiff) <= EPS,
        d.ownerDiff === null || Math.abs(d.ownerDiff) <= EPS,
        d.retailDiff === null || Math.abs(d.retailDiff) <= EPS,
        d.membershipDiff === null || Math.abs(d.membershipDiff) <= EPS,
      ];

      d.status = checks.every(Boolean) ? "MATCH" : "MISMATCH";
    });

    return Object.values(map);
  }, [invoices, statsByDate, selectedMonth]);

  const monthTotals = useMemo(() => {
    return days.reduce(
      (a, d) => {
        a.invoices += d.invoiceCount;
        a.grandTotal += d.invoiceGrandTotal;
        a.collected += d.collected;
        a.unpaid += d.unpaid;

        a.serviceRevenue += d.serviceRevenue;
        a.stylistShare += d.stylistShare;
        a.ownerServiceShare += d.ownerServiceShare;
        a.retailRevenue += d.retailRevenue;
        a.membershipRevenue += d.membershipRevenue;
        a.productCost += d.productCost;

        a.statsStylist += num(d.statsStylistShare);
        a.statsOwner += num(d.statsOwnerShare);
        a.statsRetail += num(d.statsRetailRevenue);
        a.statsMembership += num(d.statsMembershipRevenue);

        return a;
      },
      {
        invoices: 0,
        grandTotal: 0,
        collected: 0,
        unpaid: 0,
        serviceRevenue: 0,
        stylistShare: 0,
        ownerServiceShare: 0,
        retailRevenue: 0,
        membershipRevenue: 0,
        productCost: 0,
        statsStylist: 0,
        statsOwner: 0,
        statsRetail: 0,
        statsMembership: 0,
      }
    );
  }, [days]);

  const mismatchDays = days.filter((d) => d.status === "MISMATCH");
  const missingStatsDays = days.filter(
    (d) => !statsByDate[d.dateKey]
  );

  const selectedDateInvoices = expandedDate
    ? invoices.filter((inv) => inv.dateKey === expandedDate)
    : [];

  const cell =
    "border border-gray-700 px-2 py-1 text-xs whitespace-nowrap";
  const hcell =
    "border border-gray-600 px-2 py-2 text-xs font-bold bg-gray-800 text-yellow-400 whitespace-nowrap";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-8">
        Loading August reconciliation…
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-red-400 p-8">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-8 font-mono text-xs">

      {/* AI DIAGNOSTICS */}
      <div className="border-2 border-red-500 rounded p-4 space-y-4 bg-red-950/30">
        <h2 className="text-red-400 font-bold text-xl">
          🚨 AI ANOMALY DETECTOR 🚨
        </h2>

        <div>
          <h3 className="text-yellow-400 font-bold text-lg border-b border-gray-700 pb-2 mb-2">
            ISSUE 2 — INVOICE EXP-260806-013 INSPECTION
          </h3>
          <p className="text-gray-300 mb-2">
            Please paste the following JSON block back to the chat so I can analyze why collected=450 but grandTotal=400.
          </p>
          <div className="space-y-2">
            {(() => {
              // We search through the original invoice snap to get raw fields
              const targetInvCheck = invoices.find(inv => inv.invoiceNumber === "EXP-260806-013" || inv.id === "EXP-260806-013");
              if (!targetInvCheck) return <div className="text-gray-400">Invoice EXP-260806-013 not found in current month.</div>;
              
              return (
                <div className="bg-black/80 p-4 rounded border border-yellow-600 font-mono text-xs overflow-auto max-h-96">
                  <pre className="text-green-400">
                    {JSON.stringify({
                      invoiceNumber: targetInvCheck.invoiceNumber,
                      grandTotal: targetInvCheck.grandTotal,
                      collected: targetInvCheck.collected,
                      ratio: targetInvCheck.ratio,
                      services: targetInvCheck.services,
                      retailProducts: targetInvCheck.retailProducts
                    }, null, 2)}
                  </pre>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Settlement Reconciliation — {selectedMonth}
          </h1>
          <p className="text-gray-400 mt-1">
            Invoice source vs daily stats source — every calendar day
          </p>
        </div>

        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
        />
      </div>

      {/* STATUS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border border-gray-700 rounded p-4">
          <div className="text-gray-500 font-bold">INVOICES</div>
          <div className="text-2xl font-bold">{monthTotals.invoices}</div>
        </div>

        <div className="border border-gray-700 rounded p-4">
          <div className="text-gray-500 font-bold">COLLECTED</div>
          <div className="text-2xl font-bold text-green-400">
            {money(monthTotals.collected)}
          </div>
        </div>

        <div className="border border-gray-700 rounded p-4">
          <div className="text-gray-500 font-bold">UNPAID</div>
          <div className="text-2xl font-bold text-orange-400">
            {money(monthTotals.unpaid)}
          </div>
        </div>

        <div className="border border-gray-700 rounded p-4">
          <div className="text-gray-500 font-bold">MISMATCH DAYS</div>
          <div className={`text-2xl font-bold ${mismatchDays.length ? "text-red-400" : "text-green-400"
            }`}>
            {mismatchDays.length}
          </div>
        </div>

        <div className="border border-gray-700 rounded p-4">
          <div className="text-gray-500 font-bold">MISSING STATS DAYS</div>
          <div className={`text-2xl font-bold ${missingStatsDays.length ? "text-orange-400" : "text-green-400"
            }`}>
            {missingStatsDays.length}
          </div>
        </div>
      </div>

      {/* MONTH TOTALS */}
      <div className="border border-yellow-600 rounded p-4 space-y-4">
        <h2 className="text-yellow-400 font-bold text-lg">
          MONTH TOTALS — INVOICE/CORRECT FORMULA
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            Service Revenue
            <div className="text-lg font-bold">
              {money(monthTotals.serviceRevenue)}
            </div>
          </div>

          <div>
            Stylist Share
            <div className="text-lg font-bold">
              {money(monthTotals.stylistShare)}
            </div>
          </div>

          <div>
            Owner Service Share
            <div className="text-lg font-bold">
              {money(monthTotals.ownerServiceShare)}
            </div>
          </div>

          <div>
            Retail
            <div className="text-lg font-bold">
              {money(monthTotals.retailRevenue)}
            </div>
          </div>

          <div>
            Membership
            <div className="text-lg font-bold">
              {money(monthTotals.membershipRevenue)}
            </div>
          </div>

          <div>
            Product Cost
            <div className="text-lg font-bold">
              {money(monthTotals.productCost)}
            </div>
          </div>

          <div>
            Stats Stylist
            <div className="text-lg font-bold">
              {money(monthTotals.statsStylist)}
            </div>
          </div>

          <div>
            Stats Owner
            <div className="text-lg font-bold">
              {money(monthTotals.statsOwner)}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-gray-500">SERVICE SPLIT CHECK</div>
            <div className={
              isMatch(
                monthTotals.ownerServiceShare + monthTotals.stylistShare,
                monthTotals.serviceRevenue
              )
                ? "text-green-400 font-bold"
                : "text-red-400 font-bold"
            }>
              {money(
                monthTotals.ownerServiceShare +
                monthTotals.stylistShare -
                monthTotals.serviceRevenue
              )}
            </div>
          </div>

          <div>
            <div className="text-gray-500">STYLIST STATS DIFF</div>
            <div className={
              isMatch(monthTotals.stylistShare, monthTotals.statsStylist)
                ? "text-green-400 font-bold"
                : "text-red-400 font-bold"
            }>
              {money(monthTotals.stylistShare - monthTotals.statsStylist)}
            </div>
          </div>

          <div>
            <div className="text-gray-500">OWNER STATS DIFF</div>
            <div className={
              isMatch(
                monthTotals.ownerServiceShare +
                monthTotals.retailRevenue +
                monthTotals.membershipRevenue,
                monthTotals.statsOwner
              )
                ? "text-green-400 font-bold"
                : "text-red-400 font-bold"
            }>
              {money(
                monthTotals.ownerServiceShare +
                monthTotals.retailRevenue +
                monthTotals.membershipRevenue -
                monthTotals.statsOwner
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ALL DAYS */}
      <div className="border border-yellow-600 rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-yellow-400 font-bold text-lg">
            EVERY DAY — {selectedMonth}
          </h2>

          <div className="text-gray-400">
            Green = matches stats within ₹0.01
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={hcell}>Date</th>
                <th className={hcell}>Inv</th>
                <th className={hcell}>Grand Total</th>
                <th className={hcell}>Collected</th>
                <th className={hcell}>Unpaid</th>
                <th className={hcell}>Service</th>
                <th className={hcell}>Stylist</th>
                <th className={hcell}>Stats Stylist</th>
                <th className={hcell}>Stylist Diff</th>
                <th className={hcell}>Owner Services</th>
                <th className={hcell}>Retail</th>
                <th className={hcell}>Stats Retail</th>
                <th className={hcell}>Retail Diff</th>
                <th className={hcell}>Owner Total</th>
                <th className={hcell}>Stats Owner</th>
                <th className={hcell}>Owner Diff</th>
                <th className={hcell}>Split Check</th>
                <th className={hcell}>Status</th>
              </tr>
            </thead>

            <tbody>
              {days.map((d) => (
                <tr
                  key={d.dateKey}
                  onClick={() =>
                    setExpandedDate(
                      expandedDate === d.dateKey ? null : d.dateKey
                    )
                  }
                  className="cursor-pointer hover:bg-gray-900"
                >
                  <td className={cell}>{d.dateKey}</td>
                  <td className={cell}>{d.invoiceCount}</td>
                  <td className={cell}>{money(d.invoiceGrandTotal)}</td>
                  <td className={cell}>{money(d.collected)}</td>
                  <td className={`${cell} ${d.unpaid > EPS ? "text-orange-400" : ""
                    }`}>
                    {money(d.unpaid)}
                  </td>

                  <td className={cell}>{money(d.serviceRevenue)}</td>

                  <td className={cell}>{money(d.stylistShare)}</td>
                  <td className={cell}>
                    {d.statsStylistShare === null
                      ? "N/A"
                      : money(d.statsStylistShare)}
                  </td>
                  <td className={`${cell} ${d.stylistDiff !== null &&
                      Math.abs(d.stylistDiff) > EPS
                      ? "text-red-400 font-bold"
                      : "text-green-400"
                    }`}>
                    {d.stylistDiff === null
                      ? "N/A"
                      : money(d.stylistDiff)}
                  </td>

                  <td className={cell}>{money(d.ownerServiceShare)}</td>

                  <td className={cell}>{money(d.retailRevenue)}</td>
                  <td className={cell}>
                    {d.statsRetailRevenue === null
                      ? "N/A"
                      : money(d.statsRetailRevenue)}
                  </td>
                  <td className={`${cell} ${d.retailDiff !== null &&
                      Math.abs(d.retailDiff) > EPS
                      ? "text-red-400 font-bold"
                      : "text-green-400"
                    }`}>
                    {d.retailDiff === null
                      ? "N/A"
                      : money(d.retailDiff)}
                  </td>

                  <td className={cell}>
                    {money(
                      d.ownerServiceShare +
                      d.retailRevenue +
                      d.membershipRevenue
                    )}
                  </td>

                  <td className={cell}>
                    {d.statsOwnerShare === null
                      ? "N/A"
                      : money(d.statsOwnerShare)}
                  </td>

                  <td className={`${cell} ${d.ownerDiff !== null &&
                      Math.abs(d.ownerDiff) > EPS
                      ? "text-red-400 font-bold"
                      : "text-green-400"
                    }`}>
                    {d.ownerDiff === null
                      ? "N/A"
                      : money(d.ownerDiff)}
                  </td>

                  <td className={`${cell} ${Math.abs(d.splitBalance) <= EPS
                      ? "text-green-400"
                      : "text-red-400 font-bold"
                    }`}>
                    {Math.abs(d.splitBalance) <= EPS
                      ? "MATCH"
                      : money(d.splitBalance)}
                  </td>

                  <td className={`${cell} font-bold ${d.status === "MATCH"
                      ? "text-green-400"
                      : "text-red-400"
                    }`}>
                    {d.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPANDED DAY */}
      {expandedDate && (
        <div className="border border-blue-600 rounded p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-blue-400 font-bold text-lg">
              {expandedDate} — INVOICE DETAILS
            </h2>

            <button
              onClick={() => setExpandedDate(null)}
              className="border border-gray-600 rounded px-3 py-1"
            >
              Close
            </button>
          </div>

          {selectedDateInvoices.length === 0 ? (
            <div className="text-gray-400">
              No invoices on this date.
            </div>
          ) : (
            selectedDateInvoices.map((inv) => (
              <div
                key={inv.id}
                className="border border-gray-700 rounded p-4 space-y-4"
              >
                {/* INVOICE HEADER */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    Invoice
                    <div className="text-yellow-400 font-bold">
                      {inv.invoiceNumber}
                    </div>
                  </div>

                  <div>
                    Customer
                    <div>{inv.customerName}</div>
                  </div>

                  <div>
                    Grand Total
                    <div className="font-bold">
                      {money(inv.grandTotal)}
                    </div>
                  </div>

                  <div>
                    Collected
                    <div className="text-green-400 font-bold">
                      {money(inv.collected)}
                    </div>
                  </div>

                  <div>
                    Ratio
                    <div className="text-blue-400 font-bold">
                      {pct(inv.ratio)}
                    </div>
                  </div>

                  <div>
                    Unpaid
                    <div className="text-orange-400 font-bold">
                      {money(inv.unpaid)}
                    </div>
                  </div>

                  <div>
                    Stored Service Total
                    <div>{money(inv.storedServices)}</div>
                  </div>

                  <div>
                    Stored Product Total
                    <div>{money(inv.storedProducts)}</div>
                  </div>

                  <div>
                    Correct Service Revenue
                    <div className="text-green-400 font-bold">
                      {money(inv.correctServiceRevenue)}
                    </div>
                  </div>

                  <div>
                    Correct Retail
                    <div className="text-green-400 font-bold">
                      {money(inv.correctRetailRevenue)}
                    </div>
                  </div>
                </div>

                {/* SERVICES */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={hcell}>#</th>
                        <th className={hcell}>Service</th>
                        <th className={hcell}>Staff</th>
                        <th className={hcell}>Role</th>
                        <th className={hcell}>Price</th>
                        <th className={hcell}>Discount</th>
                        <th className={hcell}>Stored Amount</th>
                        <th className={hcell}>Correct Amount</th>
                        <th className={hcell}>Ratio</th>
                        <th className={hcell}>Collected</th>
                        <th className={hcell}>Stylist</th>
                        <th className={hcell}>Owner</th>
                        <th className={hcell}>Product Cost</th>
                        <th className={hcell}>Current Amount</th>
                        <th className={hcell}>Formula Diff</th>
                      </tr>
                    </thead>

                    <tbody>
                      {inv.services.map((s: any) => (
                        <tr
                          key={s.index}
                          className={
                            s.roleMissing
                              ? "bg-red-900/20"
                              : ""
                          }
                        >
                          <td className={cell}>{s.index}</td>
                          <td className={cell}>{s.serviceName}</td>
                          <td className={cell}>{s.staffName}</td>
                          <td className={`${cell} ${s.role === "Owner"
                              ? "text-yellow-400"
                              : "text-blue-400"
                            }`}>
                            {s.role}{s.roleMissing ? " ⚠" : ""}
                          </td>
                          <td className={cell}>{money(s.price)}</td>
                          <td className={cell}>{money(s.discount)}</td>
                          <td className={cell}>
                            {s.storedAmount === null
                              ? "MISSING"
                              : money(s.storedAmount)}
                          </td>
                          <td className={cell}>
                            {money(s.correctAmount)}
                          </td>
                          <td className={cell}>{pct(inv.ratio)}</td>
                          <td className={cell}>
                            {money(s.correctCollectedAmount)}
                          </td>
                          <td className={cell}>
                            {money(s.stylistShare)}
                          </td>
                          <td className={cell}>
                            {money(s.ownerShare)}
                          </td>
                          <td className={cell}>
                            {money(s.collectedProductCost)}
                          </td>
                          <td className={cell}>
                            {money(s.currentAmount)}
                          </td>
                          <td className={`${cell} ${Math.abs(s.formulaDiff) > EPS
                              ? "text-red-400 font-bold"
                              : "text-green-400"
                            }`}>
                            {money(s.formulaDiff)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PRODUCTS */}
                {inv.retailProducts.length > 0 && (
                  <div className="border border-purple-700 rounded p-3">
                    <div className="text-purple-400 font-bold mb-2">
                      RETAIL PRODUCTS — 100% OWNER
                    </div>

                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={hcell}>Product</th>
                          <th className={hcell}>Price</th>
                          <th className={hcell}>Qty</th>
                          <th className={hcell}>Discount</th>
                          <th className={hcell}>Stored Amount</th>
                          <th className={hcell}>Correct Amount</th>
                          <th className={hcell}>Collected</th>
                        </tr>
                      </thead>

                      <tbody>
                        {inv.retailProducts.map((p: any, i: number) => {
                          const base = getCorrectProductAmount(p, {
                            subtotal: 0,
                            grandTotal: 0,
                          });

                          const stored =
                            p?.amount !== undefined &&
                              p?.amount !== null
                              ? num(p.amount)
                              : null;

                          const ratio = inv.ratio;

                          return (
                            <tr key={i}>
                              <td className={cell}>
                                {p?.productName || p?.product || "—"}
                              </td>
                              <td className={cell}>
                                {money(p?.price)}
                              </td>
                              <td className={cell}>
                                {num(p?.quantity) || 1}
                              </td>
                              <td className={cell}>
                                {money(p?.discount)}
                              </td>
                              <td className={cell}>
                                {stored === null
                                  ? "MISSING"
                                  : money(stored)}
                              </td>
                              <td className={cell}>
                                {money(base)}
                              </td>
                              <td className={cell}>
                                {money(base * ratio)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="mt-2 text-green-400 font-bold">
                      Correct collected retail:
                      {" "}
                      {money(inv.correctRetailRevenue)}
                    </div>
                  </div>
                )}

                {/* INVOICE TOTALS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-gray-700 pt-3">
                  <div>
                    <div className="text-gray-500">CURRENT SERVICE</div>
                    <div>{money(inv.currentServiceRevenue)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">CORRECT SERVICE</div>
                    <div className="text-green-400 font-bold">
                      {money(inv.correctServiceRevenue)}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500">CURRENT STYLIST</div>
                    <div>{money(inv.currentStylistShare)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">CORRECT STYLIST</div>
                    <div className="text-green-400 font-bold">
                      {money(inv.correctStylistShare)}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500">CURRENT OWNER SERVICE</div>
                    <div>{money(inv.currentOwnerServiceShare)}</div>
                  </div>

                  <div>
                    <div className="text-gray-500">CORRECT OWNER SERVICE</div>
                    <div className="text-green-400 font-bold">
                      {money(inv.correctOwnerServiceShare)}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500">SERVICE FORMULA DIFF</div>
                    <div className={
                      Math.abs(inv.serviceFormulaDiff) > EPS
                        ? "text-red-400 font-bold"
                        : "text-green-400"
                    }>
                      {money(inv.serviceFormulaDiff)}
                    </div>
                  </div>

                  <div>
                    <div className="text-gray-500">OWNER FORMULA DIFF</div>
                    <div className={
                      Math.abs(inv.ownerFormulaDiff) > EPS
                        ? "text-red-400 font-bold"
                        : "text-green-400"
                    }>
                      {money(inv.ownerFormulaDiff)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* STATS RAW FIELD CHECK */}
      <div className="border border-purple-600 rounded p-4">
        <h2 className="text-purple-400 font-bold text-lg mb-3">
          DAILY STATS RAW FIELD CHECK
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={hcell}>Date</th>
                <th className={hcell}>Stats Doc</th>
                <th className={hcell}>stylistShare</th>
                <th className={hcell}>ownerShare</th>
                <th className={hcell}>retailProductsRevenue</th>
                <th className={hcell}>membershipRevenue</th>
                <th className={hcell}>expenses</th>
                <th className={hcell}>Raw</th>
              </tr>
            </thead>

            <tbody>
              {days.map((d) => {
                const stats = statsByDate[d.dateKey];

                return (
                  <tr key={d.dateKey}>
                    <td className={cell}>{d.dateKey}</td>
                    <td className={cell}>
                      {stats?._docId || "MISSING"}
                    </td>
                    <td className={cell}>
                      {stats ? money(stats.stylistShare) : "N/A"}
                    </td>
                    <td className={cell}>
                      {stats ? money(stats.ownerShare) : "N/A"}
                    </td>
                    <td className={cell}>
                      {stats ? money(getStatsRetail(stats)) : "N/A"}
                    </td>
                    <td className={cell}>
                      {stats ? money(getStatsMembership(stats)) : "N/A"}
                    </td>
                    <td className={cell}>
                      {getExpenseFromStats(stats) === null
                        ? "N/A"
                        : money(getExpenseFromStats(stats))}
                    </td>
                    <td className={cell}>
                      {stats ? (
                        <details>
                          <summary className="cursor-pointer text-blue-400">
                            View
                          </summary>
                          <pre className="mt-2 max-w-[700px] overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(stats, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        "No stats document"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FINAL DIAGNOSIS */}
      <div className="border border-gray-700 rounded p-4 space-y-2">
        <h2 className="text-yellow-400 font-bold text-lg">
          FINAL DIAGNOSIS
        </h2>

        <div>
          Service split:
          {" "}
          <span className={
            days.every((d) => Math.abs(d.splitBalance) <= EPS)
              ? "text-green-400 font-bold"
              : "text-red-400 font-bold"
          }>
            {days.every((d) => Math.abs(d.splitBalance) <= EPS)
              ? "ALL DAYS MATCH"
              : `${days.filter((d) => Math.abs(d.splitBalance) > EPS).length} DAY(S) MISMATCH`}
          </span>
        </div>

        <div>
          Daily stats stylist:
          {" "}
          <span className={
            days.every(
              (d) =>
                d.stylistDiff === null ||
                Math.abs(d.stylistDiff) <= EPS
            )
              ? "text-green-400 font-bold"
              : "text-red-400 font-bold"
          }>
            {days.every(
              (d) =>
                d.stylistDiff === null ||
                Math.abs(d.stylistDiff) <= EPS
            )
              ? "MATCH"
              : "MISMATCH"}
          </span>
        </div>

        <div>
          Daily stats retail:
          {" "}
          <span className={
            days.every(
              (d) =>
                d.retailDiff === null ||
                Math.abs(d.retailDiff) <= EPS
            )
              ? "text-green-400 font-bold"
              : "text-red-400 font-bold"
          }>
            {days.every(
              (d) =>
                d.retailDiff === null ||
                Math.abs(d.retailDiff) <= EPS
            )
              ? "MATCH"
              : "MISMATCH"}
          </span>
        </div>

        <div>
          Daily stats owner:
          {" "}
          <span className={
            days.every(
              (d) =>
                d.ownerDiff === null ||
                Math.abs(d.ownerDiff) <= EPS
            )
              ? "text-green-400 font-bold"
              : "text-red-400 font-bold"
          }>
            {days.every(
              (d) =>
                d.ownerDiff === null ||
                Math.abs(d.ownerDiff) <= EPS
            )
              ? "MATCH"
              : "MISMATCH"}
          </span>
        </div>

        <div className="text-gray-400 pt-2 border-t border-gray-700">
          Click any date in the main table to inspect every invoice and every
          service/product for that date.
        </div>

        <div className="text-orange-400">
          Daily expenses are NOT invented from invoices. They are shown as
          N/A unless the daily stats document actually contains an expense
          field. This prevents the debugger from falsely declaring an expense
          amount as correct.
        </div>
      </div>
    </div>
  );
}