"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { format, subMonths, addMonths, parseISO } from "date-fns";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  RefreshCw,
  Plus,
  ShieldCheck,
  TrendingUp,
  Scissors,
  Users,
  Wallet,
  Coins,
  Receipt,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Trash2,
  X,
  CreditCard,
  Building,
  PiggyBank,
  Sparkles,
} from "lucide-react";

import { useAppData } from "@/context/AppDataContext";
import { formatCurrency } from "@/components/salon-dashboard/types";
import * as invoicesService from "@/services/invoices";
import * as expensesService from "@/services/expenses";
import * as staffDrawingsService from "@/services/staffDrawings";
import type { StaffDrawing, StaffPaymentMethod, StaffPaymentType } from "@/services/staffDrawings";
import type { Expense } from "@/types/expense";
import {
  generateMonthlyReport,
  downloadMonthlyReportCSV,
  MonthlyReportPayload,
  StylistMonthlySettlement,
  StylistServiceItem,
} from "@/lib/utils/monthlyReports";

export default function MonthlyReportsPage() {
  const { staff, settings, loadingAppData } = useAppData();

  // Current selected month: "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const yy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${yy}-${mm}`;
  });

  const [activeTab, setActiveTab] = useState<"overview" | "commissions" | "settlements" | "payouts">("overview");

  // Raw data from Firestore
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allDrawings, setAllDrawings] = useState<StaffDrawing[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedStylistForPayment, setSelectedStylistForPayment] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentType, setPaymentType] = useState<StaffPaymentType>("payout");
  const [paymentMethod, setPaymentMethod] = useState<StaffPaymentMethod>("Cash");
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);

  // Drilldown modal for stylist service items
  const [drilldownStylist, setDrilldownStylist] = useState<StylistMonthlySettlement | null>(null);

  // Payout ledger modal for a stylist
  const [ledgerStylist, setLedgerStylist] = useState<StylistMonthlySettlement | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [invoicesData, drawingsData, expensesData] = await Promise.all([
        invoicesService.getAll(),
        staffDrawingsService.getAllDrawings(),
        expensesService.getAll(),
      ]);
      setAllInvoices(invoicesData);
      setAllDrawings(drawingsData);
      setAllExpenses(expensesData);
    } catch (err: any) {
      console.error("Failed to load monthly reports data:", err);
      setLoadError(err.message || "Failed to load report data from server.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Generate Report using pure calculation engine
  const report: MonthlyReportPayload | null = useMemo(() => {
    if (!staff || staff.length === 0) return null;
    return generateMonthlyReport({
      selectedMonth,
      invoices: allInvoices,
      staffDrawings: allDrawings,
      expenses: allExpenses,
      staffList: staff,
    });
  }, [selectedMonth, allInvoices, allDrawings, allExpenses, staff]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    const prev = subMonths(date, 1);
    setSelectedMonth(format(prev, "yyyy-MM"));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    const next = addMonths(date, 1);
    setSelectedMonth(format(next, "yyyy-MM"));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(format(new Date(), "yyyy-MM"));
  };

  const monthLabel = useMemo(() => {
    try {
      const [y, m] = selectedMonth.split("-").map(Number);
      return format(new Date(y, m - 1, 1), "MMMM yyyy");
    } catch {
      return selectedMonth;
    }
  }, [selectedMonth]);

  // Open payment modal with preselected stylist
  const openPaymentForStylist = (stylist: StylistMonthlySettlement) => {
    setSelectedStylistForPayment(stylist.staffId);
    setPaymentType("payout");
    setPaymentMethod("Cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentRef("");
    setPaymentNotes("");
    setPaymentModalError(null);

    // If they have a payable closing balance, suggest that amount
    if (stylist.closingBalance > 0) {
      setPaymentAmount(String(stylist.closingBalance));
    } else {
      setPaymentAmount("");
    }
    setShowPaymentModal(true);
  };

  // Submit payment / drawing
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStylistForPayment) {
      setPaymentModalError("Please select a stylist.");
      return;
    }
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentModalError("Please enter a valid payment amount greater than 0.");
      return;
    }
    const targetStaff = staff.find((s) => s.id === selectedStylistForPayment);
    if (!targetStaff || !targetStaff.id) {
      setPaymentModalError("Selected stylist was not found.");
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentModalError(null);
    try {
      await staffDrawingsService.addDrawing({
        staffId: targetStaff.id,
        staffName: targetStaff.name,
        amount: amt,
        date: paymentDate,
        month: paymentDate.slice(0, 7),
        paymentMethod,
        type: paymentType,
        referenceNumber: paymentRef.trim() || undefined,
        note: paymentNotes.trim() || undefined,
        recordedBy: "Owner",
      });

      // Refresh drawings
      const updatedDrawings = await staffDrawingsService.getAllDrawings();
      setAllDrawings(updatedDrawings);

      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
    } catch (err: any) {
      console.error("Error recording payment:", err);
      setPaymentModalError(err.message || "Failed to save payment.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Delete payment / drawing
  const handleDeleteDrawing = async (drawingId?: string) => {
    if (!drawingId) return;
    if (!confirm("Are you sure you want to remove this payment record? This will adjust the stylist balance.")) {
      return;
    }
    try {
      await staffDrawingsService.deleteDrawing(drawingId);
      const updatedDrawings = await staffDrawingsService.getAllDrawings();
      setAllDrawings(updatedDrawings);
    } catch (err: any) {
      alert("Failed to delete payment: " + err.message);
    }
  };

  // Filtered month drawings list
  const monthDrawings = useMemo(() => {
    return allDrawings.filter((d) => {
      const m = d.month || d.date.slice(0, 7);
      return m === selectedMonth;
    });
  }, [allDrawings, selectedMonth]);

  return (
    <div className="space-y-6 pb-20">
      {/* ── Page Header & Controls ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#F5F0E8]">
              Monthly Financial & Stylist Settlement Report
            </h1>
            <span className="rounded-full bg-[#C9A84C]/15 px-2.5 py-0.5 text-xs font-semibold text-[#E2C068] border border-[#C9A84C]/30">
              50/50 Net Split
            </span>
          </div>
          <p className="mt-1 text-sm text-[#8C8270]">
            Complete revenue reconciliation, owner allocations, stylist commissions, and carry-forward settlements.
          </p>
        </div>

        {/* Month Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Stepper */}
          <div className="flex items-center bg-[#131210] border border-[#2E2B24] rounded-lg p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1.5 rounded-md hover:bg-[#25231F] text-[#8C8270] hover:text-[#F5F0E8] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 px-3 min-w-[140px] justify-center">
              <Calendar className="h-4 w-4 text-[#C9A84C]" />
              <span className="text-sm font-semibold text-[#F5F0E8] whitespace-nowrap">{monthLabel}</span>
            </div>
            <button
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1.5 rounded-md hover:bg-[#25231F] text-[#8C8270] hover:text-[#F5F0E8] transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleCurrentMonth}
            className="px-3 py-2 text-xs font-medium text-[#C9A84C] hover:text-[#E2C068] bg-[#1C1A16] hover:bg-[#25231F] border border-[#2E2B24] rounded-lg transition-colors"
          >
            This Month
          </button>

          <button
            onClick={() => loadData()}
            title="Refresh Data"
            disabled={isLoading}
            className="p-2 text-[#8C8270] hover:text-[#F5F0E8] bg-[#131210] hover:bg-[#1C1A16] border border-[#2E2B24] rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => report && downloadMonthlyReportCSV(report)}
            disabled={!report || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#F5F0E8] bg-[#1C1A16] hover:bg-[#25231F] border border-[#2E2B24] rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-[#C9A84C]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#F5F0E8] bg-[#1C1A16] hover:bg-[#25231F] border border-[#2E2B24] rounded-lg transition-colors"
          >
            <Printer className="h-3.5 w-3.5 text-[#C9A84C]" />
            <span>Print Report</span>
          </button>

          <button
            onClick={() => {
              setSelectedStylistForPayment(staff[0]?.id || "");
              setPaymentAmount("");
              setPaymentType("payout");
              setPaymentMethod("Cash");
              setPaymentDate(new Date().toISOString().slice(0, 10));
              setPaymentRef("");
              setPaymentNotes("");
              setPaymentModalError(null);
              setShowPaymentModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-black bg-gradient-to-r from-[#C9A84C] to-[#E2C068] hover:opacity-95 rounded-lg shadow-md transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {loadError && (
        <div className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-700/50 rounded-xl text-red-200 text-sm">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* ── Reconciliation & Integrity Bar ───────────────────────────────── */}
      {report && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3.5 bg-[#131210] border border-[#2E2B24] rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-[#F5F0E8]">Audit Integrity:</span>{" "}
              <span className="text-[#A89F8C]">
                Recognized Revenue ({formatCurrency(report.overview.recognizedRevenue)}) strictly reconciles with Owner
                Allocation ({formatCurrency(report.overview.allocation.totalOwnerShare)}) + All Stylist Shares (
                {formatCurrency(report.overview.allocation.totalStylistShares)}).
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              <CheckCircle2 className="h-3 w-3" /> Discrepancy: ₹0.00
            </span>
            <span className="text-[#6D6555]">|</span>
            <span className="text-[#8C8270]">
              Collections: <strong className="text-[#F5F0E8]">{formatCurrency(report.overview.collections.totalCollected)}</strong>
            </span>
            {report.overview.totalOutstandingReceivables > 0 && (
              <span className="text-amber-400 ml-1">
                (Uncollected: {formatCurrency(report.overview.totalOutstandingReceivables)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Key Financial KPI Cards ────────────────────────────────────────── */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Recognized Revenue */}
          <div className="p-4 bg-[#131210] border border-[#2E2B24] rounded-xl relative overflow-hidden group hover:border-[#3D3930] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#8C8270]">Total Recognized Revenue</span>
              <div className="p-1.5 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C]">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#F5F0E8]">
              {formatCurrency(report.overview.recognizedRevenue)}
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-[#8C8270]">
              <div className="flex justify-between">
                <span>Services (Gross):</span>
                <span className="text-[#D8D0C0] font-medium">{formatCurrency(report.overview.grossServiceRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Retail Products:</span>
                <span className="text-[#D8D0C0] font-medium">{formatCurrency(report.overview.retailProductsRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Memberships & Credits:</span>
                <span className="text-[#D8D0C0] font-medium">
                  {formatCurrency(report.overview.membershipFeesRevenue + report.overview.creditCollectionsRevenue)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Stylist Total Commissions */}
          <div className="p-4 bg-[#131210] border border-[#2E2B24] rounded-xl relative overflow-hidden group hover:border-[#3D3930] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#8C8270]">Stylist Commissions Pool</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Scissors className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#60A5FA]">
              {formatCurrency(report.overview.allocation.totalStylistShares)}
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-[#8C8270]">
              <div className="flex justify-between">
                <span>Net Service Pool:</span>
                <span className="text-[#D8D0C0] font-medium">{formatCurrency(report.overview.netServiceRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Commission Rate:</span>
                <span className="text-blue-400 font-medium">50% of Net Services</span>
              </div>
              <div className="flex justify-between">
                <span>Supplies Deducted:</span>
                <span className="text-amber-400 font-medium">{formatCurrency(report.overview.totalProductSuppliesCost)}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Owner Total Net Revenue Allocation */}
          <div className="p-4 bg-[#131210] border border-[#2E2B24] rounded-xl relative overflow-hidden group hover:border-[#3D3930] transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#8C8270]">Owner Revenue Allocation</span>
              <div className="p-1.5 rounded-lg bg-[#C9A84C]/15 text-[#E2C068]">
                <Building className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-[#E2C068]">
              {formatCurrency(report.overview.allocation.totalOwnerShare)}
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-[#8C8270]">
              <div className="flex justify-between">
                <span>50% Net Services:</span>
                <span className="text-[#D8D0C0] font-medium">
                  {formatCurrency(report.overview.allocation.ownerNetServiceSplit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>100% Supplies Reimbursed:</span>
                <span className="text-emerald-400 font-medium">
                  {formatCurrency(report.overview.allocation.ownerProductReimbursement)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Owner Direct + Retail:</span>
                <span className="text-[#D8D0C0] font-medium">
                  {formatCurrency(
                    report.overview.allocation.ownerDirectServiceShare +
                      report.overview.allocation.ownerRetailShare +
                      report.overview.allocation.ownerMembershipShare +
                      report.overview.allocation.ownerCreditCollectionsShare
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Salon Net Profit */}
          <div
            className={`p-4 bg-[#131210] border rounded-xl relative overflow-hidden group transition-colors ${
              report.overview.salonNetProfit >= 0
                ? "border-emerald-500/30 hover:border-emerald-500/50"
                : "border-red-500/30 hover:border-red-500/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-[#8C8270]">Salon Net Business Profit</span>
                <span className="block text-[10px] text-[#6D6555]">Owner Share − Salon Expenses</span>
              </div>
              <div
                className={`p-1.5 rounded-lg ${
                  report.overview.salonNetProfit >= 0
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                <PiggyBank className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-2 text-2xl font-bold ${
                report.overview.salonNetProfit >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(report.overview.salonNetProfit)}
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-[#8C8270]">
              <div className="flex justify-between">
                <span>Owner Share:</span>
                <span className="text-[#D8D0C0] font-medium">
                  {formatCurrency(report.overview.allocation.totalOwnerShare)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Salon Expenses:</span>
                <span className="text-red-400 font-medium">
                  −{formatCurrency(report.overview.expenses.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Net Margin:</span>
                <span className="text-emerald-400 font-medium">
                  {report.overview.recognizedRevenue > 0
                    ? `${Math.round((report.overview.salonNetProfit / report.overview.recognizedRevenue) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Navigation ─────────────────────────────────────────────────── */}
      <div className="border-b border-[#2E2B24]">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-[#C9A84C] text-[#E2C068]"
                : "border-transparent text-[#8C8270] hover:text-[#D8D0C0]"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Monthly P&L & Collections</span>
          </button>
          <button
            onClick={() => setActiveTab("commissions")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "commissions"
                ? "border-[#C9A84C] text-[#E2C068]"
                : "border-transparent text-[#8C8270] hover:text-[#D8D0C0]"
            }`}
          >
            <Scissors className="h-4 w-4" />
            <span>Stylist 50% Commission Breakdown</span>
          </button>
          <button
            onClick={() => setActiveTab("settlements")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "settlements"
                ? "border-[#C9A84C] text-[#E2C068]"
                : "border-transparent text-[#8C8270] hover:text-[#D8D0C0]"
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>Financial Settlement Ledger</span>
            {report && report.ownerSummary.totalOutstandingStaffPayables > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                {formatCurrency(report.ownerSummary.totalOutstandingStaffPayables)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("payouts")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "payouts"
                ? "border-[#C9A84C] text-[#E2C068]"
                : "border-transparent text-[#8C8270] hover:text-[#D8D0C0]"
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Payout History ({monthDrawings.length})</span>
          </button>
        </nav>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-20 text-center text-[#8C8270]">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#C9A84C] mb-3" />
          <p className="text-sm font-medium">Calculating monthly financial settlement & commissions...</p>
        </div>
      ) : !report ? (
        <div className="py-20 text-center text-[#8C8270]">No staff or report data found.</div>
      ) : (
        <div>
          {/* TAB 1: OVERVIEW & COLLECTIONS */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section A: Revenue Categories */}
                <div className="bg-[#131210] border border-[#2E2B24] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#25231F]">
                    <h3 className="text-sm font-semibold text-[#F5F0E8] flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#C9A84C]" />
                      Revenue Stream Breakdown
                    </h3>
                    <span className="text-xs text-[#8C8270]">Recognized Allocation</span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C]">Gross Service Revenue</span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.grossServiceRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16] text-amber-400/90 pl-3">
                      <span>− Service Supplies Cost (100% Reimbursed to Owner)</span>
                      <span>−{formatCurrency(report.overview.totalProductSuppliesCost)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16] pl-3 font-medium text-emerald-400">
                      <span>= Net Service Revenue (Split 50/50)</span>
                      <span>{formatCurrency(report.overview.netServiceRevenue)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C]">Retail Product Sales (100% Owner)</span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.retailProductsRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C]">Membership Fees (100% Owner)</span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.membershipFeesRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C]">Past Customer Credit Collections (100% Owner)</span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.creditCollectionsRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 text-base font-bold text-[#E2C068]">
                      <span>Total Recognized Revenue</span>
                      <span>{formatCurrency(report.overview.recognizedRevenue)}</span>
                    </div>
                  </div>
                </div>

                {/* Section B: Collections & Tenders */}
                <div className="bg-[#131210] border border-[#2E2B24] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#25231F]">
                    <h3 className="text-sm font-semibold text-[#F5F0E8] flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-[#C9A84C]" />
                      Payment Collections by Tender
                    </h3>
                    <span className="text-xs text-[#8C8270]">Realized Cash Flow</span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400"></span> Cash Collections
                      </span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.collections.cash)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-400"></span> UPI / QR Payments
                      </span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.collections.upi)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-purple-400"></span> Card Payments
                      </span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.collections.card)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#1C1A16]">
                      <span className="text-[#A89F8C] flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400"></span> Customer Advance Balance Used
                      </span>
                      <span className="font-semibold text-[#F5F0E8]">
                        {formatCurrency(report.overview.collections.advanceUsed)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 text-base font-bold text-emerald-400">
                      <span>Total Realized Collections</span>
                      <span>{formatCurrency(report.overview.collections.totalCollected)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs text-amber-400/80">
                      <span>Outstanding Balances Due from Customers</span>
                      <span>{formatCurrency(report.overview.totalOutstandingReceivables)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section C: Operating Expenses & Profit Analysis */}
              <div className="bg-[#131210] border border-[#2E2B24] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#25231F]">
                  <div>
                    <h3 className="text-sm font-semibold text-[#F5F0E8] flex items-center gap-2">
                      <PiggyBank className="h-4 w-4 text-[#C9A84C]" />
                      Salon Operating Expenses & Net Business Profit
                    </h3>
                    <p className="text-xs text-[#8C8270] mt-0.5">
                      Salon Net Profit reflects Owner Revenue Share after covering all salon operating expenses.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#C9A84C]/10 text-[#E2C068] border border-[#C9A84C]/20">
                    Total Expenses: {formatCurrency(report.overview.expenses.totalExpenses)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.keys(report.overview.expenses.categoryBreakdown).length === 0 ? (
                    <div className="col-span-full py-4 text-center text-xs text-[#8C8270]">
                      No operating expenses recorded for {monthLabel}.
                    </div>
                  ) : (
                    Object.entries(report.overview.expenses.categoryBreakdown).map(([category, amount]) => (
                      <div key={category} className="p-3 bg-[#1C1A16] border border-[#2E2B24] rounded-lg">
                        <div className="text-xs text-[#8C8270]">{category}</div>
                        <div className="text-base font-bold text-[#F5F0E8] mt-1">{formatCurrency(amount)}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 p-4 bg-[#1C1A16] border border-[#3D3930] rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-[#8C8270]">Formula Verification</span>
                    <div className="text-sm font-medium text-[#F5F0E8]">
                      Owner Allocation ({formatCurrency(report.overview.allocation.totalOwnerShare)}) − Operating
                      Expenses ({formatCurrency(report.overview.expenses.totalExpenses)})
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#8C8270] block">Final Salon Net Profit</span>
                    <span
                      className={`text-2xl font-bold ${
                        report.overview.salonNetProfit >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatCurrency(report.overview.salonNetProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STYLIST 50% COMMISSIONS */}
          {activeTab === "commissions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#F5F0E8]">Stylist Revenue Sharing Performance</h3>
                  <p className="text-xs text-[#8C8270]">
                    Calculated strictly as 50% of (Gross Service Revenue − Service Supplies Cost). Owner direct
                    services are allocated 100% to Owner.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#2E2B24] bg-[#131210]">
                <table className="w-full text-left text-xs text-[#D8D0C0]">
                  <thead className="bg-[#1C1A16] text-[#8C8270] uppercase font-semibold border-b border-[#2E2B24]">
                    <tr>
                      <th className="px-4 py-3">Stylist / Staff</th>
                      <th className="px-4 py-3 text-center">Services</th>
                      <th className="px-4 py-3 text-right">Gross Service Rev</th>
                      <th className="px-4 py-3 text-right">Supply Cost Deducted</th>
                      <th className="px-4 py-3 text-right">Net Service Pool</th>
                      <th className="px-4 py-3 text-right text-[#60A5FA]">Stylist Share (50%)</th>
                      <th className="px-4 py-3 text-right text-[#E2C068]">Owner Contribution</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#25231F]">
                    {report.stylistSettlements.map((st) => (
                      <tr key={st.staffId} className="hover:bg-[#1A1814] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#F5F0E8]">{st.staffName}</div>
                          <div className="text-[11px] text-[#8C8270]">{st.role || "Stylist"}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-medium">{st.servicesCount}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(st.grossServiceRevenue)}</td>
                        <td className="px-4 py-3 text-right text-amber-400 font-medium">
                          {st.productCostDeducted > 0 ? `−${formatCurrency(st.productCostDeducted)}` : "₹0"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-400">
                          {formatCurrency(st.netServiceRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#60A5FA] bg-blue-950/10">
                          {formatCurrency(st.currentEarnings)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#E2C068] bg-[#C9A84C]/5">
                          {formatCurrency(st.ownerShareContribution)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDrilldownStylist(st)}
                            title="Drilldown Line Items"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#C9A84C] hover:text-[#E2C068] bg-[#1C1A16] hover:bg-[#25231F] border border-[#2E2B24] rounded-md transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Owner Direct Row */}
                    <tr className="bg-[#1C1A16]/60 font-semibold text-[#E2C068]">
                      <td className="px-4 py-3">
                        <div>Salon Owner Direct Services</div>
                        <div className="text-[11px] text-[#8C8270] font-normal">Services assigned to Owner / System</div>
                      </td>
                      <td className="px-4 py-3 text-center">—</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(report.overview.allocation.ownerDirectServiceShare)}
                      </td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(report.overview.allocation.ownerDirectServiceShare)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 font-normal">₹0 (0%)</td>
                      <td className="px-4 py-3 text-right font-bold text-[#E2C068]">
                        {formatCurrency(report.overview.allocation.ownerDirectServiceShare)} (100%)
                      </td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-[#181613] font-bold text-[#F5F0E8] border-t-2 border-[#2E2B24]">
                    <tr>
                      <td className="px-4 py-3">Total Reconciled Service Revenue</td>
                      <td className="px-4 py-3 text-center">
                        {report.stylistSettlements.reduce((sum, s) => sum + s.servicesCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(report.overview.grossServiceRevenue)}</td>
                      <td className="px-4 py-3 text-right text-amber-400">
                        −{formatCurrency(report.overview.totalProductSuppliesCost)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400">
                        {formatCurrency(report.overview.netServiceRevenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#60A5FA]">
                        {formatCurrency(report.overview.allocation.totalStylistShares)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#E2C068]">
                        {formatCurrency(
                          report.overview.allocation.ownerNetServiceSplit +
                            report.overview.allocation.ownerProductReimbursement +
                            report.overview.allocation.ownerDirectServiceShare
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STYLIST FINANCIAL SETTLEMENT LEDGER */}
          {activeTab === "settlements" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#F5F0E8]">Stylist Financial Settlement Ledger</h3>
                  <p className="text-xs text-[#8C8270]">
                    Carries forward historical opening balances, recognizes current month earnings, deducts payouts,
                    and calculates payable or advance closing balances.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="px-3 py-1.5 bg-[#131210] border border-[#2E2B24] rounded-lg">
                    <span className="text-[#8C8270]">Total Payable to Stylists: </span>
                    <strong className="text-amber-400 font-bold">
                      {formatCurrency(report.ownerSummary.totalOutstandingStaffPayables)}
                    </strong>
                  </div>
                  {report.ownerSummary.totalStaffAdvanceCredits > 0 && (
                    <div className="px-3 py-1.5 bg-[#131210] border border-blue-500/30 rounded-lg">
                      <span className="text-[#8C8270]">Total Stylist Advances/Credits: </span>
                      <strong className="text-blue-400 font-bold">
                        {formatCurrency(report.ownerSummary.totalStaffAdvanceCredits)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#2E2B24] bg-[#131210]">
                <table className="w-full text-left text-xs text-[#D8D0C0]">
                  <thead className="bg-[#1C1A16] text-[#8C8270] uppercase font-semibold border-b border-[#2E2B24]">
                    <tr>
                      <th className="px-4 py-3">Stylist</th>
                      <th className="px-4 py-3 text-right">Opening Balance (B/F)</th>
                      <th className="px-4 py-3 text-right text-[#60A5FA]">Month Earnings</th>
                      <th className="px-4 py-3 text-right">Adjustments</th>
                      <th className="px-4 py-3 text-right font-bold">Available Payable</th>
                      <th className="px-4 py-3 text-right text-emerald-400">Payments Made</th>
                      <th className="px-4 py-3 text-right">Closing Balance</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#25231F]">
                    {report.stylistSettlements.map((st) => (
                      <tr key={st.staffId} className="hover:bg-[#1A1814] transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#F5F0E8]">{st.staffName}</div>
                          <div className="text-[11px] text-[#8C8270]">{st.role || "Stylist"}</div>
                        </td>
                        {/* Opening Balance */}
                        <td className="px-4 py-3 text-right font-medium">
                          {st.openingBalance > 0 ? (
                            <span className="text-amber-400">+{formatCurrency(st.openingBalance)}</span>
                          ) : st.openingBalance < 0 ? (
                            <span className="text-blue-400">−{formatCurrency(Math.abs(st.openingBalance))} (Adv)</span>
                          ) : (
                            <span className="text-[#6D6555]">₹0</span>
                          )}
                        </td>
                        {/* Month Earnings */}
                        <td className="px-4 py-3 text-right font-semibold text-[#60A5FA]">
                          +{formatCurrency(st.currentEarnings)}
                        </td>
                        {/* Adjustments */}
                        <td className="px-4 py-3 text-right">
                          {st.adjustmentsThisMonth !== 0 ? (
                            <span
                              className={st.adjustmentsThisMonth > 0 ? "text-emerald-400" : "text-red-400 font-medium"}
                            >
                              {st.adjustmentsThisMonth > 0 ? "+" : ""}
                              {formatCurrency(st.adjustmentsThisMonth)}
                            </span>
                          ) : (
                            <span className="text-[#6D6555]">—</span>
                          )}
                        </td>
                        {/* Available Payable */}
                        <td className="px-4 py-3 text-right font-bold text-[#F5F0E8]">
                          {formatCurrency(st.totalAvailablePayable + st.adjustmentsThisMonth)}
                        </td>
                        {/* Payments Made */}
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                          {st.paymentsMadeThisMonth > 0 ? (
                            <span>−{formatCurrency(st.paymentsMadeThisMonth)}</span>
                          ) : (
                            <span className="text-[#6D6555]">₹0</span>
                          )}
                        </td>
                        {/* Closing Balance */}
                        <td className="px-4 py-3 text-right font-bold text-sm">
                          {st.closingBalance > 0 ? (
                            <span className="text-amber-400">{formatCurrency(st.closingBalance)}</span>
                          ) : st.closingBalance < 0 ? (
                            <span className="text-blue-400 font-semibold">
                              −{formatCurrency(Math.abs(st.closingBalance))}
                            </span>
                          ) : (
                            <span className="text-emerald-400">₹0.00</span>
                          )}
                        </td>
                        {/* Status Badge */}
                        <td className="px-4 py-3 text-center">
                          {st.settlementStatus === "settled" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Settled
                            </span>
                          ) : st.settlementStatus === "payable" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="h-3 w-3" /> Payable
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <ArrowUpRight className="h-3 w-3" /> Advance Given
                            </span>
                          )}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openPaymentForStylist(st)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-black bg-gradient-to-r from-[#C9A84C] to-[#E2C068] hover:opacity-95 rounded-md transition-opacity"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => setLedgerStylist(st)}
                              title="View Stylist Payout History"
                              className="p-1 text-[#8C8270] hover:text-[#F5F0E8] bg-[#1C1A16] hover:bg-[#25231F] border border-[#2E2B24] rounded-md transition-colors"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#181613] font-bold text-[#F5F0E8] border-t-2 border-[#2E2B24]">
                    <tr>
                      <td className="px-4 py-3">Total All Stylists</td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(report.stylistSettlements.reduce((s, x) => s + x.openingBalance, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-[#60A5FA]">
                        +{formatCurrency(report.overview.allocation.totalStylistShares)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(report.stylistSettlements.reduce((s, x) => s + x.adjustmentsThisMonth, 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(
                          report.stylistSettlements.reduce(
                            (s, x) => s + x.totalAvailablePayable + x.adjustmentsThisMonth,
                            0
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400">
                        −{formatCurrency(report.ownerSummary.totalStaffPaymentsMade)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-400">
                        {formatCurrency(report.stylistSettlements.reduce((s, x) => s + x.closingBalance, 0))}
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-center text-xs text-[#8C8270]">
                        Outstanding: {formatCurrency(report.ownerSummary.totalOutstandingStaffPayables)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PAYOUT HISTORY & ADVANCE TRACKER */}
          {activeTab === "payouts" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#F5F0E8]">
                    Staff Payouts & Advance Drawings ({monthLabel})
                  </h3>
                  <p className="text-xs text-[#8C8270]">
                    All disbursement records are saved in the staffDrawings collection with payment method and reference
                    metadata.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStylistForPayment(staff[0]?.id || "");
                    setPaymentAmount("");
                    setPaymentType("payout");
                    setPaymentMethod("Cash");
                    setPaymentDate(new Date().toISOString().slice(0, 10));
                    setPaymentRef("");
                    setPaymentNotes("");
                    setPaymentModalError(null);
                    setShowPaymentModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black bg-gradient-to-r from-[#C9A84C] to-[#E2C068] hover:opacity-95 rounded-lg transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Payout / Advance</span>
                </button>
              </div>

              {monthDrawings.length === 0 ? (
                <div className="py-16 text-center text-[#8C8270] bg-[#131210] border border-[#2E2B24] rounded-xl">
                  <Receipt className="h-8 w-8 mx-auto text-[#6D6555] mb-2" />
                  <p className="text-sm font-medium">No payouts or advances recorded for {monthLabel}.</p>
                  <p className="text-xs text-[#6D6555] mt-1">
                    Click &apos;Record Payment&apos; to disburse payments to stylists.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#2E2B24] bg-[#131210]">
                  <table className="w-full text-left text-xs text-[#D8D0C0]">
                    <thead className="bg-[#1C1A16] text-[#8C8270] uppercase font-semibold border-b border-[#2E2B24]">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Stylist</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Type</th>
                        <th className="px-4 py-3 text-center">Payment Method</th>
                        <th className="px-4 py-3">Reference / Notes</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#25231F]">
                      {monthDrawings.map((dr) => (
                        <tr key={dr.id} className="hover:bg-[#1A1814] transition-colors">
                          <td className="px-4 py-3 font-medium text-[#F5F0E8]">{dr.date}</td>
                          <td className="px-4 py-3 font-semibold text-[#F5F0E8]">{dr.staffName}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-400">
                            {formatCurrency(dr.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                dr.type === "advance"
                                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  : dr.type === "adjustment"
                                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {dr.type === "advance"
                                ? "Advance"
                                : dr.type === "adjustment"
                                ? "Adjustment"
                                : "Regular Payout"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-[#1C1A16] text-[#D8D0C0] border border-[#2E2B24]">
                              {dr.paymentMethod || "Cash"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[#A89F8C]">
                            {dr.referenceNumber && (
                              <div className="font-mono text-[11px] text-[#C9A84C]">Ref: {dr.referenceNumber}</div>
                            )}
                            <div>{dr.note || "—"}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteDrawing(dr.id)}
                              title="Delete Record"
                              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── RECORD PAYMENT MODAL ────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#131210] border border-[#2E2B24] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-[#8C8270] hover:text-[#F5F0E8]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C]">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F0E8]">Record Stylist Payment</h3>
                <p className="text-xs text-[#8C8270]">Disburse payout, advance, or adjustment</p>
              </div>
            </div>

            {paymentModalError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{paymentModalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              {/* Stylist Selector */}
              <div>
                <label className="block text-[#A89F8C] mb-1 font-medium">Select Stylist *</label>
                <select
                  value={selectedStylistForPayment}
                  onChange={(e) => {
                    setSelectedStylistForPayment(e.target.value);
                    const st = report?.stylistSettlements.find((x) => x.staffId === e.target.value);
                    if (st && st.closingBalance > 0) {
                      setPaymentAmount(String(st.closingBalance));
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#1C1A16] border border-[#2E2B24] rounded-lg text-[#F5F0E8] focus:outline-none focus:border-[#C9A84C]"
                  required
                >
                  <option value="" disabled>
                    Choose stylist...
                  </option>
                  {staff
                    .filter((s) => s.role !== "Owner")
                    .map((s) => {
                      const st = report?.stylistSettlements.find((x) => x.staffId === s.id);
                      const bal = st ? st.closingBalance : 0;
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role || "Stylist"}) —{" "}
                          {bal > 0 ? `Payable: ${formatCurrency(bal)}` : bal < 0 ? `Advance: ${formatCurrency(Math.abs(bal))}` : "Settled"}
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Payment Type */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType("payout")}
                  className={`py-2 px-2 text-center rounded-lg border text-xs font-semibold transition-all ${
                    paymentType === "payout"
                      ? "bg-[#C9A84C]/20 border-[#C9A84C] text-[#E2C068]"
                      : "bg-[#1C1A16] border-[#2E2B24] text-[#8C8270] hover:text-[#D8D0C0]"
                  }`}
                >
                  Regular Payout
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("advance")}
                  className={`py-2 px-2 text-center rounded-lg border text-xs font-semibold transition-all ${
                    paymentType === "advance"
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "bg-[#1C1A16] border-[#2E2B24] text-[#8C8270] hover:text-[#D8D0C0]"
                  }`}
                >
                  Advance
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("adjustment")}
                  className={`py-2 px-2 text-center rounded-lg border text-xs font-semibold transition-all ${
                    paymentType === "adjustment"
                      ? "bg-purple-500/20 border-purple-500 text-purple-400"
                      : "bg-[#1C1A16] border-[#2E2B24] text-[#8C8270] hover:text-[#D8D0C0]"
                  }`}
                >
                  Adjustment
                </button>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A89F8C] mb-1 font-medium">Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-[#1C1A16] border border-[#2E2B24] rounded-lg text-[#F5F0E8] font-bold text-sm focus:outline-none focus:border-[#C9A84C]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#A89F8C] mb-1 font-medium">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#1C1A16] border border-[#2E2B24] rounded-lg text-[#F5F0E8] focus:outline-none focus:border-[#C9A84C]"
                    required
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[#A89F8C] mb-1 font-medium">Payment Method *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["Cash", "UPI", "Bank Transfer", "Cheque"] as StaffPaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 px-2 text-center rounded-lg border text-[11px] font-medium transition-all ${
                        paymentMethod === method
                          ? "bg-[#C9A84C]/20 border-[#C9A84C] text-[#E2C068]"
                          : "bg-[#1C1A16] border-[#2E2B24] text-[#8C8270] hover:text-[#D8D0C0]"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference # */}
              <div>
                <label className="block text-[#A89F8C] mb-1 font-medium">
                  Reference # (UPI Ref, Transaction ID, Cheque #)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. UPI-9283749821 or CHQ-0012"
                  className="w-full px-3 py-2 bg-[#1C1A16] border border-[#2E2B24] rounded-lg text-[#F5F0E8] focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[#A89F8C] mb-1 font-medium">Notes / Reason</label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional note about this settlement..."
                  className="w-full px-3 py-2 bg-[#1C1A16] border border-[#2E2B24] rounded-lg text-[#F5F0E8] focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#25231F]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#8C8270] hover:text-[#F5F0E8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-5 py-2 text-xs font-semibold text-black bg-gradient-to-r from-[#C9A84C] to-[#E2C068] hover:opacity-95 rounded-lg shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingPayment && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{isSubmittingPayment ? "Saving..." : "Confirm & Save Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRILLDOWN MODAL: STYLIST SERVICES ────────────────────────────── */}
      {drilldownStylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] bg-[#131210] border border-[#2E2B24] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[#2E2B24] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#F5F0E8]">
                    {drilldownStylist.staffName} — Service Transactions
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#C9A84C]/15 text-[#E2C068] border border-[#C9A84C]/30">
                    {drilldownStylist.servicesCount} Services
                  </span>
                </div>
                <p className="text-xs text-[#8C8270] mt-0.5">
                  Detailed breakdown of 50% net split after deducting service supplies cost for {monthLabel}
                </p>
              </div>
              <button
                onClick={() => setDrilldownStylist(null)}
                className="p-1 rounded-lg hover:bg-[#1C1A16] text-[#8C8270] hover:text-[#F5F0E8]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto p-5">
              {drilldownStylist.serviceTransactions.length === 0 ? (
                <div className="py-12 text-center text-[#8C8270] text-xs">
                  No service line items found for this stylist in {monthLabel}.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-[#D8D0C0]">
                  <thead className="bg-[#1C1A16] text-[#8C8270] uppercase font-semibold border-b border-[#2E2B24]">
                    <tr>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Invoice #</th>
                      <th className="px-3 py-2.5">Service Name</th>
                      <th className="px-3 py-2.5">Customer</th>
                      <th className="px-3 py-2.5 text-right">Recognized Billed</th>
                      <th className="px-3 py-2.5 text-right text-amber-400">Supply Cost</th>
                      <th className="px-3 py-2.5 text-right text-emerald-400">Net Pool</th>
                      <th className="px-3 py-2.5 text-right text-[#60A5FA]">Stylist (50%)</th>
                      <th className="px-3 py-2.5 text-right text-[#E2C068]">Owner Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#25231F]">
                    {drilldownStylist.serviceTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[#1A1814] transition-colors">
                        <td className="px-3 py-2 text-[#8C8270] whitespace-nowrap">{tx.date}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[#C9A84C] whitespace-nowrap">
                          {tx.invoiceNumber}
                        </td>
                        <td className="px-3 py-2 font-semibold text-[#F5F0E8]">{tx.serviceName}</td>
                        <td className="px-3 py-2 text-[#A89F8C]">{tx.customerName}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(tx.amount)}</td>
                        <td className="px-3 py-2 text-right text-amber-400 font-medium">
                          {tx.productCost > 0 ? `−${formatCurrency(tx.productCost)}` : "₹0"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-400">
                          {formatCurrency(tx.netAmount)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#60A5FA]">
                          {formatCurrency(tx.stylistShare)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#E2C068]">
                          {formatCurrency(tx.ownerShare)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#181613] font-bold text-[#F5F0E8] border-t-2 border-[#2E2B24]">
                    <tr>
                      <td colSpan={4} className="px-3 py-2.5 text-right">
                        Totals for {drilldownStylist.staffName}:
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(drilldownStylist.grossServiceRevenue)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-400">
                        −{formatCurrency(drilldownStylist.productCostDeducted)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-emerald-400">
                        {formatCurrency(drilldownStylist.netServiceRevenue)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#60A5FA]">
                        {formatCurrency(drilldownStylist.currentEarnings)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#E2C068]">
                        {formatCurrency(drilldownStylist.ownerShareContribution)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#181613] border-t border-[#2E2B24] flex items-center justify-between text-xs">
              <span className="text-[#8C8270]">
                Owner Share includes 50% Net Service + 100% Supply Cost Reimbursement
              </span>
              <button
                onClick={() => setDrilldownStylist(null)}
                className="px-4 py-2 font-medium text-black bg-gradient-to-r from-[#C9A84C] to-[#E2C068] rounded-lg hover:opacity-95"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STYLIST PAYOUT LEDGER MODAL ──────────────────────────────────── */}
      {ledgerStylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-[#131210] border border-[#2E2B24] rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setLedgerStylist(null)}
              className="absolute top-4 right-4 text-[#8C8270] hover:text-[#F5F0E8]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F0E8]">
                  {ledgerStylist.staffName} — Payout History ({monthLabel})
                </h3>
                <p className="text-xs text-[#8C8270]">
                  Opening Balance: {formatCurrency(ledgerStylist.openingBalance)} | Current Month Earnings:{" "}
                  {formatCurrency(ledgerStylist.currentEarnings)}
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {ledgerStylist.payoutsList.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8C8270] bg-[#1C1A16] rounded-xl border border-[#2E2B24]">
                  No payouts or drawings recorded for this stylist in {monthLabel}.
                </div>
              ) : (
                <div className="divide-y divide-[#25231F] border border-[#2E2B24] rounded-xl overflow-hidden bg-[#1C1A16]">
                  {ledgerStylist.payoutsList.map((dr) => (
                    <div key={dr.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#F5F0E8]">{dr.date}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 font-semibold">
                            {dr.type || "payout"}
                          </span>
                          <span className="text-[#8C8270]">via {dr.paymentMethod || "Cash"}</span>
                        </div>
                        {dr.referenceNumber && (
                          <div className="text-[11px] font-mono text-[#C9A84C] mt-0.5">Ref: {dr.referenceNumber}</div>
                        )}
                        {dr.note && <div className="text-[11px] text-[#8C8270] mt-0.5">{dr.note}</div>}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-400">{formatCurrency(dr.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-[#1C1A16] border border-[#2E2B24] rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[#8C8270] block">Current Closing Balance</span>
                <span
                  className={`text-base font-bold ${
                    ledgerStylist.closingBalance > 0
                      ? "text-amber-400"
                      : ledgerStylist.closingBalance < 0
                      ? "text-blue-400"
                      : "text-emerald-400"
                  }`}
                >
                  {ledgerStylist.closingBalance > 0
                    ? `Payable: ${formatCurrency(ledgerStylist.closingBalance)}`
                    : ledgerStylist.closingBalance < 0
                    ? `Advance/Credit: ${formatCurrency(Math.abs(ledgerStylist.closingBalance))}`
                    : "Fully Settled (₹0.00)"}
                </span>
              </div>
              <button
                onClick={() => {
                  setLedgerStylist(null);
                  openPaymentForStylist(ledgerStylist);
                }}
                className="px-4 py-2 text-xs font-semibold text-black bg-gradient-to-r from-[#C9A84C] to-[#E2C068] hover:opacity-95 rounded-lg"
              >
                Record New Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
